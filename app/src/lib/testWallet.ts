// Devnet test wallet: a burner keypair kept in this browser's localStorage, so
// you can click through the whole app without installing Phantom. It is only
// offered in development (or with NEXT_PUBLIC_TEST_WALLET=on) and only when the
// RPC points at devnet or a local validator. Never put real funds in it: the
// secret key sits in plain text in localStorage.
import {
  BaseMessageSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, Transaction, VersionedTransaction, type PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { RPC_URL } from "./program";

export const TestWalletName = "Devnet test wallet" as WalletName<"Devnet test wallet">;
const STORAGE_KEY = "bonded-agents:devnet-test-wallet";

const ICON =
  "data:image/svg+xml;base64," +
  (typeof btoa === "function"
    ? btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1f1b17"/><path d="M9 13h14v10H9z" fill="none" stroke="#f6f1e9" stroke-width="2"/><path d="M12 13v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#f6f1e9" stroke-width="2"/></svg>',
      )
    : "");

export function testWalletAllowed(): boolean {
  const flag = process.env.NEXT_PUBLIC_TEST_WALLET;
  const enabled = flag === "on" || (flag !== "off" && process.env.NODE_ENV !== "production");
  const safeCluster = /devnet|localhost|127\.0\.0\.1/.test(RPC_URL);
  return enabled && safeCluster;
}

function loadOrCreate(): Keypair {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved) as number[]));
  } catch {
    /* storage blocked or corrupt: fall through to a fresh key */
  }
  const kp = Keypair.generate();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...kp.secretKey]));
  } catch {
    /* private window: the key lives for this tab only */
  }
  return kp;
}

/** Forget the stored key (the next connect makes a new, empty wallet). */
export function resetTestWallet() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export class DevnetTestWalletAdapter extends BaseMessageSignerWalletAdapter<"Devnet test wallet"> {
  name = TestWalletName;
  url = "https://faucet.solana.com";
  icon = ICON;
  supportedTransactionVersions = new Set(["legacy", 0] as const);

  private _keypair: Keypair | null = null;
  private _connecting = false;

  get publicKey(): PublicKey | null {
    return this._keypair?.publicKey ?? null;
  }
  get connecting() {
    return this._connecting;
  }
  get readyState() {
    return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Loadable;
  }

  async connect(): Promise<void> {
    if (this._keypair || this._connecting) return;
    this._connecting = true;
    try {
      this._keypair = loadOrCreate();
      this.emit("connect", this._keypair.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this._keypair = null;
    this.emit("disconnect");
  }

  /** Sign arbitrary bytes, like Phantom's signMessage (used to unlock private results). */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    return nacl.sign.detached(message, kp.secretKey);
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    if (transaction instanceof VersionedTransaction) transaction.sign([kp]);
    else transaction.partialSign(kp);
    return transaction;
  }
}
