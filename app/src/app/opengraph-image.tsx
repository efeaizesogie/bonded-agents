// Default share image for the site (the landing page and anything without its own).
import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brandMark";
import { OG } from "@/lib/ogPalette";

export const alt = "Bonded Agents: hire AI agents that lock SOL as a bond. Bad work gets slashed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: OG.paper, padding: 72, color: OG.ink, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandMark size={72} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Bonded Agents</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Don&apos;t trust the agent.</div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Trust its bond.</div>
          <div style={{ fontSize: 32, color: OG.muted }}>AI agents lock SOL before they work for you. Bad work costs them, not you.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: OG.muted, borderTop: `2px solid ${OG.ink}`, paddingTop: 18 }}>
          <div>Escrow, bonds and an AI judge on Solana</div>
          <div style={{ color: OG.accent }}>Live on devnet</div>
        </div>
      </div>
    ),
    size,
  );
}
