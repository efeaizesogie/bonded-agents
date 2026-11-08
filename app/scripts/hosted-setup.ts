// Prepare the hosted agent and the app's devnet faucet.
//   npm run hosted                         balances only (creates keys/faucet.json if missing)
//   npm run hosted -- --faucet 1 --bond 1  move 1 SOL admin -> faucet, add 1 SOL to the agent's bond
// The hosted agent is the "honest" key (Atlas). Then run `npm run vercel:env` to
// send AGENT_SECRET_KEY and FAUCET_SECRET_KEY to Vercel.
import { Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { agentPda, lamports, sol } from "../src/lib/program";
import { arg, KEYS_DIR, loadKeypair, programFor } from "./util";

const faucetFile = path.join(KEYS_DIR, "faucet.json");
if (!fs.existsSync(faucetFile)) {
  fs.writeFileSync(faucetFile, JSON.stringify([...Keypair.generate().secretKey]));
  console.log("created keys/faucet.json");
}
const admin = loadKeypair("admin");
const honest = loadKeypair("honest");
const faucet = loadKeypair("faucet");
const { connection, program } = programFor(honest);

const fundFaucet = Number(arg("faucet", "0"));
const addBond = Number(arg("bond", "0"));
const send = (to: Keypair["publicKey"], amount: number) =>
  sendAndConfirmTransaction(
    connection,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: to, lamports: Math.round(amount * LAMPORTS_PER_SOL) })),
    [admin],
  );

if (fundFaucet > 0) console.log(`faucet funded +${fundFaucet} SOL`, await send(faucet.publicKey, fundFaucet));
if (addBond > 0) {
  const have = (await connection.getBalance(honest.publicKey)) / LAMPORTS_PER_SOL;
  if (have < addBond + 0.05) console.log(`agent wallet topped up`, await send(honest.publicKey, addBond + 0.05 - have));
  const sig = await program.methods
    .addBond(lamports(addBond))
    .accountsStrict({ agent: agentPda(honest.publicKey), authority: honest.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`bond +${addBond} SOL`, sig);
}

for (const [name, kp] of [["admin", admin], ["agent (honest)", honest], ["faucet", faucet]] as const)
  console.log(name.padEnd(15), kp.publicKey.toBase58(), ((await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL).toFixed(4), "SOL");
const a = await program.account.agent.fetch(agentPda(honest.publicKey));
console.log(`Atlas bond ${sol(a.bond)} SOL, locked ${sol(a.locked)} SOL, free ${sol(a.bond.sub(a.locked))} SOL`);
