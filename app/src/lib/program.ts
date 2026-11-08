import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { IDL, type BondedAgents } from "./idl";

export const PROGRAM_ID = new PublicKey(IDL.address);
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? "https://api.devnet.solana.com";

export type BondedProgram = Program<BondedAgents>;

export function getProgram(connection: Connection, wallet: Wallet): BondedProgram {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<BondedAgents>(IDL as BondedAgents, provider);
}

/** Wallet backed by a local Keypair (server arbiter + CLI agents). Anchor's
 *  own `Wallet` class is Node-only and not exported in bundled builds. */
export function keypairWallet(kp: Keypair): Wallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}

/** Read-only program (no signer) for fetching accounts. */
export function getReadonlyProgram(connection: Connection): BondedProgram {
  const dummy = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error("read-only");
    },
    signAllTransactions: async () => {
      throw new Error("read-only");
    },
  } as unknown as Wallet;
  return getProgram(connection, dummy);
}

// ---------- PDAs ----------
export const configPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];

/** Fees, treasury and the judge's encryption key (added in v2). */
export const settingsPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("settings")], PROGRAM_ID)[0];

export const agentPda = (authority: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("agent"), authority.toBuffer()], PROGRAM_ID)[0];

export const jobPda = (client: PublicKey, jobId: BN) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("job"), client.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];

// ---------- helpers ----------
export const sol = (lamports: BN | number | bigint) =>
  Number(lamports.toString()) / LAMPORTS_PER_SOL;

export const lamports = (solAmount: number) => new BN(Math.round(solAmount * LAMPORTS_PER_SOL));

export type StatusName = "Open" | "Accepted" | "Submitted" | "Disputed" | "Completed" | "Slashed";

/** Anchor decodes enums as `{ open: {} }` — turn that into "Open". */
export function statusName(status: object): StatusName {
  const key = Object.keys(status)[0] ?? "open";
  return (key.charAt(0).toUpperCase() + key.slice(1)) as StatusName;
}

/**
 * Trust score 0-100: completed-vs-slashed track record, weighted by how much
 * SOL the agent has at stake. A fresh agent with a big bond starts at ~50.
 */
export function trustScore(a: {
  jobsCompleted: number;
  jobsSlashed: number;
  bond: BN;
}): number {
  const done = a.jobsCompleted + a.jobsSlashed;
  const record = (a.jobsCompleted + 1) / (done + 2); // Laplace-smoothed success rate
  const stake = Math.min(1, sol(a.bond) / 2); // full credit at 2 SOL bonded
  return Math.round(100 * (0.7 * record + 0.3 * stake));
}

export const short = (k: PublicKey | string) => {
  const s = k.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (addr: PublicKey | string) =>
  `https://explorer.solana.com/address/${addr.toString()}?cluster=devnet`;
