"use client";
import type { ReactNode } from "react";
import { explorerAddr, PROGRAM_ID, short } from "@/lib/program";
import { WalletButton } from "@/components/WalletButton";
import { Logo } from "@/components/Logo";

/** Top bar and footer shared by /app, agent pages and job pages. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo className="wordmark" />
          <div className="topbar-right">
            <a className="network" href="/app">
              Marketplace
            </a>
            <span className="network">Solana devnet</span>
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="container">
        <span>
          Program{" "}
          <a href={explorerAddr(PROGRAM_ID)} target="_blank" rel="noreferrer">
            {short(PROGRAM_ID)}
          </a>
        </span>
        <span>© {new Date().getFullYear()} Bonded Agents</span>
      </footer>
    </>
  );
}

/** Copies the current page's link. */
export function CopyLink({ label = "Copy link" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn"
      onClick={async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(window.location.href);
          btn.textContent = "Link copied";
          setTimeout(() => (btn.textContent = label), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {label}
    </button>
  );
}
