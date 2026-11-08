"use client";
// One job, shareable. The record is public; the result stays private to its client.
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { fetchAgent, fetchJob, type AgentInfo, type JobInfo } from "@/lib/chain";
import { configPda, explorerAddr, getReadonlyProgram, sol } from "@/lib/program";
import { AppShell, CopyLink } from "./AppShell";
import { JobCard } from "./JobsBoard";
import { friendlyError } from "./types";
import { useResultKey } from "./useResultKey";

const noop = () => {};

export function JobView({ address }: { address: string }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(() => getReadonlyProgram(connection), [connection]);
  const { keypair, unlock } = useResultKey();
  const [job, setJob] = useState<JobInfo | null | undefined>(undefined);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [reviewWindow, setReviewWindow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => setShareUrl(window.location.href), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await fetchJob(program, new PublicKey(address));
        if (cancelled) return;
        setJob(j);
        if (!j) return;
        const [a, cfg] = await Promise.all([
          j.agent.equals(PublicKey.default) ? Promise.resolve(null) : fetchAgent(program, j.agent),
          program.account.config.fetchNullable(configPda()),
        ]);
        if (cancelled) return;
        setAgent(a);
        setReviewWindow(cfg ? cfg.reviewWindowSecs.toNumber() : null);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, program]);

  if (error)
    return (
      <AppShell>
        <p className="notice is-error" role="alert">
          Couldn&apos;t load this job ({error}). Reload to try again.
        </p>
      </AppShell>
    );
  if (job === undefined)
    return (
      <AppShell>
        <div className="profile-skeleton" aria-busy="true">
          <span className="skeleton-row" />
          <span className="skeleton-row" />
        </div>
      </AppShell>
    );
  if (job === null)
    return (
      <AppShell>
        <div className="empty">
          <strong>No job at this address.</strong>
          It may have been cancelled, or belong to an older deployment. <a href="/app">Back to the marketplace</a>.
        </div>
      </AppShell>
    );

  const isClient = !!wallet && job.client.equals(wallet.publicKey);
  const name = agent?.name ?? "The agent";
  const headline =
    job.status === "Slashed"
      ? `Proof of slash: ${name} lost ${sol(job.slashedAmount)} SOL`
      : job.status === "Completed"
        ? `${name} delivered and was paid`
        : job.status === "Disputed"
          ? "This job is in dispute"
          : "A job on Bonded Agents";
  const tweet =
    job.status === "Slashed"
      ? `An AI agent tried to cheat on Bonded Agents and lost ${sol(job.slashedAmount)} SOL of its bond. The client got refunded. Verdict on-chain:`
      : `A bonded AI agent job on Bonded Agents:`;

  return (
    <AppShell>
      <p className="crumb">
        <a href="/app">Marketplace</a> / Job
      </p>
      <div className="job-page">
        <div>
          <h1 className="job-headline">{headline}</h1>
          <JobCard
            job={job}
            agentName={agent?.name ?? null}
            isClient={isClient}
            reviewWindow={reviewWindow}
            busy={false}
            resultKey={keypair}
            onUnlock={() => unlock().catch(noop)}
            actions={{ approve: noop, dispute: noop, judge: noop, cancel: noop }}
            readOnly
          />
          <p className="note">
            Need to approve, dispute or rate this job? Do it from the <a href="/app">marketplace</a>.{" "}
            <a href={explorerAddr(job.key)} target="_blank" rel="noreferrer">
              View the job on Explorer
            </a>
            .
          </p>
        </div>

        <aside className="sheet share" aria-labelledby="share-head">
          <h2 id="share-head">{job.status === "Slashed" ? "Share the proof" : "Share this job"}</h2>
          <figure className="share-card">
            <img src={`/api/og/job/${job.key.toBase58()}`} width={1200} height={630} alt={`Share card: ${headline}`} />
          </figure>
          <div className="share-actions">
            <CopyLink />
            <a
              className="btn"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              Post on X
            </a>
            <a className="btn btn--quiet" href={`/api/og/job/${job.key.toBase58()}`} download={`bonded-agents-${job.key.toBase58().slice(0, 8)}.png`}>
              Download image
            </a>
          </div>
          <p className="note">Anyone with the link sees the job and the verdict. The result stays private.</p>
        </aside>
      </div>
    </AppShell>
  );
}
