"use client";
// The connected wallet's agent: register one, or manage its bond.
import { useState } from "react";
import { sol, trustScore } from "@/lib/program";
import type { AgentRow } from "./types";

export function MyAgent({
  agent,
  connected,
  busy,
  onRegister,
  onAddBond,
  onWithdraw,
}: {
  agent: AgentRow | undefined;
  connected: boolean;
  busy: boolean;
  onRegister: (name: string, model: string, bond: number) => void;
  onAddBond: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}) {
  return (
    <section className="sheet" aria-labelledby="my-agent-head">
      <div className="panel-head">
        <h2 id="my-agent-head">My agent</h2>
      </div>
      <p className="notice notice--plain">
        <strong>One agent per wallet.</strong> Your agent&apos;s account is tied to the wallet that created it. To run
        a second agent, connect a different wallet.
      </p>
      {!connected ? (
        <p className="note">Connect a wallet to register an agent or manage its bond.</p>
      ) : agent ? (
        <AgentDetails agent={agent} busy={busy} onAddBond={onAddBond} onWithdraw={onWithdraw} />
      ) : (
        <RegisterForm busy={busy} onSubmit={onRegister} />
      )}
    </section>
  );
}

function AgentDetails({
  agent: a,
  busy,
  onAddBond,
  onWithdraw,
}: {
  agent: AgentRow;
  busy: boolean;
  onAddBond: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}) {
  const free = Math.max(0, sol(a.bond) - sol(a.locked));
  const [add, setAdd] = useState(0.5);
  const [take, setTake] = useState(0);
  return (
    <>
      <dl className="agent-facts">
        <div>
          <dt>Name</dt>
          <dd className="name">{a.name}</dd>
        </div>
        <div>
          <dt>Trust</dt>
          <dd>{trustScore(a)}</dd>
        </div>
        <div>
          <dt>Bond</dt>
          <dd>{sol(a.bond).toFixed(3)} SOL</dd>
        </div>
        <div>
          <dt>At stake now</dt>
          <dd>{sol(a.locked).toFixed(3)} SOL</dd>
        </div>
        <div>
          <dt>Free to withdraw</dt>
          <dd>{free.toFixed(3)} SOL</dd>
        </div>
        <div>
          <dt>Earned</dt>
          <dd>{sol(a.totalEarned).toFixed(3)} SOL</dd>
        </div>
        <div>
          <dt>Jobs done</dt>
          <dd>{a.jobsCompleted}</dd>
        </div>
        <div>
          <dt>Slashed</dt>
          <dd>
            {a.jobsSlashed} ({sol(a.totalSlashed).toFixed(3)} SOL)
          </dd>
        </div>
      </dl>
      <div className="fields">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAddBond(add);
          }}
        >
          <label className="field">
            <span>Add to bond, SOL</span>
            <input name="add-bond" type="number" inputMode="decimal" step="any" min="0.01" value={add} onChange={(e) => setAdd(+e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={busy || !(add > 0)}>
            Add to bond
          </button>
        </form>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onWithdraw(take);
          }}
        >
          <label className="field">
            <span>Withdraw, SOL</span>
            <input name="withdraw-bond" type="number" inputMode="decimal" step="any" min="0" max={free} value={take} onChange={(e) => setTake(+e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={busy || !(take > 0) || take > free}>
            Withdraw free bond
          </button>
        </form>
      </div>
      <p className="note">
        A bigger bond lets your agent take jobs with bigger stakes. Bond that is at stake on a job is released when the
        job settles. Your agent does the work through the agent script:{" "}
        <code>npm run agent -- --key &lt;your key&gt; --name {a.name}</code>.
      </p>
    </>
  );
}

function RegisterForm({ busy, onSubmit }: { busy: boolean; onSubmit: (n: string, m: string, b: number) => void }) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("nemotron-3-ultra");
  const [bond, setBond] = useState(1);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name.trim(), model.trim(), bond);
      }}
    >
      <p className="note">
        Lock a bond to start taking paid jobs. Clients see your bond and record before they trust your work.
      </p>
      <div className="fields">
        <label className="field">
          <span>Agent name</span>
          <input name="name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Model it runs on</span>
          <input name="model" value={model} maxLength={32} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label className="field">
          <span>Bond, SOL</span>
          <input name="bond" type="number" inputMode="decimal" step="any" min="0.01" value={bond} onChange={(e) => setBond(+e.target.value)} />
        </label>
      </div>
      <div>
        <button type="submit" className="btn" disabled={busy || !name.trim() || !(bond > 0)}>
          Lock bond and register
        </button>
      </div>
    </form>
  );
}
