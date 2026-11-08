// Long reports, stored on Solana.
//
// A job's result field holds at most 1,200 bytes, which is too small for a real
// audit or due-diligence report. So an agent writes the encrypted report into a
// few Memo transactions, then submits a short pointer as the job's result:
//
//   rpt1:<hash>:<sig1>,<sig2>,…
//
// <hash> commits to the exact encrypted bytes, so the client and the judge can
// tell if anything was swapped. The chunks are encrypted (see crypto.ts), so the
// public memos reveal nothing.
//
// Report text format: markdown, then a claims block the judge checks:
//   ```claims
//   {"mintAuthority":"none", …}
//   ```
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  type ParsedInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";

export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const POINTER_PREFIX = "rpt1:";
const CHUNK = 950; // characters of envelope per memo; keeps each tx under 1,232 bytes
const MAX_CHUNKS = 12; // 12 signatures still fit in the 1,200 byte result field

export const isPointer = (result: string) => result.startsWith(POINTER_PREFIX);

function hashOf(envelope: string): string {
  const h = nacl.hash(new TextEncoder().encode(envelope)).subarray(0, 16);
  let s = "";
  h.forEach((b) => (s += b.toString(16).padStart(2, "0")));
  return s;
}

/** Write an encrypted report into memo transactions and return the job's pointer. */
export async function storeReport(connection: Connection, payer: Keypair, envelope: string): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < envelope.length; i += CHUNK) parts.push(envelope.slice(i, i + CHUNK));
  if (parts.length > MAX_CHUNKS) throw new Error(`Report is too long (${parts.length} parts, max ${MAX_CHUNKS}).`);
  // Send every part at once (they're independent), then wait for all of them.
  const sigs = await Promise.all(parts.map((part, i) => sendPart(connection, payer, part, i, parts.length)));
  return `${POINTER_PREFIX}${hashOf(envelope)}:${sigs.join(",")}`;
}

async function sendPart(connection: Connection, payer: Keypair, part: string, i: number, total: number): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    // Built fresh each attempt so a retry gets a new blockhash.
    // The Memo program checks every byte is valid UTF-8, which costs more than
    // the default 200k compute units for a ~1 KB memo.
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      new TransactionInstruction({
        programId: MEMO_PROGRAM,
        keys: [],
        data: Buffer.from(`BA1|rpt|${i + 1}/${total}|${part}`, "utf8"),
      }),
    );
    try {
      return await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

/** Read a report's chunks back from chain and check them against the pointer's hash. */
export async function loadReport(connection: Connection, pointer: string): Promise<string> {
  const [, hash, list] = pointer.split(":");
  const sigs = (list ?? "").split(",").filter(Boolean);
  if (!hash || !sigs.length) throw new Error("This result pointer is malformed.");
  const parts: string[] = [];
  for (const sig of sigs) {
    let tx = null;
    for (let attempt = 1; attempt <= 5 && !tx; attempt++) {
      try {
        tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      } catch (e) {
        if (attempt === 5) throw e;
      }
      if (!tx) await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
    const memo = tx?.transaction.message.instructions.find(
      (ix): ix is ParsedInstruction => ix.programId.equals(MEMO_PROGRAM) && "parsed" in ix,
    );
    const text = typeof memo?.parsed === "string" ? memo.parsed : null;
    const m = text?.match(/^BA1\|rpt\|\d+\/\d+\|([\s\S]*)$/);
    if (!m) throw new Error("A part of this report is missing on chain.");
    parts.push(m[1]);
  }
  const envelope = parts.join("");
  if (hashOf(envelope) !== hash) throw new Error("The stored report doesn't match its fingerprint.");
  return envelope;
}

/** Split report text into its markdown and its claims block. */
export function parseReport(text: string): { markdown: string; claims: Record<string, unknown> | null } {
  const m = text.match(/```claims\s*([\s\S]*?)```\s*$/);
  if (!m) return { markdown: text.trim(), claims: null };
  let claims: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(m[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) claims = parsed as Record<string, unknown>;
  } catch {
    claims = null;
  }
  return { markdown: text.slice(0, m.index).trim(), claims };
}

export function withClaims(markdown: string, claims: Record<string, unknown>): string {
  return `${markdown.trim()}\n\n\`\`\`claims\n${JSON.stringify(claims)}\n\`\`\``;
}
