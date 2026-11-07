// Keeps every Pusher channel the app needs SUBSCRIBED, whatever happens to the network.
//
// The bug this fixes: pusher-js re-subscribes all channels once, right after each reconnect. If that one
// /api/pusher/auth request fails (network blip while the phone switches Wi-Fi → 4G, a 5xx during a deploy, a timeout),
// pusher-js emits "pusher:subscription_error" and NEVER tries again — the device silently stops receiving incoming
// calls and realtime messages on "private-chat-<me>" until the page is reloaded.
//
// What this module does (one keeper per Pusher client; channels are ref-counted and shared by every component):
//   • re-subscribes a channel after subscription_error with capped exponential backoff + jitter (1 s → 30 s);
//   • after every (re)connect, and every WATCHDOG_MS, checks that each channel is subscribed — a channel that is
//     neither subscribed nor pending is subscribed again, a subscription stuck "pending" is reset and redone;
//   • on visibilitychange (visible) / online / pageshow / Capacitor App "resume" (wakeRealtime): reconnects a dropped
//     socket, pings a socket that may be half-open, and re-checks every channel at once (backoff reset);
//   • authorizes with its own handler (makeChannelAuthorizer): a timeout (pusher-js' XHR has none — a hung request
//     left the channel "pending" forever) and answers for an OLD socket are dropped (they would be rejected anyway).
// The SAME pusher-js Channel object is kept for the whole life of a subscription: pusher.subscribe(name) on an existing
// channel re-runs its subscription without dropping a single bound handler, so nothing is ever bound twice.
//
// No runtime import of pusher-js: the unit test drives it with the real pusher-js worker build + the local Pusher mock
// (scripts/qa/pusher_resub_unit.mts).
import type { Channel } from "pusher-js";

export const RESUB_BASE_MS = 1_000;
export const RESUB_CAP_MS = 30_000;
/** One /api/pusher/auth request may take this long, then it counts as failed (status 0). */
export const AUTH_TIMEOUT_MS = 10_000;
/** A subscription still pending after this long (auth answered but no subscription_succeeded) is redone. */
export const PENDING_STUCK_MS = 20_000;
/** After a (re)connect pusher-js subscribes everything itself; we verify this long afterwards. */
export const CONNECTED_CHECK_MS = 4_000;
export const WATCHDOG_MS = 30_000;
/** 401 / 403 / 404 / 400 are answers, not blips: retried only this many times (until the next wake / reconnect). */
export const PERMANENT_RETRIES = 2;
/** Ping a possibly half-open socket on wake; no message back within this long → reconnect. */
export const WAKE_PING_TIMEOUT_MS = 8_000;
/** Hidden at least this long → the socket may be dead although pusher-js still says "connected". */
const LONG_HIDDEN_MS = 30_000;

/** Delay before re-subscription attempt `attempt` (0-based): "equal jitter" in [exp/2, exp], exp = min(cap, base·2^n). */
export function backoffDelay(attempt: number, rnd: () => number = Math.random): number {
  const exp = Math.min(RESUB_CAP_MS, RESUB_BASE_MS * 2 ** Math.max(0, Math.min(attempt, 16)));
  return Math.round(exp / 2 + rnd() * (exp / 2));
}

export const isPermanentAuthStatus = (status: number | undefined) => status === 400 || status === 401 || status === 403 || status === 404;

// ------------------------------------------------------------------------------------------------------------------
// Minimal shape of the pusher-js client we rely on (public API + Channel flags that pusher-js declares public).
// ------------------------------------------------------------------------------------------------------------------
interface ConnectionLike {
  state: string;
  socket_id?: string;
  bind(event: string, cb: (...a: never[]) => void): unknown;
  unbind(event: string, cb: (...a: never[]) => void): unknown;
  send_event(name: string, data: unknown, channel?: string): boolean;
}
export interface PusherLike {
  connection: ConnectionLike;
  subscribe(name: string): Channel;
  unsubscribe(name: string): void;
  channel(name: string): Channel | undefined;
  connect(): void;
  disconnect(): void;
}

type AuthCallback = (error: Error | null, data: { auth: string; channel_data?: string; shared_secret?: string } | null) => void;
type AuthParams = { socketId: string; channelName: string };

/** HTTP status of the last failed authorization per channel (0 = network error / timeout). */
const lastAuthStatus = new Map<string, number>();

/**
 * pusher-js `channelAuthorization.customHandler`: POST socket_id + channel_name (same form body as pusher-js) with a
 * timeout. An answer that arrives after the socket changed is dropped — pusher-js already reset the channel when the
 * old socket closed and subscribes it again on the new one.
 */
export function makeChannelAuthorizer(opts: {
  endpoint?: string;
  getSocketId: () => string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  const endpoint = opts.endpoint ?? "/api/pusher/auth";
  const timeoutMs = opts.timeoutMs ?? AUTH_TIMEOUT_MS;
  return (params: AuthParams, callback: AuthCallback) => {
    const doFetch = opts.fetchImpl ?? fetch;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    const fail = (status: number, why: string) => {
      lastAuthStatus.set(params.channelName, status);
      callback(Object.assign(new Error(`Pusher auth for ${params.channelName} failed: ${why}`), { status }), null);
    };
    const stale = () => {
      const now = opts.getSocketId();
      return !!now && now !== params.socketId;
    };
    doFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ socket_id: params.socketId, channel_name: params.channelName }).toString(),
      credentials: "same-origin",
      cache: "no-store",
      signal: ctrl?.signal,
    })
      .then(async (res) => {
        if (stale()) return;
        if (!res.ok) return fail(res.status, `HTTP ${res.status}`);
        let data: { auth?: unknown; channel_data?: unknown; shared_secret?: unknown } | null = null;
        try {
          data = await res.json();
        } catch {}
        if (stale()) return;
        if (!data || typeof data.auth !== "string") return fail(res.status, "invalid JSON");
        lastAuthStatus.delete(params.channelName);
        callback(null, {
          auth: data.auth,
          ...(typeof data.channel_data === "string" ? { channel_data: data.channel_data } : {}),
          ...(typeof data.shared_secret === "string" ? { shared_secret: data.shared_secret } : {}),
        });
      })
      .catch((e: unknown) => {
        if (stale()) return;
        fail(0, e instanceof Error && e.name === "AbortError" ? "timeout" : "network error");
      })
      .finally(() => clearTimeout(timer));
  };
}

// ------------------------------------------------------------------------------------------------------------------
// Channel keeper
// ------------------------------------------------------------------------------------------------------------------
interface Entry {
  name: string;
  channel: Channel;
  refs: number;
  attempt: number;
  permanentFails: number;
  gaveUp: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  pendingSince: number | null;
  failures: number;
  reported: boolean;
  onError: (err: unknown) => void;
  onOk: () => void;
}

export interface KeeperDeps {
  now?: () => number;
  random?: () => number;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  /** console-style warning sink */
  warn?: (msg: string) => void;
  /** a private channel keeps failing (≥ 4 attempts in a row) — reported once per channel until it recovers */
  report?: (msg: string, extra: Record<string, unknown>) => void;
  /** install window/document listeners (visibility, online, pageshow) — default: when a document exists */
  domListeners?: boolean;
  /** shorter timings for tests */
  timing?: { connectedCheckMs?: number; pendingStuckMs?: number; watchdogMs?: number; wakePingMs?: number };
}

export interface KeeperStats {
  name: string;
  refs: number;
  subscribed: boolean;
  pending: boolean;
  attempt: number;
  failures: number;
  gaveUp: boolean;
  retryScheduled: boolean;
}

export interface ChannelKeeper {
  acquire(name: string): Channel | null;
  release(name: string): void;
  /** Re-check every channel now (no backoff reset). */
  checkAll(reason?: string): void;
  /** App/tab came back / network back: reconnect if needed, ping a maybe-dead socket, re-check every channel now. */
  wake(reason: string, opts?: { longHidden?: boolean }): void;
  stats(): KeeperStats[];
  log: { t: number; ev: string; ch?: string; n?: number; status?: number }[];
  destroy(): void;
}

export function createChannelKeeper(pusher: PusherLike, deps: KeeperDeps = {}): ChannelKeeper {
  const now = deps.now ?? Date.now;
  const rnd = deps.random ?? Math.random;
  const sT = deps.setTimeout ?? setTimeout;
  const cT = deps.clearTimeout ?? clearTimeout;
  const sI = deps.setInterval ?? setInterval;
  const cI = deps.clearInterval ?? clearInterval;
  const warn = deps.warn ?? ((m: string) => console.warn(m));
  const T = {
    connectedCheckMs: deps.timing?.connectedCheckMs ?? CONNECTED_CHECK_MS,
    pendingStuckMs: deps.timing?.pendingStuckMs ?? PENDING_STUCK_MS,
    watchdogMs: deps.timing?.watchdogMs ?? WATCHDOG_MS,
    wakePingMs: deps.timing?.wakePingMs ?? WAKE_PING_TIMEOUT_MS,
  };
  const entries = new Map<string, Entry>();
  const log: ChannelKeeper["log"] = [];
  const note = (ev: string, extra: { ch?: string; n?: number; status?: number } = {}) => {
    log.push({ t: now(), ev, ...extra });
    if (log.length > 300) log.splice(0, 100);
  };
  let connectedTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = (e: Entry) => {
    if (e.timer) cT(e.timer);
    e.timer = null;
  };

  const resubscribe = (e: Entry, reason: string) => {
    if (!entries.has(e.name)) return;
    if (pusher.connection.state !== "connected") return; // pusher-js subscribes everything itself on the next connect
    const ch = e.channel;
    if (ch.subscribed) {
      e.pendingSince = null;
      return;
    }
    if (ch.subscriptionPending) {
      if (e.pendingSince === null || now() - e.pendingSince < T.pendingStuckMs) return;
      // Stuck: the auth answer never came back or the server never confirmed. Unsubscribe (harmless if the server
      // has nothing) and start over on the same Channel object.
      note("stuck-reset", { ch: e.name });
      ch.subscriptionPending = false;
      ch.subscriptionCancelled = false;
      try {
        pusher.connection.send_event("pusher:unsubscribe", { channel: e.name });
      } catch {}
    }
    if (pusher.channel(e.name) !== ch) {
      // Someone called pusher.unsubscribe(name) behind the keeper's back — never happens in this app (every
      // subscriber goes through acquire/release); keep the handlers' channel registered rather than create a new one.
      warn(`[realtime] channel ${e.name} was removed outside the keeper`);
      return;
    }
    note("resubscribe", { ch: e.name, n: e.attempt });
    e.pendingSince = now();
    pusher.subscribe(e.name); // same Channel object → ch.subscribe(): authorize + pusher:subscribe, handlers untouched
    void reason;
  };

  const schedule = (e: Entry) => {
    if (e.timer || !entries.has(e.name)) return;
    const delay = backoffDelay(e.attempt, rnd);
    e.attempt += 1;
    note("retry-in", { ch: e.name, n: delay });
    e.timer = sT(() => {
      e.timer = null;
      resubscribe(e, "retry");
    }, delay);
  };

  const onError = (e: Entry, err: unknown) => {
    const errStatus = (err as { status?: unknown } | null)?.status;
    const status = lastAuthStatus.get(e.name) ?? (typeof errStatus === "number" ? errStatus : undefined);
    e.failures += 1;
    note("subscription_error", { ch: e.name, status });
    if (e.channel.subscribed) return;
    // A server-side subscription_error leaves pusher-js "pending" forever; an auth error already cleared it.
    e.channel.subscriptionPending = false;
    e.pendingSince = null;
    if (isPermanentAuthStatus(status)) {
      e.permanentFails += 1;
      if (e.permanentFails > PERMANENT_RETRIES) {
        e.gaveUp = true;
        note("gave-up", { ch: e.name, status });
        warn(`[realtime] ${e.name}: authorization refused (${status}) — not retrying until the app wakes or reconnects`);
        return;
      }
    }
    warn(`[realtime] ${e.name}: subscription failed (${status ?? "?"}), retrying`);
    if (e.failures >= 4 && !e.reported && /^private-chat-/.test(e.name)) {
      e.reported = true;
      deps.report?.("Pusher private channel keeps failing to subscribe", { status: status ?? null, failures: e.failures });
    }
    schedule(e);
  };

  const onOk = (e: Entry) => {
    if (e.failures) note("recovered", { ch: e.name, n: e.failures });
    clearRetry(e);
    e.attempt = 0;
    e.permanentFails = 0;
    e.failures = 0;
    e.gaveUp = false;
    e.reported = false;
    e.pendingSince = null;
  };

  const checkAll = (reason = "check") => {
    for (const e of entries.values()) {
      if (e.timer || e.gaveUp) continue; // a backoff retry is already scheduled / refused for now
      resubscribe(e, reason);
    }
  };

  const onState = ({ current }: { previous: string; current: string }) => {
    if (current !== "connected") return;
    // A fresh connection: pusher-js subscribes every channel itself; refused channels get one more chance.
    for (const e of entries.values()) {
      clearRetry(e);
      e.attempt = 0;
      e.permanentFails = 0;
      e.gaveUp = false;
      e.pendingSince = e.channel.subscriptionPending ? now() : null;
    }
    if (connectedTimer) cT(connectedTimer);
    connectedTimer = sT(() => {
      connectedTimer = null;
      checkAll("after-connect");
    }, T.connectedCheckMs);
  };
  pusher.connection.bind("state_change", onState as (...a: never[]) => void);

  const watchdog = sI(() => checkAll("watchdog"), T.watchdogMs);

  const wake = (reason: string, opts: { longHidden?: boolean } = {}) => {
    const st = pusher.connection.state;
    note("wake", { ch: reason });
    if (st === "disconnected" || st === "failed" || st === "initialized") {
      pusher.connect();
      return;
    }
    if (st !== "connected") return; // connecting / unavailable: pusher-js is already retrying
    for (const e of entries.values()) {
      clearRetry(e);
      e.attempt = 0;
      e.permanentFails = 0;
      e.gaveUp = false;
    }
    checkAll("wake");
    // After a long sleep the socket can be half-open while pusher-js still says "connected": ping it; no message
    // back in time → reconnect (which re-subscribes everything).
    if ((opts.longHidden || reason === "online" || reason === "resume") && !pingTimer) {
      let alive = false;
      const onMsg = () => {
        alive = true;
      };
      pusher.connection.bind("message", onMsg as (...a: never[]) => void);
      try {
        pusher.connection.send_event("pusher:ping", {});
      } catch {}
      pingTimer = sT(() => {
        pingTimer = null;
        pusher.connection.unbind("message", onMsg as (...a: never[]) => void);
        if (!alive && pusher.connection.state === "connected") {
          note("ping-timeout");
          pusher.disconnect();
          pusher.connect();
        }
      }, T.wakePingMs);
    }
  };

  // ---- page lifecycle (browser / Capacitor WebView) ----
  const cleanups: (() => void)[] = [];
  const useDom = deps.domListeners ?? (typeof window !== "undefined" && typeof document !== "undefined");
  if (useDom) {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? now() : null;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = now();
        return;
      }
      const longHidden = hiddenAt !== null && now() - hiddenAt >= LONG_HIDDEN_MS;
      hiddenAt = null;
      wake("visible", { longHidden });
    };
    const onOnline = () => wake("online");
    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) wake("pageshow", { longHidden: true });
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);
    cleanups.push(() => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
    });
  }

  return {
    acquire(name: string) {
      if (!name) return null;
      const existing = entries.get(name);
      if (existing) {
        existing.refs += 1;
        return existing.channel;
      }
      const channel = pusher.subscribe(name);
      const e: Entry = {
        name,
        channel,
        refs: 1,
        attempt: 0,
        permanentFails: 0,
        gaveUp: false,
        timer: null,
        pendingSince: channel.subscriptionPending ? now() : null,
        failures: 0,
        reported: false,
        onError: (err) => onError(e, err),
        onOk: () => onOk(e),
      };
      // Know when a subscription attempt starts (pusher-js' own re-subscribe after a reconnect included) so a stuck
      // one can be told from one that just started.
      const orig = channel.subscribe;
      channel.subscribe = function (this: Channel) {
        if (!this.subscribed) e.pendingSince = now();
        return orig.call(this);
      };
      channel.bind("pusher:subscription_error", e.onError);
      channel.bind("pusher:subscription_succeeded", e.onOk);
      entries.set(name, e);
      note("acquire", { ch: name });
      return channel;
    },
    release(name: string) {
      const e = entries.get(name);
      if (!e) return;
      e.refs -= 1;
      if (e.refs > 0) return;
      clearRetry(e);
      e.channel.unbind("pusher:subscription_error", e.onError);
      e.channel.unbind("pusher:subscription_succeeded", e.onOk);
      // back to the prototype method (pusher-js keeps the Channel object while a cancelled subscription settles)
      delete (e.channel as unknown as { subscribe?: unknown }).subscribe;
      entries.delete(name);
      lastAuthStatus.delete(name);
      pusher.unsubscribe(name);
      note("release", { ch: name });
    },
    checkAll,
    wake,
    stats() {
      return [...entries.values()].map((e) => ({
        name: e.name,
        refs: e.refs,
        subscribed: !!e.channel.subscribed,
        pending: !!e.channel.subscriptionPending,
        attempt: e.attempt,
        failures: e.failures,
        gaveUp: e.gaveUp,
        retryScheduled: !!e.timer,
      }));
    },
    log,
    destroy() {
      for (const name of [...entries.keys()]) {
        const e = entries.get(name)!;
        e.refs = 1;
        this.release(name);
      }
      pusher.connection.unbind("state_change", onState as (...a: never[]) => void);
      cI(watchdog);
      if (connectedTimer) cT(connectedTimer);
      if (pingTimer) cT(pingTimer);
      for (const c of cleanups) c();
    },
  };
}
