// End-to-end helper for the CLI client. Steps:
//   npm run e2e -- fund                     top the client key up from admin
//   npm run e2e -- post <label>             post a job, print its address
//   npm run e2e -- post task "[token] <mint>"   post a real task job (see src/lib/tasks.ts)
//   npm run e2e -- read <job>               what the client, a stranger and the chain see
//   npm run e2e -- approve <job>            approve and pay (fee goes to the treasury)
//   npm run e2e -- dispute <job> <reason>   raise a dispute (then the judge rules)
//   npm run e2e -- state                    agents, jobs, treasury
import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import { clientKeypairFromSignature, isEncrypted, openResult, UNLOCK_MESSAGE } from "../src/lib/crypto";
import { isPointer, loadReport } from "../src/lib/report";
import { configPda, jobPda, lamports, RPC_URL, settingsPda, sol, statusName } from "../src/lib/program";
import { loadKeypair, programFor } from "./util";

const [, , cmd, a1, ...rest] = process.argv;
const client = loadKeypair("client");
const { program } = programFor(client);
const connection = new Connection(RPC_URL, "confirmed");
const sign = (kp: Keypair) => nacl.sign.detached(new TextEncoder().encode(UNLOCK_MESSAGE), kp.secretKey);
const clientKey = clientKeypairFromSignature(sign(client));

if (cmd === "fund") {
  const admin = loadKeypair("admin");
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: client.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL })),
    [admin],
  );
  console.log("client balance", (await connection.getBalance(client.publicKey)) / LAMPORTS_PER_SOL);
} else if (cmd === "post") {
  const jobId = new BN(Date.now());
  const job = jobPda(client.publicKey, jobId);
  const spec =
    a1 === "task"
      ? rest.join(" ")
      : a1 === "honest"
      ? "List 3 short tips for writing a clear bug report. Under 300 characters."
      : "Explain in 3 bullet points why escrow protects buyers. Under 300 characters.";
  await program.methods
    .postJob(jobId, lamports(0.02), lamports(0.5), spec, Array.from(clientKey.publicKey))
    .accountsStrict({ job, client: client.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(job.toBase58());
} else if (cmd === "read") {
  const j = await program.account.job.fetch(new PublicKey(a1));
  console.log("status:", statusName(j.status));
  console.log("on-chain result (what everyone sees):", j.result.slice(0, 60) + (j.result.length > 60 ? "…" : ""));
  const envelope = isPointer(j.result) ? await loadReport(connection, j.result) : j.result;
  if (isPointer(j.result)) console.log("report stored in", j.result.split(":")[2].split(",").length, "memo tx, fingerprint ok");
  console.log("encrypted:", isEncrypted(envelope));
  console.log("client reads:\n" + openResult(envelope, clientKey.secretKey, "client"));
  const stranger = clientKeypairFromSignature(sign(Keypair.generate()));
  try {
    openResult(envelope, stranger.secretKey, "client");
    console.log("stranger reads: YES (bad)");
  } catch (e) {
    console.log("stranger reads: blocked,", (e as Error).message);
  }
} else if (cmd === "approve") {
  const jobKey = new PublicKey(a1);
  const j = await program.account.job.fetch(jobKey);
  const agent = await program.account.agent.fetch(j.agent);
  const st = await program.account.settings.fetch(settingsPda());
  const before = await connection.getBalance(agent.authority);
  const tBefore = await connection.getBalance(st.treasury);
  await program.methods
    .approveWork()
    .accountsStrict({
      job: jobKey,
      agent: j.agent,
      agentAuthority: agent.authority,
      config: configPda(),
      settings: settingsPda(),
      treasury: st.treasury,
      signer: client.publicKey,
    })
    .rpc();
  const after = await program.account.job.fetch(jobKey);
  console.log("status:", statusName(after.status), "| fee:", sol(after.feePaid), "SOL");
  console.log("agent got:", ((await connection.getBalance(agent.authority)) - before) / 1e9, "SOL");
  console.log("treasury got:", ((await connection.getBalance(st.treasury)) - tBefore) / 1e9, "SOL");
} else if (cmd === "dispute") {
  await program.methods
    .raiseDispute(rest.length ? rest.join(" ") : "Filler, it never answered.")
    .accountsStrict({ job: new PublicKey(a1), config: configPda(), client: client.publicKey })
    .rpc();
  console.log("disputed", a1);
} else if (cmd === "state") {
  const st = await program.account.settings.fetch(settingsPda());
  for (const { account: a } of await program.account.agent.all())
    console.log("AGENT", a.name.padEnd(9), "bond", sol(a.bond), "locked", sol(a.locked), "done", a.jobsCompleted, "slashed", a.jobsSlashed);
  for (const { publicKey, account: j } of await program.account.job.all())
    console.log("JOB", publicKey.toBase58().slice(0, 8), statusName(j.status).padEnd(9), "fee", sol(j.feePaid), j.verdict ? "| " + j.verdict.slice(0, 70) : "");
  console.log("treasury", (await connection.getBalance(st.treasury)) / 1e9, "SOL | total fees", sol(st.totalFees), "SOL");
  console.log("client", (await connection.getBalance(client.publicKey)) / 1e9, "SOL");
} else {
  console.log("usage: e2e fund | post <honest|cheat> | read <job> | approve <job> | dispute <job> <reason> | state");
}
