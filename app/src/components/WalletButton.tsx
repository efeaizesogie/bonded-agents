"use client";
// Themed wallet controls: a connect dialog that lists detected wallets, and a
// popover for the connected wallet with its SOL balance and token holdings.
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { explorerAddr, short } from "@/lib/program";
import { formatTimeout } from "@/lib/session";
import { SessionGuard } from "./SessionGuard";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const EXPIRED_FLAG = "bonded-agents:session-expired";

/** Mints we can name without a metadata lookup. */
const KNOWN_MINTS: Record<string, string> = {
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC (devnet)",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "Wrapped SOL",
};

/** Shown when a popular wallet isn't installed in this browser. */
const SUGGESTED = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/downloads" },
];

type Token = { mint: string; label: string; amount: string; program: "SPL" | "Token-2022" };
type Holdings =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; sol: number; tokens: Token[] };

export function WalletButton() {
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect } = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expiredNote, setExpiredNote] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Wallet detection only happens in the browser; render the live state after
  // mount so the server HTML and the first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A session that ended for inactivity says so the next time the dialog opens.
  useEffect(() => {
    try {
      setExpiredNote(window.sessionStorage.getItem(EXPIRED_FLAG) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const onExpire = useCallback(() => {
    setMenuOpen(false);
    setExpiredNote(true);
    try {
      window.sessionStorage.setItem(EXPIRED_FLAG, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    setDialogOpen(false);
    setPending(null);
    setError(null);
    setExpiredNote(false);
    try {
      window.sessionStorage.removeItem(EXPIRED_FLAG);
    } catch {
      /* ignore */
    }
  }, [connected]);

  const choose = async (name: WalletName) => {
    setError(null);
    setPending(name);
    try {
      if (wallet?.adapter.name === name) await connect();
      else select(name); // the provider connects as soon as the wallet is selected
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // A selection that fails to connect (rejected in the wallet, locked, …) clears the pending state.
  useEffect(() => {
    if (!pending || connecting || connected) return;
    const id = setTimeout(() => {
      if (!connected) {
        setPending(null);
        setError("The wallet didn't connect. Unlock it or approve the request, then try again.");
      }
    }, 12000);
    return () => clearTimeout(id);
  }, [pending, connecting, connected]);

  if (!mounted) {
    return (
      <div className="wallet">
        <button type="button" className="btn wallet-trigger" disabled>
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="wallet">
      <SessionGuard onExpire={onExpire} />
      {connected && publicKey ? (
        <>
          <button
            type="button"
            className="btn wallet-trigger"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {wallet && <img src={wallet.adapter.icon} alt="" width={18} height={18} />}
            <span className="num">{short(publicKey)}</span>
          </button>
          {menuOpen && (
            <WalletMenu
              onClose={() => setMenuOpen(false)}
              onChange={() => {
                setMenuOpen(false);
                setDialogOpen(true);
              }}
              onDisconnect={async () => {
                setMenuOpen(false);
                await disconnect();
              }}
            />
          )}
        </>
      ) : (
        <button type="button" className="btn wallet-trigger" onClick={() => setDialogOpen(true)} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      <ConnectDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setPending(null);
        }}
        wallets={wallets}
        pending={pending}
        error={error}
        expiredNote={expiredNote}
        onChoose={choose}
      />
    </div>
  );
}

function ConnectDialog({
  open,
  onClose,
  wallets,
  pending,
  error,
  expiredNote,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  wallets: ReturnType<typeof useWallet>["wallets"];
  pending: string | null;
  error: string | null;
  expiredNote: boolean;
  onChoose: (name: WalletName) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const ready = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );
  const readyNames = new Set(ready.map((w) => w.adapter.name.toLowerCase()));
  const suggestions = SUGGESTED.filter((s) => !readyNames.has(s.name.toLowerCase()));

  return (
    <dialog
      ref={ref}
      className="connect-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
    >
      <div className="connect-head">
        <h2 id={titleId}>Connect a wallet</h2>
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Close
        </button>
      </div>
      {expiredNote && (
        <p className="connect-note">
          You were signed out after {formatTimeout()} without activity. Connect again to continue.
        </p>
      )}
      <p className="connect-lead">
        Your wallet signs each job, approval and dispute. Bonded Agents never holds your keys.
      </p>

      {ready.length > 0 ? (
        <ul className="wallet-list" role="list">
          {ready.map((w) => (
            <li key={w.adapter.name}>
              <button
                type="button"
                className="wallet-option"
                onClick={() => onChoose(w.adapter.name)}
                disabled={!!pending}
              >
                <img src={w.adapter.icon} alt="" width={32} height={32} />
                <span className="wallet-option-name">{w.adapter.name}</span>
                <span className="wallet-option-state">
                  {pending === w.adapter.name
                    ? "Connecting…"
                    : w.readyState === WalletReadyState.Installed
                      ? "Detected"
                      : "Built in, devnet only"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="connect-empty">No Solana wallet was found in this browser.</p>
      )}

      {error && (
        <p className="connect-error" role="alert">
          {error}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="wallet-suggest">
          <p>Don&apos;t have one? Install a wallet, then reload this page.</p>
          <ul role="list">
            {suggestions.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  Get {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}

function WalletMenu({
  onClose,
  onChange,
  onDisconnect,
}: {
  onClose: () => void;
  onChange: () => void;
  onDisconnect: () => void;
}) {
  const { connection } = useConnection();
  const { wallet, publicKey } = useWallet();
  const [holdings, setHoldings] = useState<Holdings>({ state: "loading" });
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const load = useCallback(async () => {
    if (!publicKey) return;
    setHoldings((h) => (h.state === "ready" ? h : { state: "loading" }));
    try {
      const [lamports, spl, t22] = await Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM }),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM }),
      ]);
      const toTokens = (list: typeof spl.value, program: Token["program"]): Token[] =>
        list
          .map(({ account }) => {
            const info = (account.data as { parsed: { info: { mint: string; tokenAmount: { uiAmountString: string; uiAmount: number | null } } } }).parsed.info;
            return {
              mint: info.mint,
              label: KNOWN_MINTS[info.mint] ?? short(info.mint),
              amount: info.tokenAmount.uiAmountString,
              program,
              nonzero: (info.tokenAmount.uiAmount ?? 0) > 0,
            };
          })
          .filter((t) => t.nonzero)
          .map(({ nonzero: _n, ...t }) => t);
      setHoldings({
        state: "ready",
        sol: lamports / LAMPORTS_PER_SOL,
        tokens: [...toTokens(spl.value, "SPL"), ...toTokens(t22.value, "Token-2022")],
      });
    } catch (e) {
      setHoldings({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [connection, publicKey]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  // Close on Escape or a click outside; focus the panel when it opens.
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const root = ref.current?.parentElement;
      if (root && !root.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  if (!publicKey) return null;
  const address = publicKey.toBase58();

  return (
    <div ref={ref} className="wallet-menu" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
      <div className="wallet-menu-head">
        {wallet && <img src={wallet.adapter.icon} alt="" width={24} height={24} />}
        <div>
          <p id={titleId} className="wallet-menu-name">
            {wallet?.adapter.name ?? "Wallet"}
          </p>
          <p className="wallet-menu-address num">{short(address)}</p>
        </div>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="wallet-balance">
        <span className="label">Balance</span>
        {holdings.state === "ready" ? (
          <p className="wallet-balance-figure">
            {holdings.sol.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            <small>SOL</small>
          </p>
        ) : holdings.state === "loading" ? (
          <p className="wallet-balance-figure is-loading" aria-busy="true">
            <span className="skeleton" />
          </p>
        ) : (
          <p className="wallet-balance-figure is-muted">Unavailable</p>
        )}
      </div>

      <div className="wallet-tokens">
        <span className="label">Tokens</span>
        {holdings.state === "loading" && (
          <ul className="token-list" role="list" aria-busy="true">
            <li className="skeleton-row" />
            <li className="skeleton-row" />
          </ul>
        )}
        {holdings.state === "error" && (
          <div className="wallet-error" role="alert">
            <p>Couldn&apos;t load balances. The devnet RPC may be busy.</p>
            <button type="button" className="btn" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {holdings.state === "ready" &&
          (holdings.tokens.length === 0 ? (
            <p className="wallet-empty">No tokens in this wallet yet. Only SOL.</p>
          ) : (
            <ul className="token-list" role="list">
              {holdings.tokens.map((t) => (
                <li key={`${t.program}-${t.mint}`}>
                  <a href={explorerAddr(t.mint)} target="_blank" rel="noreferrer" className="token-name">
                    {t.label}
                  </a>
                  <span className="token-amount num">{t.amount}</span>
                  {t.program === "Token-2022" && <span className="token-kind">Token-2022</span>}
                </li>
              ))}
            </ul>
          ))}
      </div>

      <div className="wallet-menu-actions">
        <a className="btn btn--quiet" href={explorerAddr(address)} target="_blank" rel="noreferrer">
          View on Explorer
        </a>
        <button type="button" className="btn btn--quiet" onClick={onChange}>
          Change wallet
        </button>
        <button type="button" className="btn btn--danger" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
      <p className="wallet-session">
        Signs out after {formatTimeout()} without activity.
      </p>
    </div>
  );
}
