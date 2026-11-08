// Tools the agents use, and the judge re-runs to check their work.
//
// gatherFacts() reads live Solana mainnet (or a GitHub file) and returns:
//   - checks:  key facts with a definite answer (mint authority, fee paid, …).
//              An honest report repeats them; the judge compares a report's
//              claims to a fresh read. "strict" facts can't change over time.
//   - context: a plain-text dump the model writes the report from.
// Escrow and bonds live on devnet; the data being analysed is real mainnet data.
import { Connection, PublicKey, type ParsedAccountData, type ParsedInstruction } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { githubRawUrl, type TaskKind } from "./tasks";

export const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";

export type CheckValue = string | number | boolean | null;
export type Check = { value: CheckValue; strict: boolean; /** relative tolerance for numbers */ tol?: number; label: string };
export type Facts = { kind: TaskKind; asOf: string; checks: Record<string, Check>; context: string };

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const METAPLEX = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  [TOKEN_PROGRAM]: "SPL Token",
  [TOKEN_2022]: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter Aggregator v6",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpools",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "Raydium CLMM",
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: "Meteora DLMM",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: "Metaplex Token Metadata",
  Stake11111111111111111111111111111111111111: "Stake Program",
  Vote111111111111111111111111111111111111111: "Vote Program",
};
export const programLabel = (id: string) => KNOWN_PROGRAMS[id] ?? id;

const conn = () => new Connection(MAINNET_RPC_URL, { commitment: "confirmed", disableRetryOnRateLimit: true });

async function retry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!/429|Too many requests|rate|fetch failed|timeout|ECONNRESET/i.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

const fmt = (n: number, d = 4) => Number(n.toFixed(d));

export async function gatherFacts(kind: TaskKind, input: string): Promise<Facts> {
  const asOf = new Date().toISOString();
  switch (kind) {
    case "token":
      return { kind, asOf, ...(await tokenFacts(input)) };
    case "tx":
      return { kind, asOf, ...(await txFacts(input)) };
    case "wallet":
      return { kind, asOf, ...(await walletFacts(input)) };
    case "audit":
      return { kind, asOf, ...(await auditFacts(input)) };
  }
}

// ---------- token ----------
function readBorshString(buf: Buffer, o: number): [string, number] {
  const len = buf.readUInt32LE(o);
  return [buf.subarray(o + 4, o + 4 + len).toString("utf8").replace(/\0/g, "").trim(), o + 4 + len];
}

async function tokenFacts(mintStr: string) {
  const c = conn();
  const mint = new PublicKey(mintStr);
  const info = await retry(() => c.getParsedAccountInfo(mint));
  const acct = info.value;
  if (!acct) throw new Error("No account exists at that address on mainnet.");
  const data = acct.data as ParsedAccountData;
  if (!data?.parsed || data.parsed.type !== "mint") throw new Error("That address is not a token mint.");
  const p = data.parsed.info as {
    decimals: number;
    supply: string;
    mintAuthority: string | null;
    freezeAuthority: string | null;
    extensions?: { extension: string; state?: Record<string, unknown> }[];
  };
  const program = acct.owner.toBase58() === TOKEN_2022 ? "Token-2022" : "SPL Token";
  const supply = Number(p.supply) / 10 ** p.decimals;
  const exts = p.extensions ?? [];
  const ext = (name: string) => exts.find((e) => e.extension === name)?.state;

  // Name and symbol: the Token-2022 metadata extension, else Metaplex metadata.
  let name = "";
  let symbol = "";
  const tm = ext("tokenMetadata") as { name?: string; symbol?: string } | undefined;
  if (tm) {
    name = tm.name ?? "";
    symbol = tm.symbol ?? "";
  } else {
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX.toBuffer(), mint.toBuffer()], METAPLEX);
    const meta = await retry(() => c.getAccountInfo(pda)).catch(() => null);
    if (meta) {
      const buf = Buffer.from(meta.data);
      let o = 1 + 32 + 32;
      [name, o] = readBorshString(buf, o);
      [symbol] = readBorshString(buf, o);
    }
  }

  const fee = ext("transferFeeConfig") as { newerTransferFee?: { transferFeeBasisPoints?: number } } | undefined;
  const feeBps = fee?.newerTransferFee?.transferFeeBasisPoints ?? 0;
  const permDelegate = (ext("permanentDelegate") as { delegate?: string | null } | undefined)?.delegate ?? null;
  const hook = (ext("transferHook") as { programId?: string | null } | undefined)?.programId ?? null;
  const defaultState = (ext("defaultAccountState") as { accountState?: string } | undefined)?.accountState ?? null;
  const closeAuth = (ext("mintCloseAuthority") as { closeAuthority?: string | null } | undefined)?.closeAuthority ?? null;

  // Holder concentration needs getTokenLargestAccounts, which the public RPC
  // usually refuses. With a MAINNET_RPC_URL (Helius free tier works) it runs.
  let topLine = "Top holders: not available (the public RPC refuses this call; set MAINNET_RPC_URL).";
  let top10: number | null = null;
  let top1: number | null = null;
  try {
    if (!process.env.MAINNET_RPC_URL) throw new Error("public RPC");
    const largest = await retry(() => c.getTokenLargestAccounts(mint), 2);
    const amounts = largest.value.map((a) => a.uiAmount ?? 0);
    if (supply > 0 && amounts.length) {
      top1 = fmt((amounts[0] / supply) * 100, 2);
      top10 = fmt((amounts.slice(0, 10).reduce((s, x) => s + x, 0) / supply) * 100, 2);
      topLine =
        `Top holders (token accounts, may include exchanges and pools): largest ${top1}%, top 10 ${top10}% of supply.\n` +
        largest.value
          .slice(0, 10)
          .map((a, i) => `  ${i + 1}. ${a.address.toBase58()}  ${fmt(((a.uiAmount ?? 0) / supply) * 100, 2)}%`)
          .join("\n");
    }
  } catch {
    /* keep the "not available" line */
  }

  const checks: Record<string, Check> = {
    tokenProgram: { value: program, strict: true, label: "Token program" },
    decimals: { value: p.decimals, strict: true, label: "Decimals" },
    mintAuthority: { value: p.mintAuthority ?? "none", strict: true, label: "Mint authority" },
    freezeAuthority: { value: p.freezeAuthority ?? "none", strict: true, label: "Freeze authority" },
    supply: { value: fmt(supply, 2), strict: false, tol: 0.02, label: "Supply" },
  };
  if (program === "Token-2022") {
    checks.transferFeeBps = { value: feeBps, strict: true, label: "Transfer fee in basis points" };
    checks.permanentDelegate = { value: permDelegate ?? "none", strict: true, label: "Permanent delegate" };
  }
  if (top10 !== null) checks.top10HoldersPct = { value: top10, strict: false, tol: 0.1, label: "Share held by top 10 accounts" };

  const context = [
    `Mint: ${mint.toBase58()}`,
    `Name: ${name || "(no metadata)"}  Symbol: ${symbol || "(none)"}`,
    `Program: ${program}`,
    `Decimals: ${p.decimals}`,
    `Supply: ${supply.toLocaleString("en-US")}`,
    `Mint authority: ${p.mintAuthority ?? "none (no one can mint more)"}`,
    `Freeze authority: ${p.freezeAuthority ?? "none (no one can freeze holders)"}`,
    program === "Token-2022"
      ? `Token-2022 extensions: ${exts.map((e) => e.extension).join(", ") || "none"}\n` +
        `  Transfer fee: ${feeBps} bps\n  Permanent delegate: ${permDelegate ?? "none"}\n` +
        `  Transfer hook program: ${hook ?? "none"}\n  Default account state: ${defaultState ?? "initialized"}\n` +
        `  Mint close authority: ${closeAuth ?? "none"}`
      : "Classic SPL token: no transfer fees, hooks or permanent delegate are possible.",
    topLine,
  ].join("\n");
  return { checks, context };
}

// ---------- transaction ----------
async function txFacts(sig: string) {
  const c = conn();
  const tx = await retry(() => c.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 }));
  if (!tx || !tx.meta) throw new Error("Transaction not found on mainnet.");
  const keys = tx.transaction.message.accountKeys;
  const signers = keys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
  const ixs = [
    ...tx.transaction.message.instructions,
    ...(tx.meta.innerInstructions ?? []).flatMap((i) => i.instructions),
  ];
  const programs = [...new Set(ixs.map((i) => i.programId.toBase58()))];
  const parsed = ixs
    .filter((i): i is ParsedInstruction => "parsed" in i && typeof i.parsed === "object" && i.parsed !== null)
    .slice(0, 25)
    .map((i) => {
      const info = (i.parsed as { type?: string; info?: Record<string, unknown> }).info ?? {};
      const bits = ["source", "destination", "authority", "owner", "mint", "lamports", "amount", "tokenAmount"]
        .filter((k) => k in info)
        .map((k) => `${k}=${typeof info[k] === "object" ? JSON.stringify(info[k]) : info[k]}`);
      return `  ${programLabel(i.programId.toBase58())}: ${(i.parsed as { type?: string }).type ?? "?"} ${bits.join(" ")}`;
    });

  const solChanges = keys
    .map((k, i) => ({ who: k.pubkey.toBase58(), d: (tx.meta!.postBalances[i] - tx.meta!.preBalances[i]) / 1e9 }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 10);

  const pre = new Map((tx.meta.preTokenBalances ?? []).map((b) => [b.accountIndex, b]));
  const tokenChanges = (tx.meta.postTokenBalances ?? [])
    .map((post) => {
      const before = pre.get(post.accountIndex);
      const d = (post.uiTokenAmount.uiAmount ?? 0) - (before?.uiTokenAmount.uiAmount ?? 0);
      return { owner: post.owner ?? "?", mint: post.mint, d };
    })
    .filter((x) => Math.abs(x.d) > 0)
    .slice(0, 12);

  const ok = tx.meta.err === null;
  const checks: Record<string, Check> = {
    status: { value: ok ? "success" : "failed", strict: true, label: "Status" },
    feeLamports: { value: tx.meta.fee, strict: true, label: "Fee in lamports" },
    feePayer: { value: signers[0] ?? null, strict: true, label: "Fee payer" },
    programCount: { value: programs.length, strict: true, label: "Programs called" },
  };
  const context = [
    `Signature: ${sig}`,
    `Status: ${ok ? "success" : `failed: ${JSON.stringify(tx.meta.err)}`}`,
    `Time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "unknown"}  Slot: ${tx.slot}`,
    `Fee: ${tx.meta.fee} lamports (${tx.meta.fee / 1e9} SOL)`,
    `Signers: ${signers.join(", ")}`,
    `Programs called: ${programs.map(programLabel).join(", ")}`,
    `Decoded instructions:\n${parsed.join("\n") || "  (none decodable)"}`,
    `SOL balance changes:\n${solChanges.map((x) => `  ${x.who}  ${x.d > 0 ? "+" : ""}${fmt(x.d, 9)} SOL`).join("\n") || "  none"}`,
    `Token balance changes:\n${tokenChanges.map((x) => `  owner ${x.owner}  mint ${x.mint}  ${x.d > 0 ? "+" : ""}${fmt(x.d, 6)}`).join("\n") || "  none"}`,
    `Log (first lines):\n${(tx.meta.logMessages ?? []).slice(0, 18).map((l) => `  ${l.slice(0, 160)}`).join("\n")}`,
  ].join("\n");
  return { checks, context };
}

// ---------- wallet ----------
async function walletFacts(addr: string) {
  const c = conn();
  const owner = new PublicKey(addr);
  const [lamports, classic, t22, sigs] = await Promise.all([
    retry(() => c.getBalance(owner)),
    retry(() => c.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_PROGRAM) })),
    retry(() => c.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_2022) })),
    retry(() => c.getSignaturesForAddress(owner, { limit: 20 })),
  ]);
  type TA = { mint: string; tokenAmount: { uiAmount: number | null }; delegate?: string; delegatedAmount?: { uiAmount: number | null } };
  const accounts = [...classic.value, ...t22.value].map((a) => (a.account.data as ParsedAccountData).parsed.info as TA);
  const held = accounts.filter((a) => (a.tokenAmount.uiAmount ?? 0) > 0).sort((a, b) => (b.tokenAmount.uiAmount ?? 0) - (a.tokenAmount.uiAmount ?? 0));
  const approvals = accounts.filter((a) => a.delegate);
  const empty = accounts.length - held.length;
  const failed = sigs.filter((s) => s.err).length;

  const checks: Record<string, Check> = {
    solBalance: { value: fmt(lamports / 1e9, 4), strict: false, tol: 0.1, label: "SOL balance" },
    tokensHeld: { value: held.length, strict: false, tol: 0.2, label: "Tokens held" },
    openApprovals: { value: approvals.length, strict: false, tol: 0, label: "Open token approvals" },
  };
  const context = [
    `Wallet: ${addr}`,
    `SOL balance: ${lamports / 1e9}`,
    `Token accounts: ${accounts.length} (${held.length} with a balance, ${empty} empty and closable to reclaim rent, about 0.002 SOL each)`,
    `Largest holdings (mint, amount):\n${held.slice(0, 12).map((a) => `  ${a.mint}  ${a.tokenAmount.uiAmount}`).join("\n") || "  none"}`,
    `Open approvals (another address may move these tokens):\n${approvals.map((a) => `  mint ${a.mint} delegate ${a.delegate} amount ${a.delegatedAmount?.uiAmount ?? "?"}`).join("\n") || "  none"}`,
    `Recent transactions (newest first, ${sigs.length} shown, ${failed} failed):\n${sigs
      .map((s) => `  ${s.blockTime ? new Date(s.blockTime * 1000).toISOString().slice(0, 16) : "?"} ${s.err ? "FAILED" : "ok"} ${s.signature.slice(0, 20)}…${s.memo ? ` memo: ${s.memo.slice(0, 60)}` : ""}`)
      .join("\n")}`,
  ].join("\n");
  return { checks, context };
}

// ---------- code audit ----------
const MAX_CODE_BYTES = 60_000;

async function auditFacts(link: string) {
  const raw = githubRawUrl(link);
  if (!raw) throw new Error("Use a public github.com file link.");
  const res = await fetch(raw, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for that file.`);
  const text = (await res.text()).slice(0, MAX_CODE_BYTES);
  const lines = text.split("\n");
  const sha = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const checks: Record<string, Check> = {
    lines: { value: lines.length, strict: true, label: "Lines reviewed" },
    fileSha256: { value: sha, strict: true, label: "File fingerprint" },
  };
  const context =
    `File: ${raw}\nLines: ${lines.length}  sha256/16: ${sha}\n\n` +
    lines.map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join("\n");
  return { checks, context };
}

// ---------- comparing a report to the facts ----------
export type ClaimCheck = { key: string; label: string; claimed: CheckValue | undefined; actual: CheckValue; ok: boolean; strict: boolean };

/** Compare the claims block of a report with a fresh read of the facts. */
export function compareClaims(claims: Record<string, unknown> | null, facts: Facts): ClaimCheck[] {
  return Object.entries(facts.checks).map(([key, f]) => {
    const claimed = claims?.[key] as CheckValue | undefined;
    let ok: boolean;
    if (claimed === undefined) ok = false;
    else if (typeof f.value === "number" && typeof claimed === "number") {
      const tol = f.tol ?? 0;
      ok = tol === 0 ? claimed === f.value : Math.abs(claimed - f.value) <= Math.max(Math.abs(f.value) * tol, 1e-9);
    } else ok = String(claimed).trim().toLowerCase() === String(f.value).trim().toLowerCase();
    return { key, label: f.label, claimed, actual: f.value, ok, strict: f.strict };
  });
}

/** The claims an honest agent states: exactly the checkable facts it read. */
export function claimsFrom(facts: Facts): Record<string, CheckValue> {
  return Object.fromEntries(Object.entries(facts.checks).map(([k, c]) => [k, c.value]));
}
