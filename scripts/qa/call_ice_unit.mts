// Kiểm thử THUẦN (không DB, không internet) cho danh sách máy chủ ICE của cuộc gọi (lib/calls/iceServers.ts):
//   STUN mặc định · CALL_STUN_URLS="" · TURN chung (tĩnh / TURN_SECRET kiểu coturn) · Cloudflare Realtime TURN qua máy
//   chủ giả local (2 dạng phản hồi, lọc cổng 53, cache 10 phút, hết hạn cache, lỗi 5xx / quá giờ → chỉ STUN, log 1 lần)
//   · token API không bao giờ lộ ra phía trình duyệt · cờ test bị bỏ qua trên Vercel.
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/call_ice_unit.mts
import http from "node:http";
import { createHmac } from "node:crypto";

if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
  console.error("Bỏ TURSO_* trước khi chạy — bài này không cần DB.");
  process.exit(2);
}
const { buildIceServers, parseCloudflareIce, resetIceCache, DEFAULT_STUN } = await import("../../lib/calls/iceServers");

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};
const allUrls = (r: { iceServers: { urls: string | string[] }[] }) => r.iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));

const TOKEN = "cf-secret-token-DO-NOT-LEAK-123";
const KEY = "key123";

// ---- Máy chủ Cloudflare giả ----
let mode: "array" | "object" | "500" | "slow" | "500-once" = "array";
const hits: { url: string; auth: string; body: string }[] = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    hits.push({ url: req.url || "", auth: String(req.headers.authorization || ""), body });
    if (mode === "500") return void res.writeHead(500).end("{}");
    if (mode === "500-once") {
      mode = "array";
      return void res.writeHead(502).end("{}");
    }
    if (mode === "slow") return void setTimeout(() => res.writeHead(201, { "content-type": "application/json" }).end("{}"), 6000);
    const turn = {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turn:turn.cloudflare.com:53?transport=udp",
        "turn:turn.cloudflare.com:3478?transport=tcp",
        "turns:turn.cloudflare.com:5349?transport=tcp",
        "turns:turn.cloudflare.com:443?transport=tcp",
        "javascript:alert(1)",
      ],
      username: "cf-user-" + hits.length,
      credential: "cf-cred-" + hits.length,
    };
    const payload = mode === "array" ? { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] }, turn] } : { iceServers: turn };
    res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify(payload));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;
const CF_ENV = { CLOUDFLARE_TURN_KEY_ID: KEY, CLOUDFLARE_TURN_API_TOKEN: TOKEN, CLOUDFLARE_TURN_ALLOW_TEST: "1", CLOUDFLARE_TURN_TEST_BASE: `http://127.0.0.1:${port}` };

try {
  // 1. Không cấu hình gì → STUN Google, không TURN.
  {
    const r = await buildIceServers("u1", { env: {} });
    ok("I1", "Không cấu hình → chỉ STUN Google, hasTurn=false, ttl 1h", JSON.stringify(allUrls(r)) === JSON.stringify(DEFAULT_STUN) && !r.hasTurn && r.ttlSec === 3600, r);
    const r2 = await buildIceServers("u1", { env: { CALL_STUN_URLS: "" } });
    ok("I2", "CALL_STUN_URLS=\"\" → danh sách rỗng (test offline)", r2.iceServers.length === 0 && !r2.hasTurn, r2);
    const r3 = await buildIceServers("u1", { env: { CALL_STUN_URLS: "stun:a.example:3478, turn:x.example:3478, http://evil" } });
    ok("I3", "CALL_STUN_URLS chỉ nhận stun: (bỏ turn:/http:)", JSON.stringify(allUrls(r3)) === JSON.stringify(["stun:a.example:3478"]), r3);
  }

  // 2. TURN chung tĩnh.
  {
    const r = await buildIceServers("u1", { env: { CALL_STUN_URLS: "", TURN_URLS: "turn:relay.example.com:3478?transport=udp,turns:relay.example.com:443?transport=tcp,ftp://x", TURN_USERNAME: "static", TURN_CREDENTIAL: "pw" } });
    const t = r.iceServers[0];
    ok("I4", "TURN_URLS + TURN_USERNAME/CREDENTIAL → 1 mục TURN (bỏ URL lạ), hasTurn", r.hasTurn && r.iceServers.length === 1 && t.username === "static" && t.credential === "pw" && (t.urls as string[]).length === 2, r);
  }

  // 3. TURN_SECRET (coturn use-auth-secret) → thông tin đăng nhập tạm theo người dùng.
  {
    const now = 1_800_000_000_000;
    const r = await buildIceServers("user_ABC-1", { env: { TURN_URLS: "turn:relay.example.com:3478", TURN_SECRET: "s3cr3t", TURN_USERNAME: "ignored", TURN_CREDENTIAL: "ignored" }, now: () => now });
    const t = r.iceServers.find((s) => s.username)!;
    const exp = Math.floor(now / 1000) + 7200;
    const want = createHmac("sha1", "s3cr3t").update(`${exp}:user_ABC-1`).digest("base64");
    ok("I5", "TURN_SECRET → username '<exp>:<userId>', credential = base64(HMAC-SHA1), ttl 2h, ưu tiên hơn mật khẩu tĩnh", t?.username === `${exp}:user_ABC-1` && t.credential === want && r.ttlSec === 7200, r);
    ok("I6", "TURN_SECRET không bao giờ nằm trong kết quả", !JSON.stringify(r).includes("s3cr3t"));
  }

  // 4. Cloudflare dạng mảng (generate-ice-servers) qua máy chủ giả.
  {
    resetIceCache();
    mode = "array";
    hits.length = 0;
    const logs: string[] = [];
    const r = await buildIceServers("u1", { env: { ...CF_ENV, CALL_STUN_URLS: "" }, log: (m) => logs.push(m) });
    const urls = allUrls(r);
    const h = hits[0];
    ok("I7", "Cloudflare: gọi POST …/turn/keys/<id>/credentials/generate-ice-servers, Bearer token, ttl 3600", hits.length === 1 && h.url === `/turn/keys/${KEY}/credentials/generate-ice-servers` && h.auth === `Bearer ${TOKEN}` && JSON.parse(h.body).ttl === 3600, hits);
    ok("I8", "Cloudflare: nhận TURN (udp/tcp/tls) + STUN, BỎ mọi URL cổng 53 và URL lạ", r.hasTurn && urls.includes("turns:turn.cloudflare.com:443?transport=tcp") && urls.includes("stun:stun.cloudflare.com:3478") && !urls.some((u) => /:53(\?|$)/.test(u)) && !urls.some((u) => u.startsWith("javascript")), urls);
    ok("I9", "Token API Cloudflare KHÔNG nằm trong kết quả gửi cho trình duyệt", !JSON.stringify(r).includes(TOKEN));
    ok("I10", "Cloudflare: ttl 3600s (trình duyệt làm mới danh sách trong cuộc gọi dài)", r.ttlSec === 3600, r.ttlSec);

    const r2 = await buildIceServers("u2", { env: { ...CF_ENV, CALL_STUN_URLS: "" } });
    ok("I11", "Cache 10 phút trên mỗi instance: lần 2 không gọi lại Cloudflare", hits.length === 1 && JSON.stringify(r2.iceServers) === JSON.stringify(r.iceServers), hits.length);
    const later = Date.now() + 11 * 60 * 1000;
    const r3 = await buildIceServers("u2", { env: { ...CF_ENV, CALL_STUN_URLS: "" }, now: () => later });
    ok("I12", "Hết 10 phút → lấy thông tin đăng nhập mới", hits.length === 2 && r3.iceServers.some((s) => s.username === "cf-user-2"), hits.length);
  }

  // 5. Cloudflare dạng object (endpoint cũ /credentials/generate).
  {
    resetIceCache();
    mode = "object";
    const r = await buildIceServers("u1", { env: { ...CF_ENV, CALL_STUN_URLS: "" } });
    ok("I13", "Cloudflare dạng {iceServers:{urls,username,credential}} cũng đọc được", r.hasTurn && r.iceServers.length === 1 && !!r.iceServers[0].username, r);
    ok("I14", "parseCloudflareIce: TURN thiếu username/credential bị bỏ; rác → []", parseCloudflareIce({ iceServers: [{ urls: ["turn:a:3478"] }] }).length === 0 && parseCloudflareIce(null).length === 0 && parseCloudflareIce({ iceServers: "x" }).length === 0);
  }

  // 6. Lỗi 5xx → thử lại 1 lần → STUN, log + báo Sentry đúng 1 lần, không lộ token; danh sách thiếu TURN chỉ giữ 60 s.
  {
    resetIceCache();
    mode = "500";
    hits.length = 0;
    const logs: string[] = [];
    const reports: { msg: string; extra: Record<string, unknown> }[] = [];
    const report = (msg: string, extra: Record<string, unknown>) => reports.push({ msg, extra });
    const r = await buildIceServers("u1", { env: CF_ENV, log: (m) => logs.push(m), report, retryDelayMs: 50 });
    const r2 = await buildIceServers("u1", { env: CF_ENV, log: (m) => logs.push(m), report, retryDelayMs: 50 });
    ok("I15", "Cloudflare 5xx → thử lại 1 lần rồi mới trả STUN Google (hasTurn=false, turnConfigured=true, ttl 60 s để trình duyệt hỏi lại sớm)",
      !r.hasTurn && r.turnConfigured && r.ttlSec === 60 && JSON.stringify(allUrls(r)) === JSON.stringify(DEFAULT_STUN) && !r2.hasTurn && hits.length === 4, { r, hits: hits.length });
    ok("I16", "Lỗi chỉ log + báo Sentry 1 lần / 10 phút, không chứa token", logs.length === 1 && reports.length === 1 && !JSON.stringify([logs, reports]).includes(TOKEN) && /STUN-only/.test(reports[0].msg), { logs, reports });
  }

  // 6b. Lỗi 1 lần rồi được → lần thử lại cứu được TURN, không báo động.
  {
    resetIceCache();
    mode = "500-once";
    hits.length = 0;
    const reports: string[] = [];
    const r = await buildIceServers("u1", { env: CF_ENV, log: () => {}, report: (m) => reports.push(m), retryDelayMs: 50 });
    ok("I15b", "Cloudflare 502 một lần → thử lại → có TURN, ttl 3600, không báo Sentry", r.hasTurn && r.turnConfigured && r.ttlSec === 3600 && hits.length === 2 && reports.length === 0, { hits: hits.length, reports, r });
  }

  // 7. Quá giờ (3 s mỗi lần, thử lại 1 lần) → STUN sau ≤ ~6.5 s.
  {
    resetIceCache();
    mode = "slow";
    hits.length = 0;
    const t0 = Date.now();
    const r = await buildIceServers("u1", { env: CF_ENV, log: () => {}, retryDelayMs: 100 });
    const ms = Date.now() - t0;
    ok("I17", "Cloudflare treo → 2 lần × 3 s rồi trả STUN (≤ ~6.5 s, không treo cuộc gọi)", !r.hasTurn && hits.length === 2 && ms >= 5800 && ms < 7500, { ms, hits: hits.length });
  }

  // 7b. turnConfigured chỉ đúng khi thật sự có cấu hình TURN.
  {
    const a = await buildIceServers("u1", { env: {} });
    const b = await buildIceServers("u1", { env: { TURN_URLS: "turn:relay.example.com:3478" } });
    const c = await buildIceServers("u1", { env: { TURN_URLS: "turn:relay.example.com:3478", TURN_SECRET: "x" } });
    ok("I17b", "turnConfigured: không cấu hình → false (ttl 1 h); TURN_URLS thiếu thông tin đăng nhập → false; TURN_URLS + TURN_SECRET → true",
      !a.turnConfigured && a.ttlSec === 3600 && !b.turnConfigured && c.turnConfigured && c.hasTurn, { a: a.turnConfigured, b: b.turnConfigured, c: c.turnConfigured });
  }

  // 8. Cờ test bị bỏ qua trên Vercel (luôn gọi máy chủ Cloudflare thật).
  {
    resetIceCache();
    const seen: string[] = [];
    const logs: string[] = [];
    const fakeFetch = (async (u: string) => {
      seen.push(String(u));
      return new Response("{}", { status: 503 });
    }) as unknown as typeof fetch;
    await buildIceServers("u1", { env: { ...CF_ENV, VERCEL: "1" }, fetch: fakeFetch, log: (m) => logs.push(m) });
    ok("I18", "VERCEL=1 + CLOUDFLARE_TURN_ALLOW_TEST → bỏ qua máy chủ test, gọi rtc.live.cloudflare.com", seen[0]?.startsWith("https://rtc.live.cloudflare.com/v1/turn/keys/") && logs.some((m) => /ignored/.test(m)), { seen, logs });
    resetIceCache();
    seen.length = 0;
    await buildIceServers("u1", { env: { ...CF_ENV, CLOUDFLARE_TURN_TEST_BASE: "http://evil.example.com:80" }, fetch: fakeFetch, log: () => {} });
    ok("I19", "CLOUDFLARE_TURN_TEST_BASE không phải loopback → bỏ qua", seen[0]?.startsWith("https://rtc.live.cloudflare.com/"), seen);
  }

  // 9. Cloudflare + TURN chung cùng lúc → gộp, ttl nhỏ nhất.
  {
    resetIceCache();
    mode = "array";
    const r = await buildIceServers("u1", { env: { ...CF_ENV, TURN_URLS: "turn:relay.example.com:3478", TURN_SECRET: "x" } });
    ok("I20", "Cloudflare + coturn cùng lúc → gộp cả 2, ttl = nhỏ nhất (3600)", r.iceServers.filter((s) => s.username).length === 2 && r.ttlSec === 3600, r);
  }
} finally {
  server.close();
}

console.log(`\nICE servers: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
