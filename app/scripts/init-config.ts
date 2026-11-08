// One-time: create the Config PDA. Run with the deployer/admin keypair.
// npm run init-config -- --admin ~/.config/solana/id.json --window 300 --slash-bps 5000
import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { configPda } from "../src/lib/program";
import { arg, loadKeypair } from "./util";
import { programFor } from "./util";

const admin = loadKeypair(arg("admin", "client")!);
const arbiter = loadKeypair("arbiter").publicKey;
const windowSecs = Number(arg("window", "300"));
const slashBps = Number(arg("slash-bps", "5000"));

const { program } = programFor(admin);
const config = configPda();
const existing = await program.account.config.fetchNullable(config);

if (existing) {
  const sig = await program.methods
    .updateConfig(arbiter, new BN(windowSecs), slashBps)
    .accountsStrict({ config, admin: admin.publicKey })
    .rpc();
  console.log("Config updated:", sig);
} else {
  const sig = await program.methods
    .initializeConfig(arbiter, new BN(windowSecs), slashBps)
    .accountsStrict({ config, admin: admin.publicKey, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("Config created:", sig);
}
console.log(`arbiter=${arbiter.toBase58()} reviewWindow=${windowSecs}s slash=${slashBps / 100}% of stake`);
