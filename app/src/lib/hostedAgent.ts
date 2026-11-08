// The hosted agent: an honest bonded agent that runs inside the web app, so a
// job posted on the live site gets worked without anyone's laptop running.
//
// The app calls POST /api/agent/run with a job address right after posting.
// The agent takes the job only if it is still Open and its free bond covers
// the stake, does the work (live mainnet reads for task jobs), stores the
// encrypted report on chain and submits it. Server-only.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { honestTaskReport } from "./agentWork";
import { isZeroKey, sealResult } from "./crypto";
import { chat } from "./llm";
import { agentPda, configPda, getProgram, keypairWallet, RPC_URL, settingsPda, statusName } from "./program";
import { storeReport } from "./report";
import { parseTask } from "./tasks";

export function loadHostedAgent(): Keypair | null {
  const raw = process.env.AGENT_SECRET_KEY?.trim();
  if (!raw) return null;
  return Keypair.fromSecretKey(raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw) as number[]) : bs58.decode(raw));
}

function fitBytes(s: string, max: number): string {
  let out = s;
  while (Buffer.byteLength(out, "utf8") > max) out = out.slice(0, -1);
  return out;
}

export type RunResult =
  | { status: "submitted"; job: string; signature: string; kind: string }
  | { status: "skipped"; job: string; reason: string };

export async function runHostedAgent(jobAddress: string): Promise<RunResult> {
  const kp = loadHostedAgent();
  if (!kp) throw new Error("The hosted agent isn't configured (AGENT_SECRET_KEY is not set).");
  const connection = new Connection(RPC_URL, "confirmed");
  const program = getProgram(connection, keypairWallet(kp));
  const me = agentPda(kp.publicKey);
  const jobKey = new PublicKey(jobAddress);

  const [job, agent, settings] = await Promise.all([
    program.account.job.fetch(jobKey),
    program.account.agent.fetch(me),
    program.account.settings.fetch(settingsPda()),
  ]);
  const status = statusName(job.status);
  const mineInProgress = status === "Accepted" && job.agent.equals(me);
  if (status !== "Open" && !mineInProgress) return { status: "skipped", job: jobAddress, reason: `job is ${status}` };
  if (!mineInProgress && job.requiredStake.gt(agent.bond.sub(agent.locked)))
    return { status: "skipped", job: jobAddress, reason: "not enough free bond for this stake" };

  const clientKey = Uint8Array.from(job.encKey);
  const judgeKey = Uint8Array.from(settings.arbiterEncKey);
  const task = parseTask(job.spec);
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[hosted agent] ${label} +${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Accept the job and do the work at the same time: the work doesn't depend on the accept.
  const accepting = mineInProgress
    ? Promise.resolve()
    : program.methods.acceptJob().accountsStrict({ job: jobKey, agent: me, authority: kp.publicKey }).rpc().then(() => lap("accepted"));
  let result: string;
  if (task && !isZeroKey(clientKey)) {
    const [report] = await Promise.all([honestTaskReport(task.kind, task.input, task.note), accepting]);
    lap("report written");
    result = await storeReport(connection, kp, sealResult(report, clientKey, judgeKey, { compress: true }));
    lap("report stored");
  } else {
    await accepting;
    const text = await chat({
      system:
        "You are a freelance AI agent completing a paid job. Deliver exactly what the spec asks. " +
        "Your answer is stored on-chain, so it must be under 550 characters. Output only the deliverable.",
      user: job.spec,
      maxTokens: 400,
    });
    const answer = fitBytes(text.trim(), 600);
    result = isZeroKey(clientKey) ? answer : sealResult(answer, clientKey, judgeKey);
  }
  const signature = await program.methods
    .submitWork(result)
    .accountsStrict({ job: jobKey, agent: me, authority: kp.publicKey })
    .rpc();
  lap("submitted");
  return { status: "submitted", job: jobAddress, signature, kind: task?.kind ?? "text" };
}

/** Claim payment on this agent's submitted jobs whose review window has passed. */
export async function claimExpired(): Promise<number> {
  const kp = loadHostedAgent();
  if (!kp) return 0;
  const connection = new Connection(RPC_URL, "confirmed");
  const program = getProgram(connection, keypairWallet(kp));
  const me = agentPda(kp.publicKey);
  const [config, settings, jobs] = await Promise.all([
    program.account.config.fetch(configPda()),
    program.account.settings.fetch(settingsPda()),
    program.account.job.all([{ memcmp: { offset: 48, bytes: me.toBase58() } }]),
  ]);
  const now = Math.floor(Date.now() / 1000);
  let claimed = 0;
  for (const { publicKey, account } of jobs) {
    if (statusName(account.status) !== "Submitted") continue;
    if (now <= account.submittedAt.toNumber() + config.reviewWindowSecs.toNumber()) continue;
    await program.methods
      .claimTimeout()
      .accountsStrict({
        settings: settingsPda(),
        treasury: settings.treasury,
        job: publicKey,
        agent: me,
        agentAuthority: kp.publicKey,
        config: configPda(),
        signer: kp.publicKey,
      })
      .rpc();
    claimed++;
  }
  return claimed;
}
