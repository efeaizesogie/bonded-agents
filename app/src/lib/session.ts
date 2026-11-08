// Wallet session: forget the connected wallet after a stretch of inactivity,
// so the next visit asks the user to connect again.
//
// Inactivity = no pointer, key, scroll or touch activity in any open tab.
// Set NEXT_PUBLIC_SESSION_TIMEOUT_HOURS to change the limit (default 2 hours).

/** Key the wallet adapter uses to remember the chosen wallet (its default). */
export const WALLET_NAME_KEY = "walletName";
const LAST_ACTIVE_KEY = "bonded-agents:last-active";

export const SESSION_TIMEOUT_HOURS = (() => {
  const n = Number(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 2;
})();
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the session simply won't persist */
  }
}

export function lastActive(): number | null {
  const raw = read(LAST_ACTIVE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function markActive(now = Date.now()) {
  write(LAST_ACTIVE_KEY, String(now));
}

export function isSessionExpired(now = Date.now()): boolean {
  const last = lastActive();
  return last !== null && now - last > SESSION_TIMEOUT_MS;
}

/**
 * Run before the wallet provider mounts: if the last session went stale,
 * forget the remembered wallet so it does not auto-reconnect.
 */
export function expireStaleSession(): boolean {
  if (typeof window === "undefined") return false;
  if (!isSessionExpired()) return false;
  write(WALLET_NAME_KEY, null);
  write(LAST_ACTIVE_KEY, null);
  return true;
}

export function formatTimeout(): string {
  const h = SESSION_TIMEOUT_HOURS;
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  return h === 1 ? "1 hour" : `${h} hours`;
}
