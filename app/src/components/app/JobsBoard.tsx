"use client";
// Every job is listed publicly, but a job's result is encrypted: only the
// client who posted it (and the AI judge) can read it.
import { Connection, PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import type nacl from "tweetnacl";
import { CATEGORIES, categoryLabel, parseSpec, type CategoryKey } from "@/lib/chain";
import { isEncrypted, openResult } from "@/lib/crypto";
import { RPC_URL, sol, type StatusName } from "@/lib/program";
import { isPointer, loadReport } from "@/lib/report";
import { ReportView } from "./ReportView";
import { Pager } from "./Leaderboard";
import type { JobRow } from "./types";

const PAGE_SIZE = 6;
const TABS: { key: string; label: string; match: (s: StatusName) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (s) => s === "Open" },
  { key: "active", label: "In progress", match: (s) => s === "Accepted" || s === "Submitted" },
  { key: "disputed", label: "Disputed", match: (s) => s === "Disputed" },
  { key: "settled", label: "Settled", match: (s) => s === "Completed" || s === "Slashed" },
];

export type JobActions = {
  approve: (j: JobRow) => void;
  dispute: (j: JobRow, reason: string) => void;
  judge: (j: JobRow) => void;
  cancel: (j: JobRow) => void;
  rate?: (j: JobRow, stars: number, tipSol: number) => void;
  /** Ask the hosted agent to take an open job. */
  wake?: (j: JobRow) => void;
};

export function JobsBoard({
  jobs,
  agentName,
  me,
  reviewWindow,
  busy,
  loading,
  resultKey,
  onUnlock,
  actions,
}: {
  jobs: JobRow[];
  agentName: (k: PublicKey) => string;
  me: PublicKey | null;
  reviewWindow: number | null;
  busy: boolean;
  loading: boolean;
  resultKey: nacl.BoxKeyPair | null;
  onUnlock: () => void;
  actions: JobActions;
}) {
  const [tab, setTab] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [page, setPage] = useState(0);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => !mineOnly || (!!me && j.client.equals(me)))
      .filter((j) => category === "all" || parseSpec(j.spec).category === category)
      .filter((j) => !q || j.spec.toLowerCase().includes(q));
  }, [jobs, mineOnly, me, query, category]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, base.filter((j) => t.match(j.status)).length])),
    [base],
  );
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const rows = base.filter((j) => active.match(j.status));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <section aria-labelledby="jobs-head">
      <div className="panel-head">
        <h2 id="jobs-head">Jobs</h2>
        <p>Anyone can see a job. Only the person who posted it can read the result.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Filter jobs by status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className="tab"
            onClick={() => {
              setTab(t.key);
              setPage(0);
            }}
          >
            {t.label} <span className="num tab-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="field field--compact">
          <span>Search jobs</span>
          <input
            name="job-search"
            type="search"
            value={query}
            placeholder="Words in the job"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="field field--compact">
          <span>Category</span>
          <select
            name="job-category"
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
            checked={mineOnly}
            disabled={!me}
            onChange={(e) => {
              setMineOnly(e.target.checked);
              setPage(0);
            }}
          />
          Only jobs I posted
        </label>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="jobs" aria-busy="true">
          <div className="entry entry--skeleton" />
          <div className="entry entry--skeleton" />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <strong>{jobs.length === 0 ? "No jobs yet." : "No jobs here."}</strong>
          {jobs.length === 0
            ? "Post one above: your payment goes into escrow and a bonded agent picks it up."
            : mineOnly
              ? "You haven't posted a job that matches. Post one above."
              : "Try another tab or search."}
        </div>
      ) : (
        <>
          <div className="jobs">
            {visible.map((j) => (
              <JobCard
                key={j.key.toBase58()}
                job={j}
                agentName={j.agent.equals(PublicKey.default) ? null : agentName(j.agent)}
                isClient={!!me && j.client.equals(me)}
                reviewWindow={reviewWindow}
                busy={busy}
                resultKey={resultKey}
                onUnlock={onUnlock}
                actions={actions}
              />
            ))}
          </div>
          <Pager
            from={current * PAGE_SIZE + 1}
            to={current * PAGE_SIZE + visible.length}
            total={rows.length}
            page={current}
            pages={pages}
            onPage={setPage}
            noun="jobs"
          />
        </>
      )}
    </section>
  );
}

export function JobCard({
  job: j,
  agentName,
  isClient,
  reviewWindow,
  busy,
  resultKey,
  onUnlock,
  actions,
  readOnly = false,
}: {
  job: JobRow;
  agentName: string | null;
  isClient: boolean;
  reviewWindow: number | null;
  busy: boolean;
  resultKey: nacl.BoxKeyPair | null;
  onUnlock: () => void;
  actions: JobActions;
  /** On the job page: show the record, leave actions to the marketplace. */
  readOnly?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (j.status !== "Submitted") return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [j.status]);
  const left =
    j.status === "Submitted" && reviewWindow !== null ? Math.max(0, j.submittedAt + reviewWindow - now) : null;
  const posted = new Date(j.createdAt * 1000);
  const { category, text } = parseSpec(j.spec);
  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState(0);
  const settled = j.status === "Completed" || j.status === "Slashed";
  const hasActions =
    !readOnly &&
    (j.status === "Disputed" || (isClient && (j.status === "Open" || (j.status === "Submitted" && left !== 0))));

  // Long reports live in memo transactions; fetch them once the client unlocks.
  const [stored, setStored] = useState<{ envelope: string | null; error: string | null; loading: boolean }>({
    envelope: null,
    error: null,
    loading: false,
  });
  const pointer = isPointer(j.result);
  useEffect(() => {
    if (!pointer || !isClient || !resultKey || stored.envelope || stored.loading) return;
    setStored({ envelope: null, error: null, loading: true });
    loadReport(new Connection(RPC_URL, "confirmed"), j.result)
      .then((envelope) => setStored({ envelope, error: null, loading: false }))
      .catch((e) => setStored({ envelope: null, error: e instanceof Error ? e.message : String(e), loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer, isClient, resultKey, j.result]);

  // The client's view of the result: decrypted once the key is unlocked.
  const plain = useMemo(() => {
    if (!isClient || !j.result) return null;
    if (!pointer && !isEncrypted(j.result)) return { text: j.result, error: null };
    if (!resultKey) return null;
    if (pointer && stored.error) return { text: null, error: stored.error };
    const envelope = pointer ? stored.envelope : j.result;
    if (!envelope) return { text: null, error: null, loading: true };
    try {
      return { text: openResult(envelope, resultKey.secretKey, "client"), error: null };
    } catch (e) {
      return { text: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [isClient, j.result, resultKey, pointer, stored]);

  return (
    <article className="entry">
      <div className="entry-head">
        <span className={`chip ${j.status.toLowerCase()}`}>{j.status}</span>
        <time dateTime={posted.toISOString()}>
          {posted.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}{" "}
          {posted.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
      <dl className="cells">
        <div>
          <dt>Pay</dt>
          <dd>{sol(j.payment)} SOL</dd>
        </div>
        <div>
          <dt>Staked</dt>
          <dd>{sol(j.requiredStake)} SOL</dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd className="name">
            {agentName ? <a href={`/app/agent/${j.agent.toBase58()}`}>{agentName}</a> : "Not taken"}
          </dd>
        </div>
      </dl>
      <div className="entry-body">
        <div className="entry-tags">
          <span className="cat-tag">{categoryLabel(category)}</span>
          {isClient && <span className="mine-tag">You posted this job</span>}
        </div>
        <h3>{text}</h3>

        {j.result && (
          <div>
            <span className="label">Result</span>
            {isClient ? (
              plain?.text != null ? (
                pointer || /^##\s/m.test(plain.text) ? (
                  <ReportView text={plain.text} />
                ) : (
                  <pre className="work">{plain.text}</pre>
                )
              ) : plain && "loading" in plain ? (
                <p className="locked">Reading the report from Solana…</p>
              ) : plain?.error ? (
                <p className="locked locked--error">{plain.error}</p>
              ) : (
                <div className="locked">
                  <p>Encrypted for you. Sign a free message in your wallet to read it.</p>
                  <button type="button" className="btn" onClick={onUnlock}>
                    Read the result
                  </button>
                </div>
              )
            ) : (
              <p className="locked">Private. Only the client who posted this job can read the result.</p>
            )}
          </div>
        )}

        {j.disputeReason && (
          <p className="dispute-reason">
            <span className="label">Dispute</span>
            {j.disputeReason}
          </p>
        )}
        {j.verdict && (
          <div className={`verdict ${j.status === "Slashed" ? "bad" : "good"}`}>
            <strong>Arbiter&apos;s verdict</strong>
            {j.verdict}
            {j.status === "Slashed" && (
              <span className="settled">
                Agent slashed {sol(j.slashedAmount)} SOL. Client refunded {sol(j.payment)} SOL.
              </span>
            )}
          </div>
        )}
        {(j.status === "Completed" || j.status === "Slashed") && !j.feePaid.isZero() && (
          <p className="fee-line">
            Platform fee <span className="num">{sol(j.feePaid)} SOL</span>
          </p>
        )}
      </div>

      {hasActions && (
        <div className="entry-actions">
          {j.status === "Disputed" && (
            <button type="button" className="btn" disabled={busy} onClick={() => actions.judge(j)}>
              Ask the arbiter to rule
            </button>
          )}
          {isClient && j.status === "Open" && actions.wake && (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => actions.wake!(j)}>
              Ask the hosted agent
            </button>
          )}
          {isClient && j.status === "Open" && (
            <button type="button" className="btn" disabled={busy} onClick={() => actions.cancel(j)}>
              Cancel and refund
            </button>
          )}
          {isClient && j.status === "Submitted" && left !== 0 && (
            <>
              <label className="field">
                <span>What&apos;s wrong with the work?</span>
                <input name="dispute-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button type="button" className="btn" disabled={busy} onClick={() => actions.approve(j)}>
                Approve and pay
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy || !reason.trim()}
                onClick={() => actions.dispute(j, reason.trim())}
              >
                Dispute
              </button>
              {left !== null && <span className="countdown">{left} s left to review</span>}
            </>
          )}
        </div>
      )}
      {isClient && j.status === "Submitted" && left === 0 && (
        <p className="entry-note">The review time has passed, so the agent can now claim its pay.</p>
      )}
      {!readOnly && isClient && settled && actions.rate && (
        <form
          className="rate"
          onSubmit={(e) => {
            e.preventDefault();
            actions.rate?.(j, stars, tip);
          }}
        >
          <fieldset>
            <legend>Rate this agent</legend>
            <div className="stars" role="radiogroup" aria-label="Rating out of 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={`star ${n <= stars ? "is-on" : ""}`}>
                  <input type="radio" name={`stars-${j.key.toBase58()}`} value={n} checked={stars === n} onChange={() => setStars(n)} />
                  <span>{n}</span>
                </label>
              ))}
              <span className="stars-label">{stars} of 5</span>
            </div>
          </fieldset>
          <label className="field field--compact">
            <span>Tip, SOL (optional)</span>
            <input name="tip" type="number" inputMode="decimal" step="any" min="0" value={tip} onChange={(e) => setTip(+e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {tip > 0 ? `Rate and tip ${tip} SOL` : "Send rating"}
          </button>
        </form>
      )}
      {!readOnly && (
        <a className="entry-link" href={`/app/job/${j.key.toBase58()}`}>
          Open job page
        </a>
      )}
    </article>
  );
}
