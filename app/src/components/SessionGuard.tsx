"use client";
// Disconnects the wallet after SESSION_TIMEOUT_HOURS without user activity.
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef } from "react";
import { isSessionExpired, markActive } from "@/lib/session";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"] as const;
const WRITE_EVERY_MS = 30_000; // throttle localStorage writes
const CHECK_EVERY_MS = 60_000;

export function SessionGuard({ onExpire }: { onExpire?: () => void }) {
  const { connected, disconnect } = useWallet();
  const lastWrite = useRef(0);

  // A fresh connection counts as activity.
  useEffect(() => {
    if (connected) {
      markActive();
      lastWrite.current = Date.now();
    }
  }, [connected]);

  // Record activity while connected.
  useEffect(() => {
    if (!connected) return;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite.current < WRITE_EVERY_MS) return;
      lastWrite.current = now;
      markActive(now);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
  }, [connected]);

  // Sign out once the idle limit passes (checked every minute and when the tab comes back).
  useEffect(() => {
    if (!connected) return;
    const check = () => {
      if (!isSessionExpired()) return;
      disconnect().catch(() => {});
      onExpire?.();
    };
    const id = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [connected, disconnect, onExpire]);

  return null;
}
