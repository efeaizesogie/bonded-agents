// One-time setup after deploying the program. Safe to re-run.
//   npm run setup -- [--fee-bps 300] [--slash-fee-bps 1000] [--window 300] [--slash-bps 5000] [--fund-from honest]
//
// Uses local keys in ./keys (git-ignored):
//   admin.json     owns the config and settings (and should own program upgrades)
//   arbiter.json   the AI judge's signing key
//   treasury.json  receives platform fees (change it later with update_settings)
import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  type Keypair,
} from "@solana/web3.js";
import { arbiterKeypairFromSecret } from "../src/lib/crypto";
import { configPda, RPC_URL, settingsPda } from "../src/lib/program";
import { arg, loadKeypair, programFor } from "./util";

const admin = loadKeypair("admin");
const arbiter = loadKeypair("arbiter");
const treasury = loadKeypair("treasury");
const funder = loadKeypair(arg("fund-from", "honest")!);
const feeBps = Number(arg("fee-bps", "300"));
const slashFeeBps = Number(arg("slash-fee-bps", "1000"));
const windowSecs = Number(arg("window", "300"));
const slashBps = Number(arg("slash-bps", "5000"));

const connection = new Connection(RPC_URL, "confirmed");

/** Top an account up to `target` SOL from the funder wallet. */
async function topUp(name: string, kp: Keypair, target: number) {
  const have = (await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
  if (have >= target) return console.log(`${name} has ${have.toFixed(4)} SOL`);
  const need = Math.ceil((target - have) * LAMPORTS_PER_SOL);
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: kp.publicKey, lamports: need })),
    [funder],
  );
  console.log(`${name} topped up to ${target} SOL`);
}

// The treasury must stay above the rent-exempt minimum or small fees would fail.
await topUp("admin", admin, 0.02);
await topUp("treasury", treasury, 0.002);

const { program } = programFor(admin);
const config = configPda();
const settings = settingsPda();

if (!(await program.account.config.fetchNullable(config))) {
  const sig = await program.methods
    .initializeConfig(arbiter.publicKey, new BN(windowSecs), slashBps)
    .accountsStrict({ config, admin: admin.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("config created:", sig);
} else console.log("config already exists");

const judgeKey = Array.from(arbiterKeypairFromSecret(arbiter.secretKey).publicKey);
if (!(await program.account.settings.fetchNullable(settings))) {
  const sig = await program.methods
    .initializeSettings(treasury.publicKey, feeBps, slashFeeBps, judgeKey)
    .accountsStrict({ settings, config, admin: admin.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("settings created:", sig);
} else {
  const sig = await program.methods
    .updateSettings(treasury.publicKey, feeBps, slashFeeBps, judgeKey)
    .accountsStrict({ settings, admin: admin.publicKey })
    .rpc();
  console.log("settings updated:", sig);
}

const cfg = await program.account.config.fetch(config);
const st = await program.account.settings.fetch(settings);
console.log({
  admin: cfg.admin.toBase58(),
  arbiter: cfg.arbiter.toBase58(),
  reviewWindowSecs: cfg.reviewWindowSecs.toString(),
  slashBps: cfg.slashBps,
  treasury: st.treasury.toBase58(),
  feeBps: st.feeBps,
  slashFeeBps: st.slashFeeBps,
});
