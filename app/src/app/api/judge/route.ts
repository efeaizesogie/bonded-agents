import { NextResponse } from "next/server";
import { judgeJob } from "@/lib/judge";
import { LlmKeyError, LlmRateLimitError } from "@/lib/llm";

export const runtime = "nodejs";
// Data-task rulings re-read mainnet and call a free model tier: allow up to 5 minutes.
export const maxDuration = 300;

// POST { job: "<job PDA address>" } — anyone may trigger; the judge reads
// everything from chain and only acts on jobs that are actually Disputed.
export async function POST(req: Request) {
  try {
    const { job } = (await req.json()) as { job?: string };
    if (!job) return NextResponse.json({ error: "missing job" }, { status: 400 });
    const result = await judgeJob(job);
    return NextResponse.json(result);
  } catch (e) {
    let message = e instanceof Error ? e.message : String(e);
    if (e instanceof LlmKeyError) {
      message = `The AI judge can't run: ${e.message} Restart the app after changing app/.env.local, then press Ask the arbiter to rule.`;
    } else if (e instanceof LlmRateLimitError) {
      message = `${e.message} Then press Ask the arbiter to rule.`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
