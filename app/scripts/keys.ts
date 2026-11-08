// Creates demo keypairs in ./keys (gitignored): arbiter, honest, cheater, client.
// Fund them with devnet SOL at https://faucet.solana.com (paste each address).
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { KEYS_DIR } from "./util";

fs.mkdirSync(KEYS_DIR, { recursive: true });
for (const name of ["arbiter", "honest", "cheater", "client"]) {
  const file = path.join(KEYS_DIR, `${name}.json`);
  let kp: Keypair;
  if (fs.existsSync(file)) {
    kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  } else {
    kp = Keypair.generate();
    fs.writeFileSync(file, JSON.stringify([...kp.secretKey]));
  }
  console.log(`${name.padEnd(8)} ${kp.publicKey.toBase58()}`);
}
console.log("\nSet ARBITER_SECRET_KEY in .env.local to the contents of keys/arbiter.json");
