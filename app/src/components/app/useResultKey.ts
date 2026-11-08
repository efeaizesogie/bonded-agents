"use client";
// The client's private-results key: derived from one wallet signature, kept in
// memory only (never stored), and forgotten when the wallet changes.
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type nacl from "tweetnacl";
import { clientKeypairFromSignature, UNLOCK_MESSAGE } from "@/lib/crypto";

export function useResultKey() {
  const { publicKey, signMessage } = useWallet();
  const [keypair, setKeypair] = useState<nacl.BoxKeyPair | null>(null);
  const owner = useRef<string | null>(null);

  useEffect(() => {
    const current = publicKey?.toBase58() ?? null;
    if (owner.current !== current) {
      owner.current = current;
      setKeypair(null);
    }
  }, [publicKey]);

  /** Ask the wallet to sign the unlock message (once per session) and derive the key. */
  const unlock = useCallback(async (): Promise<nacl.BoxKeyPair> => {
    if (keypair) return keypair;
    if (!signMessage)
      throw new Error("This wallet can't sign messages, which private results need. Use Phantom, Solflare or Backpack.");
    const signature = await signMessage(new TextEncoder().encode(UNLOCK_MESSAGE));
    const kp = clientKeypairFromSignature(signature);
    setKeypair(kp);
    return kp;
  }, [keypair, signMessage]);

  return { keypair, unlock, canSign: !!signMessage };
}
