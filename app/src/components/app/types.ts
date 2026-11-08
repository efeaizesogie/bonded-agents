import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type { StatusName } from "@/lib/program";

export type AgentRow = {
  key: PublicKey;
  authority: PublicKey;
  name: string;
  model: string;
  bond: BN;
  locked: BN;
  jobsCompleted: number;
  jobsSlashed: number;
  totalEarned: BN;
  totalSlashed: BN;
  createdAt: number;
};

export type JobRow = {
  key: PublicKey;
  client: PublicKey;
  agent: PublicKey;
  payment: BN;
  requiredStake: BN;
  status: StatusName;
  spec: string;
  result: string;
  disputeReason: string;
  verdict: string;
  slashedAmount: BN;
  createdAt: number;
  submittedAt: number;
  feePaid: BN;
};

export type Fees = { feeBps: number; slashFeeBps: number; totalFees: BN; treasury: PublicKey } | null;

export type Toast = { kind: "ok" | "err" | "info"; text: string; link?: string };

/** Turn the common Solana failures into a sentence a person can act on. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/no record of a prior credit|insufficient (funds|lamports)/i.test(raw))
    return "This wallet doesn't have enough devnet SOL. Get free test SOL at faucet.solana.com, then try again.";
  if (/program that does not exist|ProgramAccountNotFound|Unsupported program id/i.test(raw))
    return "The Bonded Agents program isn't deployed on devnet yet.";
  if (/AccountNotInitialized/i.test(raw) && /settings/i.test(raw))
    return "The platform settings aren't set up yet. The admin needs to run the settings setup once.";
  if (/User rejected|rejected the request/i.test(raw)) return "You cancelled the request in your wallet.";
  if (/429|Too many requests/i.test(raw)) return "The devnet RPC is busy right now. Wait a few seconds and try again.";
  return raw;
}

export const pct = (bps: number) => `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
