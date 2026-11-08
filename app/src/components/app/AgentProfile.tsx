"use client";
// A shareable profile for one agent: its record, rating and full job history.
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { categoryLabel, fetchAgent, fetchJobsByAgent, parseSpec, type AgentInfo, type JobInfo } from "@/lib/chain";
import { explorerAddr, getReadonlyProgram, short, sol, trustScore } from "@/lib/program";
import { fetchRatings, type RatingSummary } from "@/lib/ratings";
import { AppShell, CopyLink } from "./AppShell";
import { friendlyError } from "./types";

export function AgentProfile({ address }: { address: string }) {
  const { connection } = useConnection();
  const program = useMemo(() => getReadonlyProgram(connection), [connection]);
  const [agent, setAgent] = useState<AgentInfo | null | undefined>(undefined);
  const [jobs, setJobs] = useState<JobInfo[] | null>(null);
  const [ratings, setRatings] = useState<RatingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = new PublicKey(address);
        const a = await fetchAgent(program, key);
        if (cancelled) return;
        setAgent(a);
        if (!a) return;
        const js = await fetchJobsByAgent(program, key);
        if (cancelled) return;
        setJobs(js);
        try {
          const r = await fetchRatings(connection, program, key, a.authority);
          if (!cancelled) setRatings(r);
        } catch {
          // Ratings are a bonus: show the profile without them.
          if (!cancelled) setRatings({ average: null, count: 0, tips: 0, items: [], unavailable: true } as RatingSummary & { unavailable: boolean });
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, connection, program]);

  if (error)
    return (
      <AppShell>
        <p className="notice is-error" role="alert">
          Couldn&apos;t load this agent ({error}). Reload to try again.
        </p>
      </AppShell>
    );
  if (agent === undefined)
    return (
      <AppShell>
        <div className="profile-skeleton" aria-busy="true">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      </AppShell>
    );
  if (agent === null)
    return (
      <AppShell>
        <div className="empty">
          <strong>No agent at this address.</strong>
          It may belong to an older deployment. <a href="/app">Back to the marketplace</a>.
        </div>
      </AppShell>
    );

  const score = trustScore(agent);
  const since = new Date(agent.createdAt * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppShell>
      <section className="profile-head">
        <div>
          <p className="crumb">
            <a href="/app">Marketplace</a> / Agent
          </p>
          <h1>{agent.name}</h1>
          <p className="muted">
            Runs on {agent.model}. Bonded since {since}.
          </p>
          <div className="profile-actions">
            <CopyLink />
            <a className="btn btn--quiet" href={explorerAddr(agent.key)} target="_blank" rel="noreferrer">
              View on Explorer
            </a>
          </div>
        </div>
        <div className={`trust-badge ${score >= 60 ? "good" : score >= 40 ? "mid" : "bad"}`}>
          <span className="trust-figure">{score}</span>
          <span>Trust score</span>
        </div>
      </section>

      <dl className="stats stats--5">
        <div>
          <dt>Bond</dt>
          <dd>
            {sol(agent.bond).toFixed(2)}
            <small>SOL</small>
          </dd>
        </div>
        <div>
          <dt>Jobs done</dt>
          <dd>{agent.jobsCompleted}</dd>
        </div>
        <div>
          <dt>Slashed</dt>
          <dd className={agent.jobsSlashed ? "is-slashed" : undefined}>
            {agent.jobsSlashed}
            {!agent.totalSlashed.isZero() && <small>{sol(agent.totalSlashed).toFixed(2)} SOL</small>}
          </dd>
        </div>
        <div>
          <dt>Earned</dt>
          <dd>
            {sol(agent.totalEarned).toFixed(3)}
            <small>SOL</small>
          </dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>
            {ratings === null ? (
              <span className="skeleton" aria-busy="true" />
            ) : (ratings as RatingSummary & { unavailable?: boolean }).unavailable ? (
              <small>Unavailable right now</small>
            ) : ratings.average === null ? (
              <small>No ratings yet</small>
            ) : (
              <>
                {ratings.average.toFixed(1)}
                <small>of 5, {ratings.count} {ratings.count === 1 ? "rating" : "ratings"}</small>
              </>
            )}
          </dd>
        </div>
      </dl>
      {ratings && ratings.tips > 0 && (
        <p className="terms">Clients have tipped {agent.name} {ratings.tips.toFixed(3)} SOL on top of job payments.</p>
      )}

      <section aria-labelledby="history-head">
        <div className="panel-head">
          <h2 id="history-head">Job history</h2>
          <p>Every job this agent took, with the judge&apos;s verdict where there was one</p>
        </div>
        {jobs === null ? (
          <div className="table-skeleton" aria-busy="true">
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <strong>No jobs yet.</strong>
            {agent.name} hasn&apos;t taken a job. Post one in the marketplace.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Pay, SOL</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const { category, text } = parseSpec(j.spec);
                  const rated = ratings?.items.find((r) => r.job === j.key.toBase58());
                  return (
                    <tr key={j.key.toBase58()}>
                      <td className="num">
                        {new Date(j.createdAt * 1000).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      </td>
                      <td>
                        <a className="agent-name" href={`/app/job/${j.key.toBase58()}`}>
                          {text.length > 70 ? `${text.slice(0, 68).trimEnd()}…` : text}
                        </a>
                        <span className="sub">
                          {categoryLabel(category)}
                          {rated && `, rated ${rated.stars} of 5`}
                        </span>
                      </td>
                      <td>
                        <span className={`chip ${j.status.toLowerCase()}`}>{j.status}</span>
                      </td>
                      <td className="num">
                        {sol(j.payment)}
                        {j.status === "Slashed" && <span className="sub">lost {sol(j.slashedAmount)}</span>}
                      </td>
                      <td className="verdict-cell">{j.verdict || <span className="sub">None</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">Results stay private to each job&apos;s client. Agent wallet {short(agent.authority)}.</p>
      </section>
    </AppShell>
  );
}
