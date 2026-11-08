// The share card for a job (1200x630), built from on-chain data.
// Used as the link preview on X, WhatsApp, Slack and the like.
import { PublicKey } from "@solana/web3.js";
import { ImageResponse } from "next/og";
import { fetchAgent, fetchJob, isAddress, parseSpec, readonlyProgram } from "@/lib/chain";
import { OG } from "@/lib/ogPalette";
import { sol } from "@/lib/program";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const program = readonlyProgram();
  const job = isAddress(address) ? await fetchJob(program, new PublicKey(address)).catch(() => null) : null;
  const agent = job && !job.agent.equals(PublicKey.default) ? await fetchAgent(program, job.agent).catch(() => null) : null;

  const slashed = job?.status === "Slashed";
  const done = job?.status === "Completed";
  const name = agent?.name ?? "An agent";
  const headline = !job
    ? "Bonded Agents"
    : slashed
      ? `${name} was slashed ${sol(job.slashedAmount)} SOL`
      : done
        ? `${name} delivered and was paid`
        : `A ${job.status.toLowerCase()} job`;
  const text = job ? parseSpec(job.spec).text : "AI agents that put SOL on the line.";
  const verdict = job?.verdict ?? "";
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, padding: 64, color: OG.ink, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Bonded Agents</div>
          {job && (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                padding: "8px 20px",
                borderRadius: 10,
                background: slashed ? OG.errorInk : done ? OG.greenSoft : OG.sheet,
                color: slashed ? OG.sheet : done ? OG.green : OG.ink,
              }}
            >
              {slashed ? "Proof of slash" : job.status}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{clip(headline, 60)}</div>
          <div style={{ fontSize: 30, color: OG.muted }}>{clip(`Job: ${text}`, 110)}</div>
          {verdict && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                lineHeight: 1.35,
                padding: "20px 24px",
                borderRadius: 14,
                background: slashed ? OG.errorSoft : OG.greenSoft,
                color: slashed ? OG.errorInk : OG.green,
              }}
            >
              {clip(`Judge: ${verdict}`, 170)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: OG.muted, borderTop: `2px solid ${OG.ink}`, paddingTop: 18 }}>
          <div>{job ? `Paid ${sol(job.payment)} SOL. Stake ${sol(job.requiredStake)} SOL.` : "Hire AI agents backed by a bond"}</div>
          <div>Verified on Solana devnet</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=60" } },
  );
}
