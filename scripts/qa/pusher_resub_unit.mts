// Regression test for "a failed /api/pusher/auth during a reconnect silently kills incoming calls + realtime messages"
// (lib/pusherResilience.ts). Real pusher-js (its worker build runs in Node with the global WebSocket) against the local
// Pusher mock (scripts/qa/lib/pusher_mock.mjs, loopback only) — no browser, no server, no DB, no network.
//   npx tsx scripts/qa/pusher_resub_unit.mts
// The authorizer under test is the app's own (makeChannelAuthorizer) with a fetch stand-in that signs like
// /api/pusher/auth and can fail on demand (HTTP 500 / 403, network error, hang, late answer).
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { startPusherMock } from "./lib/pusher_mock.mjs";

if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
  console.error("Run with TURSO_DATABASE_URL / TURSO_AUTH_TOKEN empty — this test needs no database.");
  process.exit(2);
}
const { createChannelKeeper, makeChannelAuthorizer, backoffDelay, isPermanentAuthStatus, RESUB_CAP_MS, PERMANENT_RETRIES } = await import("../../lib/pusherResilience");

const require = createRequire(import.meta.url);
(globalThis as unknown as { self: unknown }).self = globalThis;
const PusherMod = require("pusher-js/dist/worker/pusher.worker.js");
const Pusher = PusherMod.default || PusherMod;

let pass = 0;
let fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => T | Promise<T>, timeout = 8000, every = 50): Promise<T | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}

// ---------------------------------------------------------------- pure
{
  const lo = (n: number) => backoffDelay(n, () => 0);
  const hi = (n: number) => backoffDelay(n, () => 0.999999);
  ok("B1", "Backoff starts at 0.5–1 s, doubles, never exceeds 30 s (equal jitter: ≥ half the step)",
    lo(0) === 500 && hi(0) === 1000 && lo(1) === 1000 && hi(1) === 2000 && lo(4) === 8000 && hi(4) === 16000 && lo(10) === RESUB_CAP_MS / 2 && hi(10) === RESUB_CAP_MS && hi(60) === RESUB_CAP_MS,
    [lo(0), hi(0), lo(1), hi(1), lo(4), hi(4), lo(10), hi(10), hi(60)]);
  const samples = Array.from({ length: 200 }, () => backoffDelay(3));
  ok("B2", "Jitter spreads retries (200 samples of attempt 3 within [4 s, 8 s], ≥ 50 distinct values)",
    samples.every((d) => d >= 4000 && d <= 8000) && new Set(samples).size >= 50, [Math.min(...samples), Math.max(...samples), new Set(samples).size]);
  ok("B3", "401/403/404/400 are answers (limited retries); 0 (network/timeout), 429, 5xx are blips (unlimited)",
    [400, 401, 403, 404].every(isPermanentAuthStatus) && ![0, 408, 429, 500, 502, 503, 504, undefined].some((s) => isPermanentAuthStatus(s as number)));
}

// ---------------------------------------------------------------- integration (real pusher-js + mock)
const PORT = 6091;
const mock = await startPusherMock({ port: PORT });
const sign = (socketId: string, channel: string, channelData?: string) =>
  "qa-key:" + crypto.createHmac("sha256", "qa-secret").update(channelData ? `${socketId}:${channel}:${channelData}` : `${socketId}:${channel}`).digest("hex");

type Mode = "ok" | "500" | "403" | "neterr" | "hang" | "late";
function makeClient(opts: { keeper?: boolean; authTimeoutMs?: number } = {}) {
  const auth = { plan: [] as Mode[], calls: 0, modes: [] as Mode[], lateRelease: null as null | (() => void) };
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    auth.calls++;
    const mode = auth.plan.shift() ?? "ok";
    auth.modes.push(mode);
    const p = new URLSearchParams(String(init.body));
    const socketId = p.get("socket_id")!;
    const channel = p.get("channel_name")!;
    const signal = init.signal as AbortSignal | undefined;
    const abortable = (pr: Promise<Response>) =>
      new Promise<Response>((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        pr.then(resolve, reject);
      });
    const good = () => {
      if (channel.startsWith("presence-")) {
        const channel_data = JSON.stringify({ user_id: "u1", user_info: {} });
        return new Response(JSON.stringify({ auth: sign(socketId, channel, channel_data), channel_data }), { status: 200 });
      }
      return new Response(JSON.stringify({ auth: sign(socketId, channel) }), { status: 200 });
    };
    if (mode === "500") return new Response("Internal Server Error", { status: 500 });
    if (mode === "403") return new Response("Forbidden", { status: 403 });
    if (mode === "neterr") throw new TypeError("Failed to fetch");
    if (mode === "hang") return abortable(new Promise<Response>(() => {}));
    if (mode === "late") return abortable(new Promise<Response>((r) => (auth.lateRelease = () => r(good()))));
    return good();
  }) as unknown as typeof fetch;
  const warns: string[] = [];
  const reports: string[] = [];
  // eslint-disable-next-line prefer-const
  let client: InstanceType<typeof Pusher>;
  const authorizer = makeChannelAuthorizer({ getSocketId: () => client.connection.socket_id, fetchImpl: fakeFetch, timeoutMs: opts.authTimeoutMs ?? 1500 });
  client = new Pusher("qa-key", {
    cluster: "mt1",
    wsHost: "127.0.0.1",
    wsPort: PORT,
    forceTLS: false,
    enabledTransports: ["ws"],
    disableStats: true,
    channelAuthorization: { customHandler: authorizer },
  });
  const keeper =
    opts.keeper === false
      ? null
      : createChannelKeeper(client, { domListeners: false, warn: (m) => warns.push(m), report: (m) => reports.push(m), timing: { connectedCheckMs: 1500, pendingStuckMs: 2500, watchdogMs: 1000, wakePingMs: 1000 } });
  return { client, keeper, auth, warns, reports };
}
const connected = (c: { connection: { state: string } }) => until(() => c.connection.state === "connected", 8000);
const subscribedAt = (ch: string) => until(() => mock.subscribers(ch) >= 1, 15000);

// I1 — the bug, reproduced WITHOUT the keeper (negative control: proves the test can see the failure)
{
  const { client, auth } = makeClient({ keeper: false });
  await connected(client);
  const ch = client.subscribe("private-chat-ctl");
  await subscribedAt("private-chat-ctl");
  auth.plan = ["500"];
  mock.dropSockets("private-chat-ctl");
  await until(() => auth.calls >= 2, 8000);
  await sleep(4000);
  ok("I1", "Control (plain pusher-js): one failed auth during a reconnect leaves the channel unsubscribed for good (the reported bug)",
    !ch.subscribed && mock.subscribers("private-chat-ctl") === 0 && auth.calls === 2, { subscribed: ch.subscribed, subs: mock.subscribers("private-chat-ctl"), calls: auth.calls });
  client.disconnect();
}

// I2..I5 — the keeper re-subscribes after each kind of transient failure, the same handlers keep firing exactly once
for (const [id, modes, label] of [
  ["I2", ["500"], "HTTP 500 once"],
  ["I3", ["neterr"], "network error once"],
  ["I4", ["hang"], "a hung request (timed out by the authorizer)"],
  ["I5", ["500", "neterr", "500"], "three failures in a row (backoff 0.5–1 s, 1–2 s, 2–4 s)"],
] as const) {
  const { client, keeper, auth } = makeClient();
  await connected(client);
  const name = `private-chat-${id.toLowerCase()}`;
  const ch = keeper!.acquire(name)!;
  let got = 0;
  const onCall = () => got++;
  ch.bind("incoming-call", onCall);
  await subscribedAt(name);
  auth.plan = [...modes];
  const t0 = Date.now();
  mock.dropSockets(name);
  await until(() => mock.subscribers(name) === 0, 3000);
  const back = await until(() => mock.subscribers(name) >= 1 && ch.subscribed, 20000);
  const ms = Date.now() - t0;
  mock.inject(name, "incoming-call", { callId: "c1" });
  await until(() => got > 0, 3000);
  await sleep(300);
  const cbs = (ch as unknown as { callbacks: { get(n: string): unknown[] | undefined } }).callbacks;
  ok(id, `Reconnect + ${label} → channel subscribed again by itself, next incoming-call delivered exactly once, handler bound once`,
    !!back && got === 1 && (cbs.get("incoming-call") || []).length === 1 && (cbs.get("pusher:subscription_error") || []).length === 1,
    { back: !!back, ms, got, calls: auth.calls, modes: auth.modes, handlers: (cbs.get("incoming-call") || []).length, log: keeper!.log.slice(-8) });
  console.log(`      recovered in ${ms} ms after ${auth.modes.filter((m) => m !== "ok").length} failed auth(s)`);
  keeper!.destroy();
  client.disconnect();
}

// I6 — permanent refusal (403): bounded retries, then waits; wake() tries again and recovers once auth is allowed
{
  const { client, keeper, auth, warns } = makeClient();
  await connected(client);
  const name = "presence-user-i6";
  auth.plan = ["403", "403", "403", "403", "403", "403"];
  const ch = keeper!.acquire(name)!;
  await until(() => keeper!.stats()[0]?.gaveUp, 15000);
  await sleep(2500);
  const calls = auth.calls;
  ok("I6a", `403 → at most ${PERMANENT_RETRIES} retries, then no request storm (watchdog does not retry a refused channel)`,
    calls === 1 + PERMANENT_RETRIES && keeper!.stats()[0].gaveUp && warns.some((w) => /refused/.test(w)), { calls, stats: keeper!.stats(), warns });
  auth.plan = [];
  keeper!.wake("visible");
  const back = await until(() => ch.subscribed && mock.subscribers(name) >= 1, 5000);
  ok("I6b", "wake (tab visible / app resume) → refused channel retried at once and subscribed when auth allows it", !!back, keeper!.stats());
  keeper!.destroy();
  client.disconnect();
}

// I7 — an auth answer that arrives after the socket changed is dropped (no stale subscribe), the new socket subscribes
{
  const { client, keeper, auth } = makeClient({ authTimeoutMs: 8000 });
  await connected(client);
  const name = "private-chat-i7";
  const ch = keeper!.acquire(name)!;
  await subscribedAt(name);
  auth.plan = ["late"];
  const refusedBefore = mock.log.filter((e: { refused?: string }) => e.refused).length;
  mock.dropSockets(name);
  await until(() => auth.lateRelease !== null, 5000);
  const release = auth.lateRelease!;
  mock.dropSockets(); // second drop while the first answer is still in flight
  await until(() => auth.calls >= 3, 8000);
  release(); // the stale answer arrives now
  const back = await until(() => ch.subscribed && mock.subscribers(name) >= 1, 10000);
  await sleep(500);
  const refused = mock.log.filter((e: { refused?: string }) => e.refused).length - refusedBefore;
  ok("I7", "Late auth answer for an old socket is dropped (the mock refuses 0 stale signatures); subscribed on the new socket", !!back && refused === 0, { back: !!back, refused, calls: auth.calls });
  keeper!.destroy();
  client.disconnect();
}

// I8 — subscription confirmation lost (server never answers) → stuck "pending" reset and redone
{
  const { client, keeper } = makeClient();
  await connected(client);
  const name = "private-chat-i8";
  mock.ignoreSubscribes(name, 1);
  const ch = keeper!.acquire(name)!;
  const back = await until(() => ch.subscribed && mock.subscribers(name) >= 1, 10000);
  ok("I8", "Lost subscription confirmation → stuck pending reset by the watchdog, channel subscribed", !!back && keeper!.log.some((l) => l.ev === "stuck-reset"), keeper!.log.slice(-6));
  keeper!.destroy();
  client.disconnect();
}

// I9 — ref-counting: shared by several components, unsubscribed only when the last one releases
{
  const { client, keeper } = makeClient();
  await connected(client);
  const name = "private-chat-i9";
  const a = keeper!.acquire(name);
  const b = keeper!.acquire(name);
  await subscribedAt(name);
  keeper!.release(name);
  await sleep(400);
  const still = mock.subscribers(name);
  keeper!.release(name);
  const gone = await until(() => mock.subscribers(name) === 0, 3000);
  ok("I9", "Two acquires share ONE Channel; first release keeps it, last release unsubscribes", a === b && still === 1 && !!gone && keeper!.stats().length === 0, { same: a === b, still, gone });
  keeper!.destroy();
  client.disconnect();
}

// I10 — wake() on a disconnected client reconnects and re-subscribes (Capacitor resume / online after a long sleep)
{
  const { client, keeper } = makeClient();
  await connected(client);
  const name = "private-chat-i10";
  const ch = keeper!.acquire(name)!;
  await subscribedAt(name);
  client.disconnect();
  await until(() => client.connection.state === "disconnected", 3000);
  keeper!.wake("resume", { longHidden: true });
  const back = await until(() => ch.subscribed && mock.subscribers(name) >= 1, 8000);
  ok("I10", "wake('resume') on a disconnected socket → reconnects and the channel is subscribed again", !!back, { state: client.connection.state });
  keeper!.destroy();
  client.disconnect();
}

// I11 — a private channel that keeps failing is reported once (Sentry warning in the app), not on every retry
{
  const { client, keeper, auth, reports } = makeClient();
  await connected(client);
  auth.plan = ["500", "500", "500", "500", "500", "500"];
  const name = "private-chat-i11";
  const ch = keeper!.acquire(name)!;
  await until(() => auth.calls >= 6, 30000);
  const back = await until(() => ch.subscribed, 25000);
  ok("I11", "6 failures in a row → exactly 1 report, still recovers (backoff capped)", reports.length === 1 && !!back, { reports, calls: auth.calls, back: !!back });
  keeper!.destroy();
  client.disconnect();
}

await mock.close();
console.log(`\nPusher re-subscribe: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
