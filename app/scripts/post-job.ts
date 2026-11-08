// Post a job from the CLI (the web UI does the same thing).
// npm run demo:post -- --spec "Summarize ..." --pay 0.1 --stake 0.5
import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import nacl from "tweetnacl";
import { clientKeypairFromSignature, UNLOCK_MESSAGE } from "../src/lib/crypto";
import { jobPda, lamports } from "../src/lib/program";
import { arg, loadKeypair, programFor } from "./util";

const client = loadKeypair(arg("as", "client")!);
const spec =
  arg("spec") ??
  "Explain in 3 bullet points why Solana's low fees matter for AI agents paying per API call. Plain English, under 400 characters.";
const pay = Number(arg("pay", "0.05"));
const stake = Number(arg("stake", "0.5"));

const { program } = programFor(client);
const jobId = new BN(Date.now());
const job = jobPda(client.publicKey, jobId);
const sig = await program.methods
  .postJob(
    jobId,
    lamports(pay),
    lamports(stake),
    spec,
    Array.from(clientKeypairFromSignature(nacl.sign.detached(new TextEncoder().encode(UNLOCK_MESSAGE), client.secretKey)).publicKey),
  )
  .accountsStrict({ job, client: client.publicKey, systemProgram: SystemProgram.programId })
  .rpc();
console.log(`Job posted ${job.toBase58()}\n  pay=${pay} SOL stake=${stake} SOL\n  tx ${sig}`);
