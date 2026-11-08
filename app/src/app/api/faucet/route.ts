import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";
import { isAddress } from "@/lib/chain";
import { RPC_URL } from "@/lib/program";

export const runtime = "nodejs";
export const maxDuration = 60;

// Devnet only: tops up a nearly empty test wallet so visitors can post a job.
// The public devnet airdrop is often closed, so the app keeps its own small faucet.
const DRIP = 0.2 * LAMPORTS_PER_SOL;
const ONLY_BELOW = 0.05 * LAMPORTS_PER_SOL;

function faucetKey(): Keypair | null {
  const raw = process.env.FAUCET_SECRET_KEY?.trim();
  if (!raw) return null;
  return Keypair.fromSecretKey(raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw) as number[]) : bs58.decode(raw));
}

export async function POST(req: Request) {
  try {
    if (!/devnet/i.test(RPC_URL)) return NextResponse.json({ error: "The faucet only runs on devnet." }, { status: 400 });
    const faucet = faucetKey();
    if (!faucet) return NextResponse.json({ error: "The app's faucet isn't set up. Use faucet.solana.com." }, { status: 503 });
    const { address } = (await req.json()) as { address?: string };
    if (!address || !isAddress(address)) return NextResponse.json({ error: "Invalid address." }, { status: 400 });
    const to = new PublicKey(address);
    const connection = new Connection(RPC_URL, "confirmed");
    const balance = await connection.getBalance(to);
    if (balance >= ONLY_BELOW)
      return NextResponse.json({ error: `This wallet already has ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL, enough to post a job.` }, { status: 429 });
    if ((await connection.getBalance(faucet.publicKey)) < DRIP + 10_000)
      return NextResponse.json({ error: "The app's faucet is empty right now. Use faucet.solana.com." }, { status: 503 });
    const signature = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: to, lamports: DRIP })),
      [faucet],
    );
    return NextResponse.json({ signature, sol: DRIP / LAMPORTS_PER_SOL });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
