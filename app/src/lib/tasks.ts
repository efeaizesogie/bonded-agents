// Real jobs an agent can be hired for. Each one takes a single input (a mint,
// a signature, a wallet or a GitHub file), the agent gathers live facts with
// tools, and the judge re-gathers the same facts to check the report.
//
// A job's text on-chain looks like: "[token] DezX…B263 | anything else to look at"
import { PublicKey } from "@solana/web3.js";

export type TaskKind = "token" | "tx" | "wallet" | "audit";

export type TaskDef = {
  kind: TaskKind;
  label: string;
  /** What the client gets, in one line. */
  pitch: string;
  inputLabel: string;
  placeholder: string;
  examples: { label: string; value: string }[];
  validate: (input: string) => string | null; // error message or null
};

const BASE58_SIG = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

function isPubkey(s: string) {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

/** Only public GitHub files: the judge's server fetches this URL too, so no other hosts. */
export function githubRawUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname === "raw.githubusercontent.com") return u.toString();
  if (u.hostname === "github.com") {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  return null;
}

export const TASKS: TaskDef[] = [
  {
    kind: "token",
    label: "Token safety check",
    pitch: "Can someone mint more, freeze your coins or take a fee? Who holds the supply?",
    inputLabel: "Token mint address (Solana mainnet)",
    placeholder: "Paste a mint address",
    examples: [
      { label: "BONK", value: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
      { label: "USDC", value: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
      { label: "PYUSD", value: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" },
    ],
    validate: (s) => (isPubkey(s) ? null : "That isn't a Solana address."),
  },
  {
    kind: "tx",
    label: "Explain a transaction",
    pitch: "What a transaction really did, who paid whom, and anything that looks off.",
    inputLabel: "Transaction signature (Solana mainnet)",
    placeholder: "Paste a transaction signature",
    examples: [
      {
        label: "A BONK transfer",
        value: "5orU8xoK5wxBGTiQUSkJ8o2kTDkxkcCbm9p61yv2S55ywxehzUyxn6buYNPHZVR25swHk3Bqf1rkjvymtUF6Yr9h",
      },
    ],
    validate: (s) => (BASE58_SIG.test(s) ? null : "That isn't a transaction signature."),
  },
  {
    kind: "wallet",
    label: "Wallet checkup",
    pitch: "What a wallet holds, what it has been doing, and any open approvals to revoke.",
    inputLabel: "Wallet address (Solana mainnet)",
    placeholder: "Paste a wallet address",
    examples: [{ label: "A busy hot wallet", value: "8DfHuYFv7VQ6wgcGtVDN2vtFn5ezF52hHNtPWYcqm8hU" }],
    validate: (s) => (isPubkey(s) ? null : "That isn't a Solana address."),
  },
  {
    kind: "audit",
    label: "Code audit",
    pitch: "A security review of one source file, with severity and line numbers.",
    inputLabel: "Public GitHub file link",
    placeholder: "https://github.com/owner/repo/blob/main/src/lib.rs",
    examples: [
      {
        label: "Escrow: take offer",
        value: "https://github.com/solana-foundation/program-examples/blob/main/tokens/escrow/anchor/programs/escrow/src/instructions/take_offer.rs",
      },
    ],
    validate: (s) => (githubRawUrl(s) ? null : "Use a public github.com file link."),
  },
];

export const taskDef = (k: string) => TASKS.find((t) => t.kind === k);

export function buildTaskSpec(kind: TaskKind, input: string, note: string): string {
  const n = note.trim().replace(/\s+/g, " ");
  return `[${kind}] ${input.trim()}${n ? ` | ${n}` : ""}`;
}

/** Split a job's text into its task, input and note. Null for free-form jobs. */
export function parseTask(spec: string): { kind: TaskKind; input: string; note: string } | null {
  const m = spec.match(/^\[(token|tx|wallet|audit)\]\s*([^\s|]+)\s*(?:\|\s*([\s\S]*))?$/i);
  if (!m) return null;
  return { kind: m[1].toLowerCase() as TaskKind, input: m[2], note: (m[3] ?? "").trim() };
}

/** A short, human line for a task job, used on cards and the feed. */
export function taskTitle(spec: string): string | null {
  const t = parseTask(spec);
  if (!t) return null;
  const def = taskDef(t.kind)!;
  const subject = t.kind === "audit" ? t.input.replace(/^https:\/\/(github\.com|raw\.githubusercontent\.com)\//, "") : short(t.input);
  return `${def.label}: ${subject}${t.note ? `. ${t.note}` : ""}`;
}

function short(s: string) {
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s;
}
