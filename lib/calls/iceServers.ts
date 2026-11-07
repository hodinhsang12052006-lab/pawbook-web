// Server-only. ICE servers (STUN + optional TURN) for 1:1 WebRTC calls, served by GET /api/calls/ice.
//
// Why TURN matters: STUN only tells each phone its public address. Two phones behind "symmetric" / carrier-grade NAT
// (very common on 4G/5G and office Wi-Fi) cannot reach each other directly; their media must be relayed through a
// TURN server. Media stays end-to-end encrypted (DTLS-SRTP) — the relay forwards packets it cannot decode.
//
// Sources, combined (none → STUN only, which still works on most home Wi-Fi):
//   1. STUN: Google public STUN (CALL_STUN_URLS overrides; set it to "" to disable, e.g. offline tests).
//   2. Cloudflare Realtime TURN: CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN → short-lived credentials minted per
//      instance (cached 10 min, credential ttl 1 h). The API token NEVER leaves the server.
//   3. Generic TURN (e.g. coturn): TURN_URLS (comma list) +
//        TURN_SECRET (coturn "use-auth-secret": ephemeral HMAC credentials per user, recommended), or
//        TURN_USERNAME / TURN_CREDENTIAL (static — visible to every signed-in user, so only for a dedicated relay).
// Test hook (local only, refused on Vercel): CLOUDFLARE_TURN_ALLOW_TEST=1 + CLOUDFLARE_TURN_TEST_BASE=http://127.0.0.1:PORT.
import { createHmac } from "node:crypto";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceResult {
  iceServers: IceServer[];
  /** how long the client may reuse this list (seconds) */
  ttlSec: number;
  hasTurn: boolean;
}

type Env = Record<string, string | undefined>;

export interface IceDeps {
  env?: Env;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (msg: string) => void;
}

export const DEFAULT_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];
const CF_BASE = "https://rtc.live.cloudflare.com/v1";
// 1 h: enough for a call (the client refreshes its list during long calls) and limits what a harvested credential is worth.
const CF_TTL_SEC = 3600;
const CF_CACHE_MS = 10 * 60 * 1000;
const CF_TIMEOUT_MS = 4000;
const SECRET_TTL_SEC = 2 * 60 * 60;
const STUN_ONLY_TTL_SEC = 3600;

const URL_RE = /^(stun|stuns|turn|turns):[^\s]{3,200}$/i;
// Cloudflare also lists alternate port-53 URLs; browsers block port 53, so they only slow ICE down.
const PORT_53_RE = /:53(\?|$)/;

const onVercel = (env: Env) => !!(env.VERCEL || env.VERCEL_ENV);

function cleanUrls(urls: unknown): string[] {
  const list = Array.isArray(urls) ? urls : typeof urls === "string" ? [urls] : [];
  return list.filter((u): u is string => typeof u === "string" && URL_RE.test(u.trim()) && !PORT_53_RE.test(u.trim())).map((u) => u.trim());
}

function stunServers(env: Env): IceServer[] {
  const raw = env.CALL_STUN_URLS;
  const urls = raw === undefined ? DEFAULT_STUN : cleanUrls(raw.split(",")).filter((u) => /^stuns?:/i.test(u));
  return urls.length ? [{ urls }] : [];
}

function cloudflareBase(env: Env, log: (m: string) => void): string {
  if (env.CLOUDFLARE_TURN_ALLOW_TEST === "1" && env.CLOUDFLARE_TURN_TEST_BASE) {
    if (onVercel(env)) {
      log("CLOUDFLARE_TURN_ALLOW_TEST is set on Vercel — ignored (test-only flag).");
    } else if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.CLOUDFLARE_TURN_TEST_BASE)) {
      return env.CLOUDFLARE_TURN_TEST_BASE;
    }
  }
  return CF_BASE;
}

/** Accepts both Cloudflare shapes: {iceServers:[…]} (generate-ice-servers) and {iceServers:{urls,username,credential}} (older generate). */
export function parseCloudflareIce(body: unknown): IceServer[] {
  const raw = (body as { iceServers?: unknown } | null)?.iceServers;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const out: IceServer[] = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const o = s as { urls?: unknown; username?: unknown; credential?: unknown };
    const urls = cleanUrls(o.urls);
    if (!urls.length) continue;
    const isTurn = urls.some((u) => /^turns?:/i.test(u));
    if (isTurn) {
      if (typeof o.username !== "string" || typeof o.credential !== "string" || !o.username || !o.credential) continue;
      out.push({ urls, username: o.username, credential: o.credential });
    } else {
      out.push({ urls });
    }
  }
  return out;
}

let cfCache: { at: number; servers: IceServer[] } | null = null;
let lastErrorLogAt = 0;

/** Test helper: forget the per-instance Cloudflare cache. */
export function resetIceCache() {
  cfCache = null;
  lastErrorLogAt = 0;
}

async function cloudflareServers(env: Env, deps: Required<Pick<IceDeps, "fetch" | "now" | "log">>): Promise<{ servers: IceServer[]; ttlSec: number } | null> {
  const keyId = env.CLOUDFLARE_TURN_KEY_ID;
  const token = env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;
  const now = deps.now();
  if (cfCache && now - cfCache.at < CF_CACHE_MS) {
    return { servers: cfCache.servers, ttlSec: Math.max(60, CF_TTL_SEC - Math.round((now - cfCache.at) / 1000)) };
  }
  const url = `${cloudflareBase(env, deps.log)}/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CF_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: CF_TTL_SEC }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Cloudflare TURN HTTP ${res.status}`);
    const servers = parseCloudflareIce(await res.json());
    if (!servers.some((s) => s.username)) throw new Error("Cloudflare TURN: no TURN entry in response");
    cfCache = { at: now, servers };
    return { servers, ttlSec: CF_TTL_SEC };
  } catch (err) {
    if (now - lastErrorLogAt > CF_CACHE_MS) {
      lastErrorLogAt = now;
      // Never log the token or the response body (it carries credentials).
      deps.log(`Cloudflare TURN unavailable, falling back to STUN only: ${err instanceof Error ? err.name + " " + err.message.slice(0, 80) : "error"}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function genericTurn(env: Env, userId: string, nowMs: number): { servers: IceServer[]; ttlSec: number } | null {
  const urls = cleanUrls((env.TURN_URLS || "").split(",")).filter((u) => /^turns?:/i.test(u));
  if (!urls.length) return null;
  if (env.TURN_SECRET) {
    const exp = Math.floor(nowMs / 1000) + SECRET_TTL_SEC;
    const username = `${exp}:${userId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "u"}`;
    const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");
    return { servers: [{ urls, username, credential }], ttlSec: SECRET_TTL_SEC };
  }
  if (env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    return { servers: [{ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }], ttlSec: 24 * 3600 };
  }
  return null;
}

export async function buildIceServers(userId: string, deps: IceDeps = {}): Promise<IceResult> {
  const env = deps.env ?? process.env;
  const d = {
    fetch: deps.fetch ?? fetch,
    now: deps.now ?? Date.now,
    log: deps.log ?? ((m: string) => console.warn(m)),
  };
  const iceServers: IceServer[] = [...stunServers(env)];
  let ttlSec = Infinity;
  const cf = await cloudflareServers(env, d);
  if (cf) {
    iceServers.push(...cf.servers);
    ttlSec = Math.min(ttlSec, cf.ttlSec);
  }
  const gen = genericTurn(env, userId, d.now());
  if (gen) {
    iceServers.push(...gen.servers);
    ttlSec = Math.min(ttlSec, gen.ttlSec);
  }
  if (!Number.isFinite(ttlSec)) ttlSec = STUN_ONLY_TTL_SEC;
  const hasTurn = iceServers.some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u)));
  return { iceServers, ttlSec, hasTurn };
}
