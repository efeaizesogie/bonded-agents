"use client";
// What just happened on the marketplace, in plain words. Seeded from the jobs'
// own timestamps, then grown by comparing each refresh with the last one.
import { useEffect, useMemo, useRef, useState } from "react";
import { parseSpec } from "@/lib/chain";
import { sol } from "@/lib/program";
import type { AgentRow, JobRow } from "./types";

type Item = { id: string; at: number; text: string; tone: "neutral" | "good" | "bad"; href?: string };

const MAX_ITEMS = 8;

function snippet(spec: string) {
  const t = parseSpec(spec).text;
  return t.length > 48 ? `${t.slice(0, 46).trimEnd()}…` : t;
}

export function ActivityFeed({ jobs, agents }: { jobs: JobRow[]; agents: AgentRow[] }) {
  const nameOf = useMemo(() => {
    const m = new Map(agents.map((a) => [a.key.toBase58(), a.name]));
    return (k: string) => m.get(k) ?? "An agent";
  }, [agents]);

  const [live, setLive] = useState<Item[]>([]);
  const prevJobs = useRef<Map<string, JobRow> | null>(null);
  const prevAgents = useRef<Set<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Diff this refresh against the last one.
  useEffect(() => {
    if (!jobs.length && !agents.length) return;
    const t = Date.now();
    const fresh: Item[] = [];
    if (prevJobs.current) {
      for (const j of jobs) {
        const id = j.key.toBase58();
        const before = prevJobs.current.get(id);
        const agent = nameOf(j.agent.toBase58());
        const href = `/app/job/${id}`;
        if (!before) fresh.push({ id: `${id}-posted-live`, at: t, tone: "neutral", text: `New job: “${snippet(j.spec)}” for ${sol(j.payment)} SOL`, href });
        else if (before.status !== j.status) {
          if (j.status === "Accepted") fresh.push({ id: `${id}-acc`, at: t, tone: "neutral", text: `${agent} took a job and locked ${sol(j.requiredStake)} SOL`, href });
          if (j.status === "Submitted") fresh.push({ id: `${id}-sub-live`, at: t, tone: "neutral", text: `${agent} delivered work`, href });
          if (j.status === "Disputed") fresh.push({ id: `${id}-dis`, at: t, tone: "bad", text: `A client disputed ${agent}'s work`, href });
          if (j.status === "Completed") fresh.push({ id: `${id}-done`, at: t, tone: "good", text: `${agent} earned ${(sol(j.payment) - sol(j.feePaid)).toFixed(4)} SOL`, href });
          if (j.status === "Slashed") fresh.push({ id: `${id}-slash`, at: t, tone: "bad", text: `${agent} was slashed ${sol(j.slashedAmount)} SOL`, href });
        }
      }
    }
    if (prevAgents.current) {
      for (const a of agents) {
        if (!prevAgents.current.has(a.key.toBase58()))
          fresh.push({ id: `${a.key.toBase58()}-joined`, at: t, tone: "neutral", text: `${a.name} joined with a ${sol(a.bond)} SOL bond`, href: `/app/agent/${a.key.toBase58()}` });
      }
    }
    prevJobs.current = new Map(jobs.map((j) => [j.key.toBase58(), j]));
    prevAgents.current = new Set(agents.map((a) => a.key.toBase58()));
    if (fresh.length) setLive((l) => [...fresh, ...l].slice(0, MAX_ITEMS));
  }, [jobs, agents, nameOf]);

  // History from timestamps already on chain.
  const history = useMemo(() => {
    const out: Item[] = [];
    for (const j of jobs) {
      const id = j.key.toBase58();
      const href = `/app/job/${id}`;
      const agent = nameOf(j.agent.toBase58());
      out.push({ id: `${id}-posted`, at: j.createdAt * 1000, tone: "neutral", text: `New job: “${snippet(j.spec)}” for ${sol(j.payment)} SOL`, href });
      if (j.submittedAt > 0) {
        const at = j.submittedAt * 1000;
        if (j.status === "Completed") out.push({ id: `${id}-done-h`, at: at + 1, tone: "good", text: `${agent} earned ${(sol(j.payment) - sol(j.feePaid)).toFixed(4)} SOL`, href });
        else if (j.status === "Slashed") out.push({ id: `${id}-slash-h`, at: at + 1, tone: "bad", text: `${agent} was slashed ${sol(j.slashedAmount)} SOL`, href });
        else out.push({ id: `${id}-sub`, at, tone: "neutral", text: `${agent} delivered work`, href });
      }
    }
    return out;
  }, [jobs, nameOf]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...live, ...history.sort((a, b) => b.at - a.at)]
      .filter((i) => (seen.has(i.text + i.href) ? false : (seen.add(i.text + i.href), true)))
      .slice(0, MAX_ITEMS);
  }, [live, history]);

  const ago = (at: number) => {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  };

  return (
    <section className="sheet activity" aria-labelledby="activity-head">
      <div className="panel-head">
        <h2 id="activity-head">Live activity</h2>
        <p>Updates every few seconds</p>
      </div>
      {items.length === 0 ? (
        <p className="note">Nothing yet. The first job or agent shows up here.</p>
      ) : (
        <ol className="feed" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className={`feed-item feed-item--${i.tone}`}>
              {i.href ? <a href={i.href}>{i.text}</a> : <span>{i.text}</span>}
              <time>{ago(i.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
