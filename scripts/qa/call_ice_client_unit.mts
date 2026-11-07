// Unit test for the browser-side STUN/TURN list cache (lib/calls/iceClient.ts) — no browser, no server, no network.
//   npx tsx scripts/qa/call_ice_client_unit.mts
// Checks: one request per call (concurrent callers share it), cached until shortly before expiry (memory +
// sessionStorage across a reload, per user), in-call refresh only when < 15 min left, one retry on network / 5xx / 429,
// a Sentry-style report when TURN is configured but missing / unfetchable (never silent), last good TURN list kept.
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
  console.error("Run with TURSO_DATABASE_URL / TURSO_AUTH_TOKEN empty — this test needs no database.");
  process.exit(2);
}
const { createIceClient, toCached, DEFAULT_ICE, CALL_MIN_VALID_MS, IN_CALL_MIN_VALID_MS, EXPIRY_MARGIN_MS } = await import("../../lib/calls/iceClient");

let pass = 0;
let fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};

const TURN = { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" };
const STUN = { urls: ["stun:stun.l.google.com:19302"] };
type Plan = { status?: number; body?: unknown; throw?: boolean };
function harness(plan: Plan[], storage?: Map<string, string>) {
  let t = 1_800_000_000_000;
  const calls: number[] = [];
  const reports: { msg: string; extra: Record<string, unknown> }[] = [];
  const store = storage ?? new Map<string, string>();
  const f = (async () => {
    calls.push(t);
    const p = plan.shift() ?? { status: 200, body: { iceServers: [STUN, TURN], ttlSec: 3600, hasTurn: true, turnConfigured: true } };
    if (p.throw) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(p.body ?? {}), { status: p.status ?? 200 });
  }) as unknown as typeof fetch;
  const deps = {
    fetch: f,
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    storage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    report: (msg: string, extra: Record<string, unknown>) => reports.push({ msg, extra }),
  };
  return {
    deps,
    calls,
    reports,
    store,
    advance: (ms: number) => {
      t += ms;
    },
    make: (user = "u1") => createIceClient(user, deps),
  };
}
const good = (ttlSec = 3600) => ({ status: 200, body: { iceServers: [STUN, TURN], ttlSec, hasTurn: true, turnConfigured: true } });

// C1 — one request for a whole call: dial prefetch + engine start concurrently, then 3 more calls within the hour
{
  const h = harness([good()]);
  const c = h.make();
  const [a, b] = await Promise.all([c.get(), c.get()]);
  for (let i = 0; i < 3; i++) {
    h.advance(10 * 60_000);
    await c.get();
  }
  ok("C1", "Concurrent dial-prefetch + engine-start share 1 request; 4 calls over 30 min → still 1 request (cache)",
    h.calls.length === 1 && a.source === "network" && b.servers === a.servers && (await c.get()).source === "cache", { calls: h.calls.length });
}

// C2 — expiry: cache used until EXPIRY_MARGIN before the credentials expire; a call needs ≥ 15 min left
{
  const h = harness([good(3600), good(3600)]);
  const c = h.make();
  await c.get();
  const exp = c.peek()!.expiresAt - c.peek()!.fetchedAt;
  h.advance(exp - CALL_MIN_VALID_MS - 1000);
  const r1 = await c.get();
  h.advance(2000);
  const r2 = await c.get();
  ok("C2", `List kept until ${EXPIRY_MARGIN_MS / 60000} min before expiry; a call with < 15 min left fetches a fresh one`,
    exp === 3600_000 - EXPIRY_MARGIN_MS && r1.source === "cache" && r2.source === "network" && h.calls.length === 2, { exp, r1: r1.source, r2: r2.source });
}

// C3 — in-call refresh (every 10 min) only fetches when < 15 min of validity is left
{
  const h = harness([good(3600), good(3600)]);
  const c = h.make();
  await c.get();
  let fetchesAt: number[] = [];
  for (let m = 10; m <= 60; m += 10) {
    h.advance(10 * 60_000);
    const before = h.calls.length;
    await c.get({ minValidMs: IN_CALL_MIN_VALID_MS });
    if (h.calls.length > before) fetchesAt.push(m);
  }
  ok("C3", "1-hour call, refresh check every 10 min → exactly one re-fetch (at 50 min: 5 min left of 55)", JSON.stringify(fetchesAt) === "[50]", fetchesAt);
  fetchesAt = [];
}

// C4 — survives a reload (sessionStorage), per user, garbage ignored
{
  const store = new Map<string, string>();
  const h = harness([good()], store);
  await h.make("u1").get();
  const reloaded = h.make("u1");
  const r = await reloaded.get();
  const other = h.make("u2");
  const r2 = await other.get();
  store.set("pn_ice_v1:u3", "{not json");
  const r3 = await h.make("u3").get();
  ok("C4", "Reload in the same tab reuses the stored list (no request); another account never sees it; corrupt entry ignored",
    r.source === "cache" && r2.source === "network" && r3.source === "network" && h.calls.length === 3, { r: r.source, r2: r2.source, r3: r3.source, calls: h.calls.length });
}

// C5 — network error → one retry → success, no report
{
  const h = harness([{ throw: true }, good()]);
  const r = await h.make().get();
  ok("C5", "Network error → retried once after 1.5 s → TURN list, no warning", r.source === "network" && r.hasTurn && h.calls.length === 2 && h.calls[1] - h.calls[0] === 1500 && h.reports.length === 0, { r, calls: h.calls, reports: h.reports });
}

// C6 — 429 twice, nothing cached → STUN default + a report (never silent)
{
  const h = harness([{ status: 429 }, { status: 429 }]);
  const r = await h.make().get();
  ok("C6", "429 twice with nothing cached → default STUN for this call AND a warning report (not silent)",
    r.source === "default" && r.servers === DEFAULT_ICE && !r.hasTurn && h.calls.length === 2 && h.reports.length === 1 && h.reports[0].extra.status === 429, { r, reports: h.reports });
}

// C7 — 5xx twice while a valid TURN list is cached (in-call refresh) → keeps the TURN list, reports
{
  const h = harness([good(), { status: 503 }, { status: 503 }]);
  const c = h.make();
  await c.get();
  h.advance(45 * 60_000);
  const r = await c.get({ minValidMs: IN_CALL_MIN_VALID_MS });
  ok("C7", "Refresh fails twice (503) while the cached TURN list is still valid → TURN list kept + warning", r.source === "stale" && r.hasTurn && h.reports.length === 1, { r, reports: h.reports.length });
}

// C8 — server says TURN configured but none in the list → report; a still-valid TURN list is preferred; the TURN-less
//      list is reused for the same call only and the NEXT call asks again
{
  const h = harness([{ status: 200, body: { iceServers: [STUN], ttlSec: 60, hasTurn: false, turnConfigured: true } }, good()]);
  const c = h.make();
  const r1 = await c.get();
  const r1b = await c.get(); // engine start of the same call, moments later
  h.advance(60_000);
  const r2 = await c.get(); // next call
  ok("C8", "TURN configured but missing → warning; same call reuses it (1 request), the next call asks again and gets TURN",
    !r1.hasTurn && r1b.source === "cache" && h.reports.length === 1 && /without TURN/.test(h.reports[0].msg) && r2.hasTurn && r2.source === "network" && h.calls.length === 2,
    { r1: r1.source, r1b: r1b.source, r2: r2.source, reports: h.reports, calls: h.calls.length });
}

// C9 — 401 (signed out) is final: no retry, no report
{
  const h = harness([{ status: 401 }]);
  const r = await h.make().get();
  ok("C9", "401 → no retry, no warning, STUN default", r.source === "default" && h.calls.length === 1 && h.reports.length === 0, { calls: h.calls.length, reports: h.reports });
}

// C10 — reports are rate-limited (one per 10 min per tab)
{
  const h = harness([{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }]);
  const c = h.make();
  await c.get();
  await c.get();
  ok("C10", "Two failing calls back to back → one warning (not a flood)", h.reports.length === 1, h.reports.length);
}

// C11 — malformed answers are not cached
{
  ok("C11", "toCached rejects malformed lists; STUN-only server (no TURN configured) list kept ~55 min",
    toCached({ iceServers: "x" }, 0) === null && toCached({ iceServers: [{ nope: 1 }] }, 0) === null &&
      toCached({ iceServers: [STUN], ttlSec: 3600, hasTurn: false, turnConfigured: false }, 0)!.expiresAt === 3600_000 - EXPIRY_MARGIN_MS);
}

console.log(`\nICE client cache: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
