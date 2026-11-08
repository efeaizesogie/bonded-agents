// Ratings and tips, built on Solana's Memo program so they work with the
// deployed Bonded Agents program (no upgrade needed).
//
// A rating is one transaction signed by the job's client:
//   1. optional SOL tip straight to the agent's wallet
//   2. zero-lamport transfers that tag the job and agent accounts, so the rating
//      shows up in their transaction history (that's how it is found again)
//   3. memo "BA1|rate|<job address>|<1-5>"
// When reading, a rating only counts if the signer is that job's client, the
// job belongs to the agent and has settled. One rating per job (the latest).
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { fetchJob, withRetry } from "./chain";
import type { BondedProgram } from "./program";

export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const PREFIX = "BA1|rate|";

export type Rating = { job: string; stars: number; tip: number; at: number | null; signature: string };
export type RatingSummary = { average: number | null; count: number; tips: number; items: Rating[] };

export function buildRatingTx(opts: {
  client: PublicKey;
  job: PublicKey;
  agent: PublicKey; // the agent account (PDA)
  agentWallet: PublicKey;
  stars: number;
  tipSol: number;
}): Transaction {
  const stars = Math.max(1, Math.min(5, Math.round(opts.stars)));
  const tx = new Transaction();
  // Tag the job and the agent so getSignaturesForAddress finds this rating.
  for (const tag of [opts.job, opts.agent]) {
    tx.add(SystemProgram.transfer({ fromPubkey: opts.client, toPubkey: tag, lamports: 0 }));
  }
  if (opts.tipSol > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: opts.client,
        toPubkey: opts.agentWallet,
        lamports: Math.round(opts.tipSol * LAMPORTS_PER_SOL),
      }),
    );
  }
  tx.add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM,
      keys: [{ pubkey: opts.client, isSigner: true, isWritable: false }],
      data: new TextEncoder().encode(`${PREFIX}${opts.job.toBase58()}|${stars}`) as Buffer,
    }),
  );
  return tx;
}

function readMemo(tx: ParsedTransactionWithMeta): string | null {
  for (const ix of tx.transaction.message.instructions) {
    if ("parsed" in ix && ix.programId.equals(MEMO_PROGRAM) && typeof ix.parsed === "string") return ix.parsed;
  }
  return null;
}

function readTip(tx: ParsedTransactionWithMeta, from: PublicKey, to: PublicKey): number {
  let lamports = 0;
  for (const ix of tx.transaction.message.instructions) {
    if (!("parsed" in ix) || ix.program !== "system" || ix.parsed?.type !== "transfer") continue;
    const info = ix.parsed.info as { source: string; destination: string; lamports: number };
    if (info.source === from.toBase58() && info.destination === to.toBase58()) lamports += info.lamports;
  }
  return lamports / LAMPORTS_PER_SOL;
}

/** Ratings an agent received, read from recent transactions to its wallet. */
export async function fetchRatings(
  connection: Connection,
  program: BondedProgram,
  agent: PublicKey,
  agentWallet: PublicKey,
  limit = 100,
): Promise<RatingSummary> {
  // New ratings tag the agent account; older ones only reached the wallet with a tip.
  const [byAgent, byWallet] = await Promise.all([
    withRetry(() => connection.getSignaturesForAddress(agent, { limit })),
    withRetry(() => connection.getSignaturesForAddress(agentWallet, { limit })),
  ]);
  // The signature list already carries each transaction's memo, so only the
  // rating transactions are fetched (one at a time: the public RPC throttles batches).
  const seen = new Set<string>();
  const sigs = [...byAgent, ...byWallet]
    .filter((s) => !s.err && s.memo?.includes(PREFIX) && !seen.has(s.signature) && seen.add(s.signature))
    .sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  const txs: (ParsedTransactionWithMeta | null)[] = [];
  for (const s of sigs) {
    txs.push(
      await withRetry(() =>
        connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }),
      ),
    );
  }
  const latest = new Map<string, Rating>();
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    if (!tx || tx.meta?.err) continue;
    const memo = readMemo(tx);
    if (!memo?.startsWith(PREFIX)) continue;
    const [jobStr, starsStr] = memo.slice(PREFIX.length).split("|");
    const stars = Number(starsStr);
    if (!jobStr || !(stars >= 1 && stars <= 5)) continue;
    let jobKey: PublicKey;
    try {
      jobKey = new PublicKey(jobStr);
    } catch {
      continue;
    }
    if (latest.has(jobStr)) continue; // signatures come newest first
    const job = await fetchJob(program, jobKey);
    const signer = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey;
    if (!job || !signer || !job.client.equals(signer) || !job.agent.equals(agent)) continue;
    if (job.status !== "Completed" && job.status !== "Slashed") continue;
    latest.set(jobStr, {
      job: jobStr,
      stars,
      tip: readTip(tx, signer, agentWallet),
      at: tx.blockTime ?? null,
      signature: sigs[i].signature,
    });
  }
  const items = [...latest.values()];
  const average = items.length ? items.reduce((s, r) => s + r.stars, 0) / items.length : null;
  return { average, count: items.length, tips: items.reduce((s, r) => s + r.tip, 0), items };
}

/** The client's rating on one job, if any (newest wins). */
export async function fetchJobRating(
  connection: Connection,
  job: PublicKey,
  client: PublicKey,
  agentWallet?: PublicKey,
): Promise<Rating | null> {
  const sigs = await withRetry(() => connection.getSignaturesForAddress(job, { limit: 50 }));
  for (const s of sigs) {
    if (s.err || !s.memo?.includes(`${PREFIX}${job.toBase58()}|`)) continue;
    const tx = await withRetry(() =>
      connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }),
    );
    if (!tx || tx.meta?.err) continue;
    const signer = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey;
    if (!signer?.equals(client)) continue; // only the job's client can rate it
    const memo = readMemo(tx);
    const stars = Number(memo?.split("|")[3]);
    if (!(stars >= 1 && stars <= 5)) continue;
    return { job: job.toBase58(), stars, tip: agentWallet ? readTip(tx, signer, agentWallet) : 0, at: tx.blockTime ?? null, signature: s.signature };
  }
  return null;
}
