// Browser side of GET /api/calls/ice: STUN/TURN list for calls, cached until shortly before the TURN credentials expire.
//
// Before: every page load and every call fetched a fresh list, each tab/app instance re-fetched every 5 min, and the
// route allowed 30 requests / hour — heavy use hit 429 and the call silently went out without TURN (no relay = no call
// between two phones on 4G). Now:
//   • one list per user per tab, kept in memory + sessionStorage (survives a reload) until EXPIRY_MARGIN before the
//     credentials expire; a call start needs it valid for ≥ CALL_MIN_VALID_MS, so there is at most one fetch per call;
//   • concurrent callers (dial prefetch + engine start) share one in-flight request;
//   • a failed fetch (network, 5xx, 429) is retried ONCE; if TURN is configured on the server but the list came back
//     without it (or could not be fetched at all) a Sentry warning is sent — never a silent fallback. The last good
//     list is reused while it is still valid; otherwise STUN only;
//   • a TURN-less list from a server that HAS TURN configured is reused only briefly (the next call asks again).
// Pure module (no React): scripts/qa/call_ice_client_unit.mts.

export interface IceListResponse {
  iceServers?: unknown;
  ttlSec?: unknown;
  hasTurn?: unknown;
  turnConfigured?: unknown;
}

export interface CachedIce {
  servers: RTCIceServer[];
  hasTurn: boolean;
  turnConfigured: boolean;
  fetchedAt: number;
  /** epoch ms after which the list must not be used for a new call */
  expiresAt: number;
}

export const DEFAULT_ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
/** Stop using a list this long before its credentials expire (clock skew, ICE restarts late in a call). */
export const EXPIRY_MARGIN_MS = 5 * 60_000;
/** A call start needs a list valid for at least this long (else it fetches a fresh one): the first in-call refresh
 * (CallManager, every 10 min) then still finds valid credentials to replace. */
export const CALL_MIN_VALID_MS = 15 * 60_000;
/** During a call the list is refreshed when less than this is left (the call may need an ICE restart later). */
export const IN_CALL_MIN_VALID_MS = 15 * 60_000;
export const RETRY_DELAY_MS = 1_500;
/** A list fetched this recently is reused whatever its remaining validity. */
export const FRESH_MS = 30_000;
const STORE_KEY = "pn_ice_v1";
const STORE_TTL_CAP_MS = 2 * 60 * 60_000;

type Report = (msg: string, extra: Record<string, unknown>) => void;

export interface IceClientDeps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  report?: Report;
  endpoint?: string;
}

const validServers = (v: unknown): v is RTCIceServer[] =>
  Array.isArray(v) && v.every((s) => s && typeof s === "object" && (typeof (s as RTCIceServer).urls === "string" || Array.isArray((s as RTCIceServer).urls)));

/** Turn an /api/calls/ice answer into a cache entry (null if malformed). */
export function toCached(d: IceListResponse, now: number): CachedIce | null {
  if (!validServers(d.iceServers)) return null;
  const ttlMs = Math.max(30, Number(d.ttlSec) || 600) * 1000;
  // Keep the margin proportional for short lists (a 60 s TURN-less list is reusable for ~45 s, not "already expired").
  const margin = Math.min(EXPIRY_MARGIN_MS, ttlMs / 4);
  return {
    servers: d.iceServers,
    hasTurn: d.hasTurn !== false,
    turnConfigured: d.turnConfigured === true,
    fetchedAt: now,
    expiresAt: now + Math.min(ttlMs, STORE_TTL_CAP_MS) - margin,
  };
}

export interface IceResult {
  servers: RTCIceServer[];
  hasTurn: boolean;
  source: "cache" | "network" | "stale" | "default";
}

export interface IceClient {
  /** The list for a call: cached while valid for ≥ minValidMs (default CALL_MIN_VALID_MS), else fetched (once). */
  get(opts?: { minValidMs?: number }): Promise<IceResult>;
  peek(): CachedIce | null;
  /** network requests made (tests / diagnostics) */
  fetches(): number;
  clear(): void;
}

export function createIceClient(userKey: string, deps: IceClientDeps = {}): IceClient {
  const f = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const endpoint = deps.endpoint ?? "/api/calls/ice";
  const storeKey = `${STORE_KEY}:${userKey}`;
  let cache: CachedIce | null = null;
  let inflight: Promise<IceResult> | null = null;
  let count = 0;
  let reportedAt = 0;

  const report = (msg: string, extra: Record<string, unknown>) => {
    // at most one report per 10 min per tab
    if (now() - reportedAt < 10 * 60_000) return;
    reportedAt = now();
    deps.report?.(msg, extra);
  };

  // restore from sessionStorage (same tab, same user)
  try {
    const raw = deps.storage?.getItem(storeKey);
    if (raw) {
      const c = JSON.parse(raw) as CachedIce;
      if (c && validServers(c.servers) && typeof c.expiresAt === "number" && c.expiresAt > now() && c.expiresAt - now() <= STORE_TTL_CAP_MS) cache = c;
      else deps.storage?.removeItem(storeKey);
    }
  } catch {}

  const save = (c: CachedIce) => {
    cache = c;
    try {
      deps.storage?.setItem(storeKey, JSON.stringify(c));
    } catch {}
  };

  async function fetchOnce(): Promise<{ ok: true; c: CachedIce } | { ok: false; status: number; final: boolean }> {
    count++;
    try {
      const r = await f(endpoint, { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) return { ok: false, status: r.status, final: r.status === 401 || r.status === 403 };
      const c = toCached((await r.json()) as IceListResponse, now());
      return c ? { ok: true, c } : { ok: false, status: r.status, final: false };
    } catch {
      return { ok: false, status: 0, final: false };
    }
  }

  async function load(): Promise<IceResult> {
    let res = await fetchOnce();
    if (!res.ok && !res.final) {
      await sleep(RETRY_DELAY_MS);
      res = await fetchOnce();
    }
    if (res.ok) {
      const c = res.c;
      if (c.turnConfigured && !c.hasTurn) {
        // The server already retried Cloudflare; tell monitoring, use what we have, ask again on the next call.
        report("Call ICE list came back without TURN although TURN is configured", { servers: c.servers.length });
        // keep a still-valid TURN list from before rather than replacing it with a STUN-only one
        if (cache && cache.hasTurn && cache.expiresAt > now()) return { servers: cache.servers, hasTurn: true, source: "stale" };
      }
      save(c);
      return { servers: c.servers, hasTurn: c.hasTurn, source: "network" };
    }
    // Could not fetch at all (after one retry).
    const usable = cache && cache.expiresAt > now() ? cache : null;
    if (res.status !== 401) {
      report("Call ICE list could not be fetched; TURN may be missing for this call", { status: res.status, cached: !!usable, cachedTurn: !!usable?.hasTurn });
    }
    if (usable) return { servers: usable.servers, hasTurn: usable.hasTurn, source: "stale" };
    return { servers: DEFAULT_ICE, hasTurn: false, source: "default" };
  }

  return {
    get(opts = {}) {
      const minValid = opts.minValidMs ?? CALL_MIN_VALID_MS;
      const c = cache;
      // valid long enough — or fetched moments ago (dial prefetch → engine start: one request per call, even for a
      // short-lived TURN-less list)
      if (c && c.expiresAt > now() && (c.expiresAt - now() >= minValid || now() - c.fetchedAt < FRESH_MS)) {
        return Promise.resolve({ servers: c.servers, hasTurn: c.hasTurn, source: "cache" });
      }
      if (inflight) return inflight;
      inflight = load().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    peek: () => cache,
    fetches: () => count,
    clear() {
      cache = null;
      try {
        deps.storage?.removeItem(storeKey);
      } catch {}
    },
  };
}
