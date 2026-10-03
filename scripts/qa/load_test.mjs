// Kiểm thử tải: nhiều người dùng đồng thời đọc feed/job board, nhắn tin,
// và đăng ký cùng lúc. Chạy: node scripts/qa/load_test.mjs
// Biến môi trường: CONCURRENCY (mặc định 200), DURATION_S (mặc định 20).
import fs from "fs";
import { Client, BASE_URL, registerUser, SEED_OWNER, SEED_TECH } from "./lib.mjs";

const CONCURRENCY = Number(process.env.CONCURRENCY || 200);
const DURATION_S = Number(process.env.DURATION_S || 20);

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

async function runScenario(name, workers, durationS, task) {
  const lat = [];
  const codes = {};
  let errors = 0;
  const end = Date.now() + durationS * 1000;
  const start = Date.now();
  await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      let i = 0;
      while (Date.now() < end) {
        const t0 = performance.now();
        try {
          const status = await task(w, i++);
          codes[status] = (codes[status] || 0) + 1;
          if (status >= 500 || status === 0) errors++;
        } catch (e) {
          errors++;
          codes[e.code || "NETERR"] = (codes[e.code || "NETERR"] || 0) + 1;
        }
        lat.push(performance.now() - t0);
      }
    })
  );
  const secs = (Date.now() - start) / 1000;
  const r = {
    name,
    workers,
    requests: lat.length,
    rps: Math.round(lat.length / secs),
    p50: pct(lat, 50),
    p95: pct(lat, 95),
    p99: pct(lat, 99),
    max: Math.round(Math.max(...lat)),
    errorRate: +(errors / Math.max(1, lat.length) * 100).toFixed(2),
    codes,
  };
  console.log(`\n▶ ${name}\n  ${r.requests} req | ${r.rps} req/s | p50 ${r.p50}ms p95 ${r.p95}ms p99 ${r.p99}ms max ${r.max}ms | lỗi ${r.errorRate}% | ${JSON.stringify(codes)}`);
  return r;
}

const get = async (path, headers = {}) => {
  const res = await fetch(BASE_URL + path, { headers, redirect: "manual" });
  await res.arrayBuffer();
  return res.status;
};

const results = [];

// 1. Khách ẩn danh xem job board / feed / thợ / chợ vật tư / trang đăng nhập.
const publicPaths = ["/api/jobs", "/api/posts", "/api/technicians", "/api/supply", "/auth/login", "/auth/register", "/api/jobs?market=US&state=CA"];
results.push(await runScenario(`Đọc công khai (${CONCURRENCY} người đồng thời)`, CONCURRENCY, DURATION_S, (w, i) => get(publicPaths[(w + i) % publicPaths.length])));

// 2. Người dùng đã đăng nhập: mở hộp thư, đọc hội thoại, gửi tin, lướt feed.
const users = [];
for (const email of [SEED_OWNER, SEED_TECH]) {
  const c = new Client();
  await c.login(email);
  users.push(c);
}
const [owner, tech] = users;
const first = await tech.req("/api/messages", { method: "POST", json: { receiverId: owner.userId, content: "load test start" } });
const convId = first.data?.message?.conversationId;
const authWorkers = Math.max(10, Math.floor(CONCURRENCY / 4));
results.push(
  await runScenario(`Người dùng đăng nhập nhắn tin + lướt feed (${authWorkers} người)`, authWorkers, DURATION_S, async (w, i) => {
    const c = w % 2 ? owner : tech;
    const op = i % 4;
    if (op === 0) return (await c.req("/api/messages", { method: "POST", json: { conversationId: convId, content: `tin tải ${w}-${i}` } })).status;
    if (op === 1) return (await c.req(`/api/messages?conversationId=${convId}`)).status;
    if (op === 2) return (await c.req("/api/messages")).status;
    return (await c.req("/api/posts")).status;
  })
);

// 3. Đăng ký ồ ạt (bcrypt tốn CPU) — mỗi request 1 IP thật khác nhau như
// ngày ra mắt, không được 429 nhầm người dùng thật.
const signupN = Math.min(100, CONCURRENCY);
{
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: signupN }, () => registerUser().then((r) => r.res.status).catch(() => 0)));
  const codes = {};
  for (const s of rs) codes[s] = (codes[s] || 0) + 1;
  const r = { name: `Đăng ký đồng thời ${signupN} tài khoản`, requests: signupN, totalMs: Math.round(performance.now() - t0), codes, errorRate: +((rs.filter((s) => s !== 201).length / signupN) * 100).toFixed(2) };
  console.log(`\n▶ ${r.name}\n  xong trong ${r.totalMs}ms | ${JSON.stringify(codes)}`);
  results.push(r);
}

// 4. Sau tải, server vẫn phản hồi bình thường.
const health = await get("/api/jobs");
console.log(`\nSau tải: /api/jobs → ${health}`);
results.push({ name: "Server còn sống sau tải", ok: health === 200 });

fs.mkdirSync(new URL("./reports/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./reports/load_test.json", import.meta.url), JSON.stringify({ concurrency: CONCURRENCY, durationS: DURATION_S, results }, null, 2));
