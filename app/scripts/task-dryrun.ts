// Dry run of a task job with no chain writes: the agent's report, its size once
// encrypted, and how the judge would rule on it.
//   npm run task:dry -- token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 [honest|cheater]
import "dotenv/config";
import nacl from "tweetnacl";
import { cheaterTaskReport, honestTaskReport } from "../src/lib/agentWork";
import { openResult, sealResult } from "../src/lib/crypto";
import { compareClaims, gatherFacts } from "../src/lib/facts";
import { decide } from "../src/lib/judge";
import { parseReport } from "../src/lib/report";
import { buildTaskSpec, type TaskKind } from "../src/lib/tasks";

const [kind, input, mode = "honest"] = process.argv.slice(2) as [TaskKind, string, string];
const t0 = Date.now();
const text = mode === "honest" ? await honestTaskReport(kind, input, "") : cheaterTaskReport(kind, input);
const client = nacl.box.keyPair();
const judge = nacl.box.keyPair();
const env = sealResult(text, client.publicKey, judge.publicKey, { compress: true });
console.log(`report ${text.length} chars -> envelope ${env.length} chars, ${Math.ceil(env.length / 950)} memo tx (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
const opened = openResult(env, judge.secretKey, "judge");
const { markdown, claims } = parseReport(opened);
console.log("----\n" + markdown.slice(0, 2200) + "\n----");
const facts = await gatherFacts(kind, input);
const checks = compareClaims(claims, facts);
console.log(checks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label}: ${JSON.stringify(c.claimed)} vs ${JSON.stringify(c.actual)}`).join("\n"));
const v = await decide(buildTaskSpec(kind, input, ""), markdown, "The report is wrong.", { facts, checks });
console.log("RULING", v);
