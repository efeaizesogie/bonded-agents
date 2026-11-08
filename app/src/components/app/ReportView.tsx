"use client";
// Renders an agent's report: a small, safe markdown subset (no raw HTML) and
// the key facts the agent stated, which the judge checks against the chain.
import { Fragment, type ReactNode } from "react";
import { parseReport } from "@/lib/report";

const CLAIM_LABELS: Record<string, string> = {
  tokenProgram: "Token program",
  decimals: "Decimals",
  mintAuthority: "Mint authority",
  freezeAuthority: "Freeze authority",
  supply: "Supply",
  transferFeeBps: "Transfer fee in basis points",
  permanentDelegate: "Permanent delegate",
  top10HoldersPct: "Share held by top 10 accounts",
  status: "Status",
  feeLamports: "Fee in lamports",
  feePayer: "Fee payer",
  programCount: "Programs called",
  solBalance: "SOL balance",
  tokensHeld: "Tokens held",
  openApprovals: "Open token approvals",
  lines: "Lines reviewed",
  fileSha256: "File fingerprint",
};

function inline(text: string): ReactNode[] {
  // **bold**, `code`, _italic_
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={i++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={i++}>{t.slice(1, -1)}</code>);
    else out.push(<em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function blocks(md: string): ReactNode[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let k = 0;
  const flushPara = () => {
    if (para.length) out.push(<p key={k++}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    out.push(list.ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      out.push(h[1].length <= 2 ? <h4 key={k++}>{inline(h[2])}</h4> : <h5 key={k++}>{inline(h[2])}</h5>);
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out;
}

export function ReportView({ text }: { text: string }) {
  const { markdown, claims } = parseReport(text);
  return (
    <div className="report">
      <div className="report-body">{blocks(markdown)}</div>
      {claims && Object.keys(claims).length > 0 && (
        <div className="report-facts">
          <span className="label">Key facts the judge checks against the chain</span>
          <dl>
            {Object.entries(claims).map(([key, value]) => (
              <Fragment key={key}>
                <dt>{CLAIM_LABELS[key] ?? key}</dt>
                <dd className="num">{typeof value === "number" ? value.toLocaleString("en-US") : String(value)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
