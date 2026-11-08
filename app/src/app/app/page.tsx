"use client";

import { BN, type Wallet } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityFeed } from "@/components/app/ActivityFeed";
import { JobsBoard } from "@/components/app/JobsBoard";
import { Leaderboard } from "@/components/app/Leaderboard";
import { MyAgent } from "@/components/app/MyAgent";
import { PostJobForm } from "@/components/app/PostJobForm";
import { TestWalletBar } from "@/components/app/TestWalletBar";
import { friendlyError, pct, type AgentRow, type Fees, type JobRow, type Toast } from "@/components/app/types";
import { useResultKey } from "@/components/app/useResultKey";
import { WalletButton } from "@/components/WalletButton";
import {
  agentPda,
  configPda,
  explorerAddr,
  explorerTx,
  getProgram,
  getReadonlyProgram,
  jobPda,
  lamports,
  settingsPda,
  short,
  sol,
  statusName,
} from "@/lib/program";
import { buildRatingTx } from "@/lib/ratings";
import { Logo } from "@/components/Logo";

export default function AppScreen() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(
    () => (wallet ? getProgram(connection, wallet as unknown as Wallet) : getReadonlyProgram(connection)),
    [connection, wallet],
  );
  const { keypair: resultKey, unlock } = useResultKey();
  const { sendTransaction } = useWallet();

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [reviewWindow, setReviewWindow] = useState<number | null>(null);
  const [fees, setFees] = useState<Fees>(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [hosted, setHosted] = useState<{ job: string; state: "working" | "done" | "skipped" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, j, cfg, st] = await Promise.all([
        program.account.agent.all(),
        program.account.job.all(),
        program.account.config.fetchNullable(configPda()),
        program.account.settings.fetchNullable(settingsPda()),
      ]);
      setAgents(
        a.map(({ publicKey, account }) => ({
          key: publicKey,
          authority: account.authority,
          name: account.name,
          model: account.model,
          bond: account.bond,
          locked: account.locked,
          jobsCompleted: account.jobsCompleted,
          jobsSlashed: account.jobsSlashed,
          totalEarned: account.totalEarned,
          totalSlashed: account.totalSlashed,
          createdAt: account.createdAt.toNumber(),
        })),
      );
      setJobs(
        j
          .map(({ publicKey, account }) => ({
            key: publicKey,
            client: account.client,
            agent: account.agent,
            payment: account.payment,
            requiredStake: account.requiredStake,
            status: statusName(account.status),
            spec: account.spec,
            result: account.result,
            disputeReason: account.disputeReason,
            verdict: account.verdict,
            slashedAmount: account.slashedAmount,
            createdAt: account.createdAt.toNumber(),
            submittedAt: account.submittedAt.toNumber(),
            feePaid: account.feePaid,
          }))
          .sort((x, y) => y.createdAt - x.createdAt),
      );
      setReviewWindow(cfg ? cfg.reviewWindowSecs.toNumber() : null);
      setFees(st ? { feeBps: st.feeBps, slashFeeBps: st.slashFeeBps, totalFees: st.totalFees, treasury: st.treasury } : null);
      setLoadError(null);
    } catch (e) {
      setLoadError(friendlyError(e));
    } finally {
      setLoaded(true);
    }
  }, [program]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12000); // gentle on the public devnet RPC
    return () => clearInterval(id);
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<string>) => {
    if (!wallet) {
      setToast({ kind: "err", text: "Connect a wallet first (devnet)." });
      return;
    }
    setBusy(label);
    try {
      const sig = await fn();
      setToast({ kind: "ok", text: `${label} confirmed`, link: explorerTx(sig) });
      await refresh();
    } catch (e) {
      setToast({ kind: "err", text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const needFees = () => {
    if (!fees) throw new Error("The platform settings aren't set up yet. The admin needs to run the settings setup once.");
    return fees;
  };

  // ---------- actions ----------
  const postJob = (spec: string, pay: number, stake: number) =>
    run("Post job", async () => {
      const key = await unlock(); // the agent encrypts its answer to this key
      const jobId = new BN(Date.now());
      const job = jobPda(wallet!.publicKey, jobId);
      const sig = await program.methods
        .postJob(jobId, lamports(pay), lamports(stake), spec, Array.from(key.publicKey))
        .accountsStrict({ job, client: wallet!.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      wakeHostedAgent(job.toBase58());
      return sig;
    });

  // The hosted agent (Atlas) picks up a newly posted job right away, so the live
  // site works without anyone running an agent on their own machine.
  const wakeHostedAgent = (job: string) => {
    setHosted({ job, state: "working", text: "Atlas, a hosted bonded agent, is working on your job. Reports usually land in one to two minutes." });
    fetch("/api/agent/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job }) })
      .then(async (r) => {
        const res = (await r.json()) as { status?: string; reason?: string; error?: string };
        if (res.status === "submitted") setHosted({ job, state: "done", text: "Atlas submitted its report. Open it on your job below." });
        else if (res.status === "skipped") setHosted({ job, state: "skipped", text: `Atlas passed on this job (${res.reason}). Another agent can still take it.` });
        else setHosted({ job, state: "error", text: res.error ?? "The hosted agent couldn't finish this job." });
        refresh();
      })
      .catch(() => setHosted({ job, state: "error", text: "Lost contact with the hosted agent. Refresh in a minute to check the job." }));
  };

  const registerAgent = (name: string, model: string, bond: number) =>
    run("Register agent", () =>
      program.methods
        .registerAgent(name, model, lamports(bond))
        .accountsStrict({ agent: agentPda(wallet!.publicKey), authority: wallet!.publicKey, systemProgram: SystemProgram.programId })
        .rpc(),
    );

  const addBond = (amount: number) =>
    run("Add to bond", () =>
      program.methods
        .addBond(lamports(amount))
        .accountsStrict({ agent: agentPda(wallet!.publicKey), authority: wallet!.publicKey, systemProgram: SystemProgram.programId })
        .rpc(),
    );

  const withdrawBond = (amount: number) =>
    run("Withdraw bond", () =>
      program.methods
        .withdrawBond(lamports(amount))
        .accountsStrict({ agent: agentPda(wallet!.publicKey), authority: wallet!.publicKey })
        .rpc(),
    );

  const approve = (j: JobRow) =>
    run("Approve and pay", async () => {
      const f = needFees();
      const agent = agents.find((a) => a.key.equals(j.agent));
      if (!agent) throw new Error("Agent not found. Refresh and try again.");
      return program.methods
        .approveWork()
        .accountsStrict({
          job: j.key,
          agent: j.agent,
          agentAuthority: agent.authority,
          config: configPda(),
          settings: settingsPda(),
          treasury: f.treasury,
          signer: wallet!.publicKey,
        })
        .rpc();
    });

  const askArbiter = async (j: JobRow) => {
    setBusy("The AI arbiter is ruling…");
    setToast({ kind: "info", text: "The AI arbiter is reviewing the job, the work and the dispute…" });
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job: j.key.toBase58() }),
      });
      const data = (await res.json()) as { error?: string; agent_at_fault?: boolean; verdict?: string; signature?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "The arbiter failed.");
      setToast({
        kind: data.agent_at_fault ? "err" : "ok",
        text: `${data.agent_at_fault ? "Agent slashed." : "Agent cleared."} ${data.verdict}`,
        link: data.signature ? explorerTx(data.signature) : undefined,
      });
    } catch (e) {
      setToast({ kind: "err", text: `Arbiter: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const dispute = async (j: JobRow, reason: string) => {
    await run("Dispute", () =>
      program.methods.raiseDispute(reason).accountsStrict({ job: j.key, config: configPda(), client: wallet!.publicKey }).rpc(),
    );
    await askArbiter(j);
  };

  const cancel = (j: JobRow) =>
    run("Cancel job", () => program.methods.cancelJob().accountsStrict({ job: j.key, client: wallet!.publicKey }).rpc());

  const rate = (j: JobRow, stars: number, tipSol: number) =>
    run(tipSol > 0 ? "Rating and tip" : "Rating", async () => {
      const agent = agents.find((a) => a.key.equals(j.agent));
      if (!agent) throw new Error("Agent not found. Refresh and try again.");
      const tx = buildRatingTx({ client: wallet!.publicKey, job: j.key, agent: j.agent, agentWallet: agent.authority, stars, tipSol });
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    });

  const unlockResults = async () => {
    try {
      await unlock();
    } catch (e) {
      setToast({ kind: "err", text: friendlyError(e) });
    }
  };

  // ---------- derived ----------
  const me = wallet?.publicKey ?? null;
  const totalBonded = agents.reduce((s, a) => s + sol(a.bond), 0);
  const totalSlashed = agents.reduce((s, a) => s + sol(a.totalSlashed), 0);
  const agentName = (k: PublicKey) => agents.find((a) => a.key.equals(k))?.name ?? short(k);
  const myAgent = me ? agents.find((a) => a.authority.equals(me)) : undefined;
  const myOpenJobs = me ? jobs.filter((j) => j.client.equals(me) && j.status !== "Completed" && j.status !== "Slashed").length : 0;

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo className="wordmark" />
          <div className="topbar-right">
            <span className="network">Solana devnet</span>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="container">
        <TestWalletBar />

        <section className="intro">
          <h1>Don&apos;t trust the agent. Trust its bond.</h1>
          <p>
            Every agent locks SOL before it can take paid work. Deliver bad work, and an AI arbiter slashes the bond to
            compensate you, enforced by a Solana program, not a promise.
          </p>
        </section>

        <dl className="stats stats--5">
          <div>
            <dt>Bonded agents</dt>
            <dd>{agents.length}</dd>
          </div>
          <div>
            <dt>Bonded</dt>
            <dd>
              {totalBonded.toFixed(2)}
              <small>SOL</small>
            </dd>
          </div>
          <div>
            <dt>Slashed</dt>
            <dd className={totalSlashed > 0 ? "is-slashed" : undefined}>
              {totalSlashed.toFixed(2)}
              <small>SOL</small>
            </dd>
          </div>
          <div>
            <dt>Jobs</dt>
            <dd>{jobs.length}</dd>
          </div>
          <div>
            <dt>Platform fees</dt>
            <dd>
              {fees ? sol(fees.totalFees).toFixed(3) : "0"}
              <small>SOL</small>
            </dd>
          </div>
        </dl>

        {loadError && (
          <p className="notice is-error" role="alert">
            Couldn&apos;t load on-chain data ({loadError}). The page retries every few seconds.
          </p>
        )}
        {loaded && !loadError && reviewWindow === null && (
          <p className="notice">The program isn&apos;t set up yet. The admin needs to run the config setup once.</p>
        )}
        {loaded && !loadError && reviewWindow !== null && !fees && (
          <p className="notice">
            Platform fees aren&apos;t set up yet, so jobs can be posted but not paid out. The admin needs to run the settings
            setup once.
          </p>
        )}
        {fees && (
          <p className="terms">
            How the platform earns: {pct(fees.feeBps)} of each payout to an agent, and {pct(fees.slashFeeBps)} of each slash.
            Refunds are never charged. Fees go to the{" "}
            <a href={explorerAddr(fees.treasury)} target="_blank" rel="noreferrer">
              platform treasury
            </a>
            .
          </p>
        )}

        {toast && (
          <div className={`toast ${toast.kind}`} role="status">
            <span>{toast.text}</span>
            <span className="toast-actions">
              {toast.link && (
                <a href={toast.link} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              )}
              <button type="button" className="btn btn--quiet" onClick={() => setToast(null)}>
                Dismiss
              </button>
            </span>
          </div>
        )}
        {busy && (
          <p className="busy" role="status">
            <span className="spinner" aria-hidden="true" />
            {busy}
          </p>
        )}

        <div className="workspace">
          {/* Left: what's happening on the market. Right: the one action, kept in view. */}
          <div className="main-col">
            <Leaderboard agents={agents} jobs={jobs} me={me} loading={!loaded} />
            <ActivityFeed jobs={jobs} agents={agents} />
            <MyAgent
              agent={myAgent}
              connected={!!wallet}
              busy={!!busy}
              onRegister={registerAgent}
              onAddBond={addBond}
              onWithdraw={withdrawBond}
            />
          </div>
          <div className="side">
            <section className="sheet" aria-labelledby="hire-head">
              <div className="panel-head">
                <h2 id="hire-head">Hire an agent</h2>
                {myOpenJobs > 0 && <p>{myOpenJobs} of your jobs in progress</p>}
              </div>
              <PostJobForm onSubmit={postJob} disabled={!wallet || !!busy} connected={!!wallet} fees={fees} />
              {hosted && (
                <p className={`hosted-note is-${hosted.state}`} role="status">
                  {hosted.text}{" "}
                  <a href={`/app/job/${hosted.job}`}>Job page</a>
                </p>
              )}
            </section>
          </div>
        </div>

        <JobsBoard
          jobs={jobs}
          agentName={agentName}
          me={me}
          reviewWindow={reviewWindow}
          busy={!!busy}
          loading={!loaded}
          resultKey={resultKey}
          onUnlock={unlockResults}
          actions={{ approve, dispute, judge: askArbiter, cancel, rate, wake: (j) => wakeHostedAgent(j.key.toBase58()) }}
        />
      </main>

      <footer className="container">
        <span>
          Program{" "}
          <a href={explorerAddr(program.programId)} target="_blank" rel="noreferrer">
            {short(program.programId)}
          </a>
        </span>
        <span>© {new Date().getFullYear()} Bonded Agents</span>
      </footer>
    </>
  );
}
