"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useMemo, type ReactNode } from "react";
import { RPC_URL } from "@/lib/program";
import { expireStaleSession } from "@/lib/session";
import { DevnetTestWalletAdapter, testWalletAllowed } from "@/lib/testWallet";

// Before the wallet provider reads its remembered wallet, drop it if the last
// session went idle for longer than the timeout, so the user must reconnect.
expireStaleSession();

// Wallets implementing the Wallet Standard (Phantom, Solflare, Backpack…) are
// detected automatically. In development on devnet we also offer a burner
// "Devnet test wallet" so the app can be tested without an extension.
export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => (testWalletAllowed() ? [new DevnetTestWalletAdapter()] : []),
    [],
  );
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
