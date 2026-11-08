"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { resetTestWallet, TestWalletName } from "@/lib/testWallet";

/** Shown only while the burner "Devnet test wallet" is connected. */
export function TestWalletBar() {
  const { connection } = useConnection();
  const { wallet, publicKey, disconnect } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const active = wallet?.adapter.name === TestWalletName && !!publicKey;

  const load = useCallback(async () => {
    if (!active || !publicKey) return;
    try {
      setBalance((await connection.getBalance(publicKey, "confirmed")) / LAMPORTS_PER_SOL);
    } catch {
      setBalance(null);
    }
  }, [active, connection, publicKey]);

  useEffect(() => {
    load();
    if (!active) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [active, load]);

  if (!active || !publicKey) return null;

  const airdrop = async () => {
    setState("busy");
    setMessage(null);
    try {
      // The app's own faucet first: the public devnet airdrop is often closed.
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      });
      const res = (await r.json()) as { sol?: number; error?: string };
      if (r.ok) {
        setState("idle");
        setMessage(`${res.sol} test SOL received. That covers a job and its fees.`);
        load();
        return;
      }
      if (r.status === 429) {
        setState("idle");
        setMessage(res.error ?? "This wallet already has enough test SOL.");
        return;
      }
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      setState("idle");
      setMessage("1 test SOL received.");
      load();
    } catch (e) {
      setState("error");
      setMessage(
        `The public faucet refused (${e instanceof Error ? e.message : String(e)}). ` +
          "Paste this address at faucet.solana.com instead.",
      );
    }
  };

  const address = publicKey.toBase58();
  return (
    <div className="notice test-wallet" role="region" aria-label="Devnet test wallet">
      <span>
        <strong>Devnet test wallet</strong> <code>{address}</code>{" "}
        {balance === null ? "" : `${balance.toFixed(3)} SOL`}
      </span>
      <span className="test-wallet-actions">
        <button type="button" className="btn" disabled={state === "busy"} onClick={airdrop}>
          {state === "busy" ? "Requesting…" : "Get test SOL"}
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => navigator.clipboard?.writeText(address)}
        >
          Copy address
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={async () => {
            await disconnect();
            resetTestWallet();
          }}
        >
          Forget wallet
        </button>
      </span>
      {message && <span className={state === "error" ? "danger-text" : undefined}>{message}</span>}
    </div>
  );
}
