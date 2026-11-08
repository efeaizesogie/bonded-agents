// Send the server secrets to your Vercel project (Production). Run it yourself:
//   npm run vercel:env
// Reads them from app/.env.local and app/keys/, never prints them, and replaces
// any value already set. Then redeploy: npx vercel deploy --prod
import "dotenv/config";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const local = dotenv.parse(fs.existsSync(".env.local") ? fs.readFileSync(".env.local") : "");
const key = (name: string) => {
  const file = path.join("keys", `${name}.json`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : undefined;
};

const vars: Record<string, string | undefined> = {
  NVIDIA_API_KEY: local.NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY,
  ARBITER_SECRET_KEY: key("arbiter"),
  AGENT_SECRET_KEY: key("honest"), // the hosted agent, Atlas
  FAUCET_SECRET_KEY: key("faucet"),
};

for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log(`skip ${name}: not found locally`);
    continue;
  }
  const r = spawnSync("npx", ["-y", "vercel@latest", "env", "add", name, "production", "--force", "--sensitive"], {
    input: value,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(r.status === 0 ? `set ${name}` : `failed ${name}: ${(r.stderr || r.stdout).split("\n").filter(Boolean).pop()}`);
}
