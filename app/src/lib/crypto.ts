// Private job results.
//
// Everything on a blockchain is public, so results are encrypted before they
// are stored. Only two keys can open them:
//   - the client who posted the job (key derived from a wallet signature), and
//   - the AI judge (needs to read the work to rule on a dispute).
//
// Envelope ("enc1:" + base64):
//   version(1) | ephemeralPub(32)
//   | nonceClient(24) | box(contentKey -> client)(48)
//   | nonceJudge(24)  | box(contentKey -> judge)(48)
//   | nonceBody(24)   | secretbox(result, contentKey)(len + 16)
import { deflateSync, inflateSync } from "fflate";
import nacl from "tweetnacl";

export const ENC_PREFIX = "enc1:";
const VERSION = 1; // body is plain text (short answers stored in the job itself)
const VERSION_DEFLATE = 2; // body is deflated (long reports stored in memo transactions)
export const MAX_PLAINTEXT_BYTES = 600;
export const MAX_REPORT_BYTES = 40_000;

/** The message a client signs once to unlock their results. Never changes. */
export const UNLOCK_MESSAGE =
  "Bonded Agents: unlock my private job results.\n\nSigning this costs nothing and does not send a transaction.";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(text: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(text, "base64"));
  const bin = atob(text);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** A client's encryption keypair, derived from their signature of UNLOCK_MESSAGE.
 *  Ed25519 signatures are deterministic, so the same wallet always gets the same key. */
export function clientKeypairFromSignature(signature: Uint8Array): nacl.BoxKeyPair {
  return nacl.box.keyPair.fromSecretKey(nacl.hash(signature).subarray(0, 32));
}

/** The judge's encryption keypair, derived from the arbiter's Solana secret key. */
export function arbiterKeypairFromSecret(arbiterSecretKey: Uint8Array): nacl.BoxKeyPair {
  const tag = enc.encode("bonded-agents/arbiter-encryption/v1");
  const seed = new Uint8Array(arbiterSecretKey.length + tag.length);
  seed.set(arbiterSecretKey);
  seed.set(tag, arbiterSecretKey.length);
  return nacl.box.keyPair.fromSecretKey(nacl.hash(seed).subarray(0, 32));
}

export function isEncrypted(result: string): boolean {
  return result.startsWith(ENC_PREFIX);
}

export function isZeroKey(key: Uint8Array | number[]): boolean {
  return Array.from(key).every((b) => b === 0);
}

/** Encrypt a result so only the client and the judge can read it. */
export function sealResult(
  plaintext: string,
  clientPub: Uint8Array,
  judgePub: Uint8Array,
  opts: { compress?: boolean } = {},
): string {
  const raw = enc.encode(plaintext);
  const limit = opts.compress ? MAX_REPORT_BYTES : MAX_PLAINTEXT_BYTES;
  if (raw.length > limit) throw new Error(`Result is ${raw.length} bytes; the limit is ${limit}.`);
  const body = opts.compress ? deflateSync(raw, { level: 9 }) : raw;
  const contentKey = nacl.randomBytes(32);
  const eph = nacl.box.keyPair();
  const nClient = nacl.randomBytes(24);
  const nJudge = nacl.randomBytes(24);
  const nBody = nacl.randomBytes(24);
  const forClient = nacl.box(contentKey, nClient, clientPub, eph.secretKey);
  const forJudge = nacl.box(contentKey, nJudge, judgePub, eph.secretKey);
  const sealed = nacl.secretbox(body, nBody, contentKey);
  const parts = [Uint8Array.of(opts.compress ? VERSION_DEFLATE : VERSION), eph.publicKey, nClient, forClient, nJudge, forJudge, nBody, sealed];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return ENC_PREFIX + toB64(out);
}

/** Open a sealed result as the client or the judge. Throws if the key doesn't fit. */
export function openResult(envelope: string, secretKey: Uint8Array, as: "client" | "judge"): string {
  if (!isEncrypted(envelope)) return envelope; // results from before encryption existed
  const b = fromB64(envelope.slice(ENC_PREFIX.length));
  if (b[0] !== VERSION && b[0] !== VERSION_DEFLATE) throw new Error("Unknown result format.");
  let o = 1;
  const take = (n: number) => b.subarray(o, (o += n));
  const ephPub = take(32);
  const nClient = take(24);
  const forClient = take(48);
  const nJudge = take(24);
  const forJudge = take(48);
  const nBody = take(24);
  const sealed = b.subarray(o);
  const contentKey =
    as === "client"
      ? nacl.box.open(forClient, nClient, ephPub, secretKey)
      : nacl.box.open(forJudge, nJudge, ephPub, secretKey);
  if (!contentKey) throw new Error("This key can't open the result.");
  const body = nacl.secretbox.open(sealed, nBody, contentKey);
  if (!body) throw new Error("The result was tampered with or is corrupt.");
  return dec.decode(b[0] === VERSION_DEFLATE ? inflateSync(body) : body);
}
