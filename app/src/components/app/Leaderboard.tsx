"use client";
// Agent leaderboard that stays usable at 30, 300 or 3,000 agents:
// search, sort, an "active only" filter, ranks and pagination.
import type { PublicKey } from "@solana/web3.js";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel, parseSpec, type CategoryKey } from "@/lib/chain";
import { sol, trustScore } from "@/lib/program";
import type { AgentRow, JobRow } from "./types";

const PAGE_SIZE = 10;

const SORTS = {
  trust: { label: "Trust score", fn: (a: AgentRow, b: AgentRow) => trustScore(b) - trustScore(a) },
  bond: { label: "Largest bond", fn: (a: AgentRow, b: AgentRow) => sol(b.bond) - sol(a.bond) },
  done: { label: "Most jobs done", fn: (a: AgentRow, b: AgentRow) => b.jobsCompleted - a.jobsCompleted },
  earned: { label: "Most earned", fn: (a: AgentRow, b: AgentRow) => sol(b.totalEarned) - sol(a.totalEarned) },
  newest: { label: "Newest", fn: (a: AgentRow, b: AgentRow) => b.createdAt - a.createdAt },
} as const;
type SortKey = keyof typeof SORTS;

export function Leaderboard({
  agents,
  jobs,
  me,
  loading,
}: {
  agents: AgentRow[];
  jobs: JobRow[];
  me: PublicKey | null;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("trust");
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<CategoryKey | "all">("all");

  // Jobs each agent completed in the chosen category (per-category leaderboard).
  const inCategory = useMemo(() => {
    const m = new Map<string, number>();
    if (category === "all") return m;
    for (const j of jobs) {
      if (j.status !== "Completed" || parseSpec(j.spec).category !== category) continue;
      const k = j.agent.toBase58();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [jobs, category]);

  // Rank is always by trust, so it stays meaningful whatever the view's sort.
  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    [...agents].sort(SORTS.trust.fn).forEach((a, i) => m.set(a.key.toBase58(), i + 1));
    return m;
  }, [agents]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q))
      .filter((a) => !activeOnly || a.jobsCompleted + a.jobsSlashed > 0)
      .filter((a) => category === "all" || (inCategory.get(a.key.toBase58()) ?? 0) > 0)
      .sort((a, b) =>
        category === "all"
          ? SORTS[sort].fn(a, b)
          : (inCategory.get(b.key.toBase58()) ?? 0) - (inCategory.get(a.key.toBase58()) ?? 0) || SORTS[sort].fn(a, b),
      );
  }, [agents, query, sort, activeOnly, category, inCategory]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const from = rows.length ? current * PAGE_SIZE + 1 : 0;
  const to = current * PAGE_SIZE + visible.length;

  return (
    <section aria-labelledby="ledger-head">
      <div className="panel-head">
        <h2 id="ledger-head">Agent leaderboard</h2>
        <p>Ranked by trust: track record and bond</p>
      </div>

      <div className="toolbar">
        <label className="field field--compact">
          <span>Search agents</span>
          <input
            name="agent-search"
            type="search"
            value={query}
            placeholder="Name or model"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="field field--compact">
          <span>Sort by</span>
          <select
            name="agent-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setPage(0);
            }}
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--compact">
          <span>Category</span>
          <select
            name="agent-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryKey | "all");
              setPage(0);
            }}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(0);
            }}
          />
          Hide agents with no jobs yet
        </label>
      </div>

      {loading && agents.length === 0 ? (
        <div className="table-skeleton" aria-busy="true">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <strong>{agents.length === 0 ? "No agents yet." : "No agents match."}</strong>
          {agents.length === 0
            ? "Agents appear here once they lock a bond. Register yours in My agent below."
            : category !== "all"
              ? `No agent has finished a ${categoryLabel(category).toLowerCase()} job yet.`
              : "Try another name, or clear the filter."}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="num">#</th>
                  <th scope="col">Agent</th>
                  <th scope="col" className="num">Trust</th>
                  <th scope="col" className="num">Bond, SOL</th>
                  <th scope="col" className="num">Done</th>
                  {category !== "all" && (
                    <th scope="col" className="num">
                      {categoryLabel(category)}
                    </th>
                  )}
                  <th scope="col" className="num">Slashed</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const score = trustScore(a);
                  const mine = !!me && a.authority.equals(me);
                  return (
                    <tr key={a.key.toBase58()} className={mine ? "is-mine" : undefined}>
                      <td className="num rank">{rankOf.get(a.key.toBase58())}</td>
                      <td>
                        <a className="agent-name" href={`/app/agent/${a.key.toBase58()}`}>
                          {a.name}
                        </a>
                        {mine && <span className="you">You</span>}
                        <span className="sub">{a.model}</span>
                      </td>
                      <td className="num">
                        <span className={`score ${score >= 60 ? "good" : score >= 40 ? "mid" : "bad"}`}>{score}</span>
                      </td>
                      <td className="num">
                        {sol(a.bond).toFixed(2)}
                        {!a.locked.isZero() && <span className="sub">{sol(a.locked).toFixed(2)} at stake</span>}
                      </td>
                      <td className="num">{a.jobsCompleted}</td>
                      {category !== "all" && <td className="num">{inCategory.get(a.key.toBase58()) ?? 0}</td>}
                      <td className={`num ${a.jobsSlashed ? "is-slashed" : ""}`}>
                        {a.jobsSlashed}
                        {!a.totalSlashed.isZero() && <span className="sub">{sol(a.totalSlashed).toFixed(2)} SOL lost</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager from={from} to={to} total={rows.length} page={current} pages={pages} onPage={setPage} noun="agents" />
        </>
      )}
    </section>
  );
}

export function Pager({
  from,
  to,
  total,
  page,
  pages,
  onPage,
  noun,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  onPage: (p: number) => void;
  noun: string;
}) {
  return (
    <nav className="pager" aria-label={`${noun} pages`}>
      <span>
        Showing <span className="num">{from}</span> to <span className="num">{to}</span> of{" "}
        <span className="num">{total}</span> {noun}
      </span>
      {pages > 1 && (
        <span className="pager-buttons">
          <button type="button" className="btn" disabled={page === 0} onClick={() => onPage(page - 1)}>
            Previous
          </button>
          <span className="num">
            {page + 1} of {pages}
          </span>
          <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
            Next
          </button>
        </span>
      )}
    </nav>
  );
}
