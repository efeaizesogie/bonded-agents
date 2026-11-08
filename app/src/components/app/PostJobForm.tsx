"use client";
import { useState } from "react";
import { CATEGORIES, tagSpec, type CategoryKey } from "@/lib/chain";
import { buildTaskSpec, TASKS, taskDef, type TaskKind } from "@/lib/tasks";
import type { Fees } from "./types";
import { pct } from "./types";

type Choice = TaskKind | "custom";
const FREE_FORM = CATEGORIES.filter((c) => !TASKS.some((t) => t.kind === c.key));

export function PostJobForm({
  onSubmit,
  disabled,
  connected,
  fees,
}: {
  onSubmit: (spec: string, pay: number, stake: number) => void; // spec already carries its category tag
  disabled: boolean;
  connected: boolean;
  fees: Fees;
}) {
  const [choice, setChoice] = useState<Choice>("token");
  const [inputs, setInputs] = useState<Record<TaskKind, string>>({
    token: TASKS[0].examples[2]?.value ?? "",
    tx: "",
    wallet: "",
    audit: "",
  });
  const [note, setNote] = useState("");
  const [spec, setSpec] = useState("Write a 3 sentence product description for a hardware wallet aimed at first time buyers.");
  const [category, setCategory] = useState<CategoryKey>("writing");
  const [pay, setPay] = useState(0.05);
  const [stake, setStake] = useState(0.5);

  const task = choice === "custom" ? null : taskDef(choice)!;
  const input = task ? inputs[task.kind].trim() : "";
  const inputError = task && input ? task.validate(input) : null;
  const tagged = task ? buildTaskSpec(task.kind, input, note) : tagSpec(category, spec);
  const bytes = new TextEncoder().encode(tagged).length;
  const ready = task ? !!input && !inputError : spec.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(tagged, pay, stake);
      }}
    >
      <fieldset className="task-pick">
        <legend>What should the agent do?</legend>
        {TASKS.map((t) => (
          <label key={t.kind} className={`task-option ${choice === t.kind ? "is-on" : ""}`}>
            <input type="radio" name="task" value={t.kind} checked={choice === t.kind} onChange={() => setChoice(t.kind)} />
            <span className="task-name">{t.label}</span>
            <span className="task-pitch">{t.pitch}</span>
          </label>
        ))}
        <label className={`task-option ${choice === "custom" ? "is-on" : ""}`}>
          <input type="radio" name="task" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} />
          <span className="task-name">Something else</span>
          <span className="task-pitch">Describe any short text job in your own words.</span>
        </label>
      </fieldset>

      {task ? (
        <>
          <label className="field">
            <span>{task.inputLabel}</span>
            <input
              name="input"
              value={inputs[task.kind]}
              placeholder={task.placeholder}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setInputs({ ...inputs, [task.kind]: e.target.value })}
              aria-invalid={!!inputError}
            />
          </label>
          {task.examples.length > 0 && (
            <p className="examples">
              <span>Try</span>
              {task.examples.map((ex) => (
                <button key={ex.value} type="button" className="chip-btn" onClick={() => setInputs({ ...inputs, [task.kind]: ex.value })}>
                  {ex.label}
                </button>
              ))}
            </p>
          )}
          {inputError && <p className="helper is-over">{inputError}</p>}
          <label className="field">
            <span>Anything specific? Optional</span>
            <input name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: focus on who can move my tokens" />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span>Category</span>
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)}>
              {FREE_FORM.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>What do you need done?</span>
            <textarea name="spec" value={spec} onChange={(e) => setSpec(e.target.value)} rows={4} />
          </label>
        </>
      )}
      <p className={`helper ${bytes > 280 ? "is-over" : ""}`}>{bytes} of 280 bytes</p>

      <div className="fields">
        <label className="field">
          <span>Payment, SOL</span>
          <input name="payment" type="number" inputMode="decimal" step="any" min="0.001" value={pay} onChange={(e) => setPay(+e.target.value)} />
        </label>
        <label className="field">
          <span>Agent stake, SOL</span>
          <input name="stake" type="number" inputMode="decimal" step="any" min="0" value={stake} onChange={(e) => setStake(+e.target.value)} />
        </label>
      </div>
      <p className="note">
        {task
          ? "The agent reads live Solana mainnet data (or the GitHub file) and writes a full report, encrypted so only you can read it. If you dispute it, the judge reads the same data again and checks every key fact."
          : "The agent's answer is encrypted so only you can read it."}{" "}
        Your payment waits in escrow while the agent locks {stake} SOL of its bond. If the judge rules against it, you get a full
        refund plus part of its stake.
        {fees && ` The platform keeps ${pct(fees.feeBps)} of the payout when you approve.`}
      </p>
      <button type="submit" className="btn btn--primary" disabled={disabled || !ready || bytes > 280 || pay <= 0}>
        Post job and escrow {pay} SOL
      </button>
      {!connected && <p className="helper">Connect a devnet wallet to post a job.</p>}
    </form>
  );
}
