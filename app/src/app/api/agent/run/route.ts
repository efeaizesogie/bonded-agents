import { NextResponse } from "next/server";
import { claimExpired, runHostedAgent } from "@/lib/hostedAgent";
import { isAddress } from "@/lib/chain";
import { LlmKeyError, LlmRateLimitError } from "@/lib/llm";

export const runtime = "nodejs";
// A task report reads mainnet and calls a free model tier: allow up to 5 minutes.
export const maxDuration = 300;

// POST { job } — the hosted agent tries to take and finish this job. Anyone may
// call it; the agent only acts on Open jobs its free bond can cover.
export async function POST(req: Request) {
  try {
    const { job } = (await req.json()) as { job?: string };
    if (!job || !isAddress(job)) return NextResponse.json({ error: "missing or invalid job" }, { status: 400 });
    const result = await runHostedAgent(job);
    // Housekeeping: collect pay on old jobs whose review window has passed.
    claimExpired().catch(() => undefined);
    return NextResponse.json(result);
  } catch (e) {
    let message = e instanceof Error ? e.message : String(e);
    if (e instanceof LlmKeyError || e instanceof LlmRateLimitError) message = `The hosted agent couldn't reach its model: ${e.message}`;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
