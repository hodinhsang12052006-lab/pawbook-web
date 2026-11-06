// Tuyến API tin việc đối tác — gọi thẳng hàm GET của route (không cần máy chủ, KHÔNG gọi mạng):
//   - cron /api/cron/external-jobs: thiếu / sai CRON_SECRET → 401; tắt công tắc hoặc thiếu khoá → no-op
//   - /api/jobs/external: công tắc tắt → rỗng, không đọc DB, có noindex + X-Total-Count 0
//   - /api/jobs/web-search: Careerjet tắt / thiếu khoá → rỗng, không gọi Careerjet; private, no-store, noindex
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/external_jobs_routes.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
import { NextRequest } from "next/server";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

// Mọi lệnh gọi mạng trong lúc test là lỗi (route không được gọi Adzuna / Careerjet khi tắt / thiếu khoá)
const netCalls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (u: RequestInfo | URL) => { netCalls.push(String(u)); throw new Error("network disabled in test"); }) as typeof fetch;

for (const k of ["EXTERNAL_JOBS_ADZUNA", "ADZUNA_APP_ID", "ADZUNA_APP_KEY", "EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY"]) delete process.env[k];
process.env.CRON_SECRET = "qa-cron-secret-0123456789";

const cron = await import("../../app/api/cron/external-jobs/route");
const ext = await import("../../app/api/jobs/external/route");
const web = await import("../../app/api/jobs/web-search/route");
const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(new URL(path, "http://localhost:3000"), { headers });

const r0 = await cron.GET(req("/api/cron/external-jobs"));
const r1 = await cron.GET(req("/api/cron/external-jobs", { authorization: "Bearer wrong" }));
ok("R1", "Cron không có / sai CRON_SECRET → 401", r0.status === 401 && r1.status === 401, `${r0.status} ${r1.status}`);

const saved = process.env.CRON_SECRET;
delete process.env.CRON_SECRET;
const r1b = await cron.GET(req("/api/cron/external-jobs", { authorization: "Bearer " }));
process.env.CRON_SECRET = saved;
ok("R1b", "Chưa đặt CRON_SECRET → cron luôn từ chối (không mở cửa)", r1b.status === 401, String(r1b.status));

const r2 = await cron.GET(req("/api/cron/external-jobs", { authorization: `Bearer ${saved}` }));
const b2 = await r2.json();
ok("R2", "Cron đúng khoá, công tắc Adzuna TẮT → no-op (disabled / table_missing), không gọi mạng", r2.status === 200 && ["disabled", "table_missing", "purged"].includes(b2?.adzuna?.status) && netCalls.length === 0, JSON.stringify(b2));

process.env.EXTERNAL_JOBS_ADZUNA = "on";
const r3 = await cron.GET(req("/api/cron/external-jobs", { authorization: `Bearer ${saved}` }));
const b3 = await r3.json();
ok("R3", "Cron bật công tắc nhưng THIẾU khoá Adzuna → 'no_keys', không gọi mạng, không ghi DB", r3.status === 200 && b3?.adzuna?.status === "no_keys" && netCalls.length === 0, JSON.stringify(b3));
delete process.env.EXTERNAL_JOBS_ADZUNA;

const r4 = await ext.GET(req("/api/jobs/external?market=AU&state=NSW"));
const b4 = await r4.json();
ok("R4", "/api/jobs/external công tắc tắt → enabled=false, rỗng, X-Total-Count 0, noindex", b4.enabled === false && b4.items.length === 0 && r4.headers.get("x-total-count") === "0" && /noindex/.test(r4.headers.get("x-robots-tag") || ""), JSON.stringify({ b4, h: Object.fromEntries(r4.headers) }));

const r5 = await web.GET(req("/api/jobs/web-search?market=US&state=TX", { "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "QA/1.0" }));
const b5 = await r5.json();
ok("R5", "/api/jobs/web-search Careerjet tắt → enabled=false, không gọi Careerjet, private no-store + noindex", b5.enabled === false && netCalls.length === 0 && /no-store/.test(r5.headers.get("cache-control") || "") && /noindex/.test(r5.headers.get("x-robots-tag") || ""), JSON.stringify(b5));

process.env.EXTERNAL_JOBS_CAREERJET = "on"; // bật nhưng không có CAREERJET_API_KEY
const r6 = await web.GET(req("/api/jobs/web-search?market=US", { "x-forwarded-for": "203.0.113.8" }));
ok("R6", "Careerjet bật nhưng thiếu khoá → vẫn tắt (enabled=false), không gọi mạng", (await r6.json()).enabled === false && netCalls.length === 0);

globalThis.fetch = realFetch;
console.log(`\nTuyến API tin việc đối tác: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
