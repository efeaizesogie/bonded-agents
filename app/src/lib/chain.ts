// Read helpers shared by the app, the agent and job pages, and the share card.
import type { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { getReadonlyProgram, RPC_URL, statusName, type BondedProgram, type StatusName } from "./program";
import { taskTitle } from "./tasks";

export type AgentInfo = {
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

export type JobInfo = {
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

/** Byte offset of Job.agent: 8 (discriminator) + 32 (client) + 8 (job_id). */
const JOB_AGENT_OFFSET = 48;
/** Byte offset of Job.client: right after the discriminator. */
const JOB_CLIENT_OFFSET = 8;

/** Retry an RPC call when the public devnet RPC rate-limits us (HTTP 429). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!/429|Too many requests|rate limit|fetch failed/i.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1) + Math.random() * 400));
    }
  }
  throw last;
}

export function readonlyProgram(): BondedProgram {
  return getReadonlyProgram(new Connection(RPC_URL, "confirmed"));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJob(key: PublicKey, a: any): JobInfo {
  return {
    key,
    client: a.client,
    agent: a.agent,
    payment: a.payment,
    requiredStake: a.requiredStake,
    status: statusName(a.status),
    spec: a.spec,
    result: a.result,
    disputeReason: a.disputeReason,
    verdict: a.verdict,
    slashedAmount: a.slashedAmount,
    createdAt: a.createdAt.toNumber(),
    submittedAt: a.submittedAt.toNumber(),
    feePaid: a.feePaid,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAgent(key: PublicKey, a: any): AgentInfo {
  return {
    key,
    authority: a.authority,
    name: a.name,
    model: a.model,
    bond: a.bond,
    locked: a.locked,
    jobsCompleted: a.jobsCompleted,
    jobsSlashed: a.jobsSlashed,
    totalEarned: a.totalEarned,
    totalSlashed: a.totalSlashed,
    createdAt: a.createdAt.toNumber(),
  };
}

export async function fetchAgent(program: BondedProgram, address: PublicKey): Promise<AgentInfo | null> {
  const a = await withRetry(() => program.account.agent.fetchNullable(address));
  return a ? toAgent(address, a) : null;
}

export async function fetchJob(program: BondedProgram, address: PublicKey): Promise<JobInfo | null> {
  const j = await withRetry(() => program.account.job.fetchNullable(address));
  return j ? toJob(address, j) : null;
}

/** Every job an agent took, read with a filter instead of scanning all jobs. */
export async function fetchJobsByAgent(program: BondedProgram, agent: PublicKey): Promise<JobInfo[]> {
  const rows = await withRetry(() =>
    program.account.job.all([{ memcmp: { offset: JOB_AGENT_OFFSET, bytes: agent.toBase58() } }]),
  );
  return rows.map(({ publicKey, account }) => toJob(publicKey, account)).sort((x, y) => y.createdAt - x.createdAt);
}

export async function fetchJobsByClient(program: BondedProgram, client: PublicKey): Promise<JobInfo[]> {
  const rows = await withRetry(() =>
    program.account.job.all([{ memcmp: { offset: JOB_CLIENT_OFFSET, bytes: client.toBase58() } }]),
  );
  return rows.map(({ publicKey, account }) => toJob(publicKey, account)).sort((x, y) => y.createdAt - x.createdAt);
}

export function isAddress(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

// ---------- categories ----------
// Stored as a tag at the start of the job text ("[writing] …"), so they work
// with the deployed program; a dedicated on-chain field needs a program upgrade.
export const CATEGORIES = [
  { key: "token", label: "Token check" },
  { key: "tx", label: "Transaction" },
  { key: "wallet", label: "Wallet" },
  { key: "audit", label: "Code audit" },
  { key: "writing", label: "Writing" },
  { key: "research", label: "Research" },
  { key: "code", label: "Code" },
  { key: "data", label: "Data" },
  { key: "other", label: "Other" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function tagSpec(category: CategoryKey, text: string): string {
  return `[${category}] ${text.trim()}`;
}

export function parseSpec(spec: string): { category: CategoryKey; text: string } {
  const m = spec.match(/^\[(token|tx|wallet|audit|writing|research|code|data|other)\]\s*/i);
  if (!m) return { category: "other", text: spec };
  return { category: m[1].toLowerCase() as CategoryKey, text: taskTitle(spec) ?? spec.slice(m[0].length) };
}

export const categoryLabel = (k: CategoryKey) => CATEGORIES.find((c) => c.key === k)?.label ?? "Other";
