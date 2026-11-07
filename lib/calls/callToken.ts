// Server-only (Node `crypto`). Never import from a "use client" file.
//
// A call token proves that BOTH people are in one specific call without a database row (no Prisma schema change):
// the caller's offer mints it, the callee receives it inside `incoming-call`, and every later action (accept /
// reject / busy / signal) must carry it. The server then knows that the session user is one of the two parties, that
// `targetId` is the other one and that the callId matches, so a stranger who only knows someone's user id (public via
// /profile/<id>) can no longer inject SDP / ICE / hang-ups into a call they are not part of.
//
// Format: base64url(JSON claims) + "." + base64url(HMAC-SHA256(claims part)).
// Key: CALL_SIGNING_SECRET (≥ 16 chars) if set, otherwise HKDF(NEXTAUTH_SECRET, info "pawnail-call-v1").
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export type CallKind = "audio" | "video";

export interface CallClaims {
  v: 1;
  /** caller user id */
  c: string;
  /** callee user id */
  e: string;
  /** call id (client-generated, [a-z0-9]{4,24}) */
  i: string;
  t: CallKind;
  /** expiry, ms since epoch */
  x: number;
}

export const CALL_TOKEN_TTL_MS = 3 * 60 * 60 * 1000;
export const CALL_ID_RE = /^[a-z0-9]{4,24}$/;
const MAX_TOKEN_LEN = 1024;

type Env = Record<string, string | undefined>;

export function callSigningKey(env: Env = process.env): Buffer | null {
  const own = env.CALL_SIGNING_SECRET;
  if (own && own.length >= 16) return Buffer.from(own, "utf8");
  const base = env.NEXTAUTH_SECRET;
  if (!base) return null;
  return Buffer.from(hkdfSync("sha256", Buffer.from(base, "utf8"), Buffer.from("pawnail-call", "utf8"), Buffer.from("pawnail-call-v1", "utf8"), 32));
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (key: Buffer, body: string) => createHmac("sha256", key).update(body).digest();

export function signCallToken(
  p: { callerId: string; calleeId: string; callId: string; callType: CallKind },
  opts: { now?: number; env?: Env; ttlMs?: number } = {}
): string | null {
  const key = callSigningKey(opts.env);
  if (!key) return null;
  if (!p.callerId || !p.calleeId || p.callerId === p.calleeId || !CALL_ID_RE.test(p.callId)) return null;
  const claims: CallClaims = {
    v: 1,
    c: p.callerId,
    e: p.calleeId,
    i: p.callId,
    t: p.callType === "video" ? "video" : "audio",
    x: (opts.now ?? Date.now()) + (opts.ttlMs ?? CALL_TOKEN_TTL_MS),
  };
  const body = b64u(JSON.stringify(claims));
  return `${body}.${b64u(mac(key, body))}`;
}

/**
 * Claims only when: the signature is valid (timing-safe), the token has not expired, the session user is one of the
 * two parties, `targetId` is the OTHER party and `callId` equals the token's call id. Anything else → null.
 */
export function verifyCallToken(
  token: unknown,
  ctx: { userId: string; targetId: string; callId: unknown; now?: number; env?: Env }
): CallClaims | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LEN) return null;
  const key = callSigningKey(ctx.env);
  if (!key) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  let sig: Buffer;
  try {
    sig = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  const want = mac(key, body);
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  let claims: CallClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || claims.v !== 1 || typeof claims.c !== "string" || typeof claims.e !== "string" || typeof claims.i !== "string") return null;
  if (typeof claims.x !== "number" || claims.x <= (ctx.now ?? Date.now())) return null;
  if (typeof ctx.callId !== "string" || claims.i !== ctx.callId) return null;
  const me = ctx.userId;
  const other = me === claims.c ? claims.e : me === claims.e ? claims.c : null;
  if (!other || other !== ctx.targetId) return null;
  return claims;
}

/** Short random call id for server-minted calls (legacy clients that send no callId). */
export function newCallId(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-3);
}
