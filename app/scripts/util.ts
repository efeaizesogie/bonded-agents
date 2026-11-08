import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { getProgram, keypairWallet, RPC_URL } from "../src/lib/program";

export const KEYS_DIR = path.resolve(process.cwd(), "keys");

export function loadKeypair(name: string): Keypair {
  const file = name.endsWith(".json") ? name : path.join(KEYS_DIR, `${name}.json`);
  const bytes = JSON.parse(fs.readFileSync(file, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function programFor(kp: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  return { connection, program: getProgram(connection, keypairWallet(kp)) };
}

export function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
