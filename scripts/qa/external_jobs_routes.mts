// Tuyến API tin việc đối tác + tin tổng hợp — gọi thẳng hàm của route (không cần máy chủ, KHÔNG gọi mạng thật) trên
// 1 SQLite TẠM (lib/prisma dùng globalThis.prisma → không đụng prisma/dev.db, không đụng Turso):
//   - cron /api/cron/external-jobs: thiếu / sai CRON_SECRET → 401; tắt công tắc hoặc thiếu khoá → no-op
//   - /api/jobs/external: công tắc tắt / chưa có giấy phép → rỗng, không đọc DB; có giấy phép → đúng dạng phản hồi
//   - /api/jobs/web-search: tắt / thiếu khoá / chưa xác nhận điều khoản → không gọi Careerjet; bot / gọi từ trang khác /
//     IP nội bộ → 403 không gọi Careerjet; người xem thật trên trang mình → gọi đúng 1 lần, private no-store
//   - CHƯA chạy prisma/sql/2026-11-07_external_jobs.sql (bảng ExternalJob chưa có — như production lúc mới deploy):
//     mọi trang / API (bảng việc, tin, cron, tin đối tác, tìm trên web, thẻ admin, nhận tin từ nhóm) vẫn chạy, không 500
//   - /api/jobs/:id + /api/jobs: tin TỪ NHÓM cộng đồng PawNail → GIỮ SĐT + mô tả đầy đủ, link "Xem bài gốc" khi có;
//     tin không có link vẫn hiện; tin đã gỡ → 410
//   - /api/ingest/jobs, /api/jobs/sync: biến INGEST_AGGREGATED không đặt → NHẬN như main; chỉ "off" mới trả 410 INGEST_OFF
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/external_jobs_routes.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

// ---- DB tạm (đúng schema + bảng ExternalJob tạo bằng file SQL giao cho chủ) ----
const dbFile = path.join(os.tmpdir(), `pawnail_extroutes_${Date.now()}.db`).replace(/\\/g, "/");
const url = `file:${dbFile}`;
execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
const db = new PrismaClient({ datasources: { db: { url } } });
await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ExternalJob"`); // như production: chủ CHƯA chạy file SQL
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;
const createExternalTable = async () => {
  for (const st of fs.readFileSync("prisma/sql/2026-11-07_external_jobs.sql", "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((x) => x.trim()).filter(Boolean)) await db.$executeRawUnsafe(st);
};

// Mọi lệnh gọi mạng trong lúc test là lỗi, trừ khi 1 bài kiểm tra tự đặt fetch giả
const netCalls: string[] = [];
const realFetch = globalThis.fetch;
const noNet = (async (u: RequestInfo | URL) => { netCalls.push(String(u)); throw new Error("network disabled in test"); }) as typeof fetch;
globalThis.fetch = noNet;

for (const k of ["EXTERNAL_JOBS_ADZUNA", "ADZUNA_APP_ID", "ADZUNA_APP_KEY", "ADZUNA_LICENSE_REF", "EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY", "CAREERJET_TERMS_CONFIRMED", "INGEST_AGGREGATED"]) delete process.env[k];
process.env.CRON_SECRET = "qa-cron-secret-0123456789";
process.env.NEXTAUTH_SECRET ||= "qa-only-nextauth-secret-not-used-anywhere"; // route /api/jobs/:id nạp authOptions

const cron = await import("../../app/api/cron/external-jobs/route");
const ext = await import("../../app/api/jobs/external/route");
const web = await import("../../app/api/jobs/web-search/route");
const jobRoute = await import("../../app/api/jobs/[id]/route");
const ingestRoute = await import("../../app/api/ingest/jobs/route");
const syncRoute = await import("../../app/api/jobs/sync/route");
const jobsList = await import("../../app/api/jobs/route");
const { externalJobsStatus } = await import("../../lib/jobFeeds/sync");
const req = (p: string, headers: Record<string, string> = {}) => new NextRequest(new URL(p, "http://localhost:3000"), { headers });
const post = (h: Record<string, string>, body: unknown) => new Request("http://localhost:3000/x", { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) });
const call = (id: string) => jobRoute.GET(new Request(`http://localhost:3000/api/jobs/${id}`), { params: Promise.resolve({ id }) });
const human = { "x-vercel-forwarded-for": "8.8.4.4", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1", "sec-fetch-site": "same-origin" };
process.env.INGEST_KEY = "qa-ingest-key-0123456789abcdef";

// ================= Deploy KHÔNG chạy file SQL: bảng ExternalJob chưa có =================
// (1) Không source nào ngoài lib/jobFeeds/sync.ts + route tìm trên web đụng tới bảng ExternalJob (mọi chỗ đều có chặn)
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx|mts|js|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []));
const touching = ["app", "lib", "components"].flatMap(walk).filter((f) => /\.externalJob\b/.test(fs.readFileSync(f, "utf8"))).map((f) => f.replace(/\\/g, "/")).sort();
ok("X1", "Chỉ lib/jobFeeds/sync.ts + app/api/jobs/web-search/route.ts truy vấn bảng ExternalJob (mọi chỗ đã kiểm có chặn khi bảng chưa có / công tắc tắt)", JSON.stringify(touching) === JSON.stringify(["app/api/jobs/web-search/route.ts", "lib/jobFeeds/sync.ts"]), JSON.stringify(touching));
// (2) Gọi thật mọi đường có thể chạm bảng, cả khi công tắc TẮT (mặc định) lẫn khi chủ lỡ BẬT trước khi chạy SQL
const tm = Number((await db.$queryRawUnsafe<{ n: bigint | number }[]>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='ExternalJob'`))[0]?.n); // 0 = chưa có bảng
const xOff = await Promise.all([
  cron.GET(req("/api/cron/external-jobs", { authorization: `Bearer ${process.env.CRON_SECRET}` })),
  ext.GET(req("/api/jobs/external?market=US&state=TX")),
  web.GET(req("/api/jobs/web-search?market=US&state=TX", human)),
]);
const xOffBody = await Promise.all(xOff.map((r) => r.json()));
const stOff = await externalJobsStatus().catch((e: Error) => ({ threw: String(e?.message).slice(0, 120) }));
ok("X2", "Bảng chưa có + công tắc TẮT (mặc định): cron 200 (không lỗi), /api/jobs/external + /api/jobs/web-search 200 enabled=false, thẻ admin live=null (không ném lỗi), không gọi mạng",
  tm === 0 && xOff.every((r) => r.status === 200) && ["disabled", "table_missing"].includes(xOffBody[0]?.adzuna?.status) && xOffBody[1].enabled === false && xOffBody[2].enabled === false && !("threw" in stOff) && (stOff as { live: unknown }).live === null && netCalls.length === 0,
  JSON.stringify({ tables: tm, st: xOff.map((r) => r.status), xOffBody, stOff }));
Object.assign(process.env, { EXTERNAL_JOBS_ADZUNA: "on", ADZUNA_APP_ID: "qa", ADZUNA_APP_KEY: "qa-key", ADZUNA_LICENSE_REF: "ADZ-QA-LICENCE", EXTERNAL_JOBS_CAREERJET: "on", CAREERJET_API_KEY: "cj-test-key", CAREERJET_TERMS_CONFIRMED: "email 2026-11-21" });
const cjSeen: string[] = [];
globalThis.fetch = (async (u: RequestInfo | URL) => {
  cjSeen.push(String(u));
  if (!/careerjet/.test(String(u))) throw new Error("only Careerjet expected");
  return new Response(JSON.stringify({ type: "JOBS", hits: 1, jobs: [{ title: "Nail Technician", company: "NoTable QA Glow", locations: "Austin, TX", url: "https://jobviewtrack.com/en-us/job-nt1", date: "2026-11-05" }] }), { status: 200 });
}) as typeof fetch;
const xOn = await Promise.all([
  cron.GET(req("/api/cron/external-jobs", { authorization: `Bearer ${process.env.CRON_SECRET}` })),
  ext.GET(req("/api/jobs/external?market=US&state=TX")),
  web.GET(req("/api/jobs/web-search?market=US&state=TX", human)),
]);
globalThis.fetch = noNet;
const xOnBody = await Promise.all(xOn.map((r) => r.json()));
const stOn = await externalJobsStatus().catch((e: Error) => ({ threw: String(e?.message).slice(0, 120) }));
ok("X3", "Bảng chưa có mà chủ lỡ BẬT hết công tắc: cron 200 'table_missing' (không gọi Adzuna), /api/jobs/external 200 enabled=false rỗng, tìm trên web vẫn trả tin Careerjet (bỏ bước chống trùng Adzuna), thẻ admin live=null",
  xOn.every((r) => r.status === 200) && xOnBody[0]?.adzuna?.status === "table_missing" && xOnBody[1].enabled === false && xOnBody[1].items.length === 0 && xOnBody[2].items?.length === 1 && cjSeen.length === 1 && !cjSeen.some((u) => /adzuna/.test(u)) && !("threw" in stOn) && (stOn as { live: unknown }).live === null,
  JSON.stringify({ st: xOn.map((r) => r.status), xOnBody, cjSeen, stOn }).slice(0, 600));
for (const k of ["EXTERNAL_JOBS_ADZUNA", "ADZUNA_APP_ID", "ADZUNA_APP_KEY", "ADZUNA_LICENSE_REF", "EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY", "CAREERJET_TERMS_CONFIRMED"]) delete process.env[k];
// (3) Bảng việc + nhận tin từ nhóm hoạt động bình thường khi chưa có bảng
const ntPost = await ingestRoute.POST(post({ authorization: `Bearer ${process.env.INGEST_KEY}` }, { posts: [{ text: "Tiệm cần thợ bột gấp ở Katy TX, bao lương $1,300/tuần. LH 832-555-0161", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/77/posts/1" }] }));
const ntOut = await ntPost.json();
const ntId = ntOut.results?.[0]?.jobId as string | undefined;
const ntList = await jobsList.GET(req("/api/jobs?market=US&state=TX&page=1&pageSize=50"));
const ntListBody = (await ntList.json()) as { id: string; phone: string }[];
const ntOne = ntId ? await call(ntId) : null;
ok("X4", "Bảng chưa có: /api/ingest/jobs nhận tin (biến không đặt) → /api/jobs + /api/jobs/:id 200, tin có SĐT",
  ntPost.status === 200 && ntOut.created === 1 && ntList.status === 200 && ntListBody.some((j) => j.id === ntId && j.phone === "(832) 555-0161") && ntOne?.status === 200,
  JSON.stringify({ st: ntPost.status, ntOut, list: ntList.status, one: ntOne?.status }).slice(0, 400));
await createExternalTable(); // từ đây: như sau khi chủ đã chạy file SQL (kiểm luôn file SQL)

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
ok("R2", "Cron đúng khoá, công tắc Adzuna TẮT → no-op (disabled), không gọi mạng", r2.status === 200 && ["disabled", "table_missing", "purged"].includes(b2?.adzuna?.status) && netCalls.length === 0, JSON.stringify(b2));

process.env.EXTERNAL_JOBS_ADZUNA = "on";
const r3 = await cron.GET(req("/api/cron/external-jobs", { authorization: `Bearer ${saved}` }));
const b3 = await r3.json();
ok("R3", "Cron bật công tắc nhưng THIẾU khoá Adzuna → 'no_keys', không gọi mạng, không ghi DB", r3.status === 200 && b3?.adzuna?.status === "no_keys" && netCalls.length === 0, JSON.stringify(b3));
delete process.env.EXTERNAL_JOBS_ADZUNA;

const r4 = await ext.GET(req("/api/jobs/external?market=AU&state=NSW"));
const b4 = await r4.json();
ok("R4", "/api/jobs/external công tắc tắt → enabled=false, rỗng, X-Total-Count 0, noindex, CDN ≤ 60 s", b4.enabled === false && b4.items.length === 0 && r4.headers.get("x-total-count") === "0" && /noindex/.test(r4.headers.get("x-robots-tag") || "") && /s-maxage=60\b/.test(r4.headers.get("cache-control") || ""), JSON.stringify({ b4, h: Object.fromEntries(r4.headers) }));

const r5 = await web.GET(req("/api/jobs/web-search?market=US&state=TX", { "x-forwarded-for": "8.8.8.8", "user-agent": "Mozilla/5.0 (iPhone) QA" }));
const b5 = await r5.json();
ok("R5", "/api/jobs/web-search Careerjet tắt → enabled=false, không gọi Careerjet, private no-store + noindex", b5.enabled === false && netCalls.length === 0 && /no-store/.test(r5.headers.get("cache-control") || "") && /noindex/.test(r5.headers.get("x-robots-tag") || ""), JSON.stringify(b5));

process.env.EXTERNAL_JOBS_CAREERJET = "on"; // bật nhưng không có CAREERJET_API_KEY
const r6 = await web.GET(req("/api/jobs/web-search?market=US", { "x-forwarded-for": "8.8.8.8" }));
process.env.CAREERJET_API_KEY = "cj-test-key"; // có khoá nhưng CHƯA có xác nhận điều khoản bằng văn bản
const r6b = await web.GET(req("/api/jobs/web-search?market=US", { "x-forwarded-for": "8.8.8.8", "user-agent": "Mozilla/5.0 (iPhone) QA", "sec-fetch-site": "same-origin" }));
ok("R6", "Careerjet bật nhưng thiếu khoá, hoặc có khoá mà chưa có CAREERJET_TERMS_CONFIRMED → vẫn tắt, không gọi mạng", (await r6.json()).enabled === false && (await r6b.json()).enabled === false && netCalls.length === 0);

// ---- Giấy phép Adzuna: khoá dùng thử không bao giờ hiện công khai ----
const T = new Date();
await db.externalJob.create({ data: { provider: "adzuna", providerJobId: "pub1", market: "AU", title: "Nail Technician", company: "Route QA Beauty", locationLabel: "Blacktown, Sydney", state: "NSW", city: "Blacktown", redirectUrl: "https://www.adzuna.com.au/land/ad/pub1", providerCreatedAt: new Date(T.getTime() - 86400_000), lastSeenAt: T, expiresAt: new Date(T.getTime() + 48 * 3600_000), dedupeKey: "k-pub1" } });
process.env.EXTERNAL_JOBS_ADZUNA = "on"; process.env.ADZUNA_APP_ID = "qa"; process.env.ADZUNA_APP_KEY = "qa-key";
const r7 = await ext.GET(req("/api/jobs/external?market=AU&state=NSW"));
const b7 = await r7.json();
ok("R7", "Adzuna BẬT + khoá nhưng CHƯA có ADZUNA_LICENSE_REF → /api/jobs/external vẫn enabled=false, 0 tin (dù DB có tin)", b7.enabled === false && b7.items.length === 0 && r7.headers.get("x-total-count") === "0", JSON.stringify(b7));
process.env.ADZUNA_LICENSE_REF = "ADZ-QA-LICENCE";
const r8 = await ext.GET(req("/api/jobs/external?market=AU&state=NSW"));
const b8 = await r8.json();
const it = b8.items?.[0];
ok("R8", "Có giấy phép → enabled=true, đúng dạng: via provider, attribution 'Jobs by Adzuna' → adzuna.com.au, url Adzuna, postedAt ISO, không SĐT / mô tả; X-Total-Count 1",
  b8.enabled === true && b8.total === 1 && r8.headers.get("x-total-count") === "1" && it?.provider === "adzuna" && it?.attribution?.label === "Jobs by Adzuna" && it?.attribution?.href === "https://www.adzuna.com.au" && it?.url === "https://www.adzuna.com.au/land/ad/pub1" && typeof it?.postedAt === "string" && !("phone" in it) && !("description" in it) && netCalls.length === 0,
  JSON.stringify(b8));
for (const k of ["EXTERNAL_JOBS_ADZUNA", "ADZUNA_APP_ID", "ADZUNA_APP_KEY", "ADZUNA_LICENSE_REF"]) delete process.env[k];

// ---- web-search: chỉ người xem thật trên chính trang PawNail ----
process.env.CAREERJET_TERMS_CONFIRMED = "email 2026-11-21";
const blocked = await Promise.all([
  web.GET(req("/api/jobs/web-search?market=US", { ...human, "user-agent": "curl/8.4.0" })),
  web.GET(req("/api/jobs/web-search?market=US", { ...human, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })),
  web.GET(req("/api/jobs/web-search?market=US", { ...human, "sec-fetch-site": "cross-site" })),
  web.GET(req("/api/jobs/web-search?market=US", { ...human, "x-vercel-forwarded-for": "10.1.2.3" })),
  web.GET(req("/api/jobs/web-search?market=US", { "user-agent": human["user-agent"], "sec-fetch-site": "same-origin", "cf-connecting-ip": "8.8.8.8" })), // không tin cf-connecting-ip
]);
ok("W1", "Careerjet bật đủ điều kiện: curl / Googlebot / gọi từ trang khác / IP nội bộ / chỉ có cf-connecting-ip → 403 not_allowed, KHÔNG gọi Careerjet", blocked.every((r) => r.status === 403) && netCalls.length === 0, JSON.stringify(blocked.map((r) => r.status)));
const cjCalls: string[] = [];
globalThis.fetch = (async (u: RequestInfo | URL) => {
  cjCalls.push(String(u));
  return new Response(JSON.stringify({ type: "JOBS", hits: 1, jobs: [{ title: "Nail Technician", company: "Route QA Glow", locations: "Austin, TX", url: "https://jobviewtrack.com/en-us/job-qa1", description: "Gel and acrylic" }] }), { status: 200 });
}) as typeof fetch;
const wOk = await web.GET(req("/api/jobs/web-search?market=US&state=TX", human));
const bw = await wOk.json();
globalThis.fetch = noNet;
const sent = new URL(cjCalls[0] || "https://x");
ok("W2", "Người xem thật → gọi Careerjet đúng 1 lần với IP + trình duyệt của họ; tin không ghi ngày → postedAt null; private no-store",
  wOk.status === 200 && cjCalls.length === 1 && sent.searchParams.get("user_ip") === "8.8.4.4" && /iPhone/.test(sent.searchParams.get("user_agent") || "") && bw.items?.length === 1 && bw.items[0].postedAt === null && bw.items[0].attribution?.label === "Jobs by Careerjet" && /no-store/.test(wOk.headers.get("cache-control") || ""),
  JSON.stringify({ st: wOk.status, calls: cjCalls.length, bw }));
for (const k of ["EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY", "CAREERJET_TERMS_CONFIRMED"]) delete process.env[k];

// ---- /api/jobs/:id + /api/jobs: tin TỪ NHÓM giữ SĐT + mô tả đầy đủ; không có link vẫn hiện; đã gỡ → 410 ----
const feed = await db.user.create({ data: { email: `route.feed.${Date.now()}@qa.test`, name: "QA Feed", password: "x", role: "OWNER", market: "US", state: "TX" } });
const mk = (o: Record<string, unknown>) => db.job.create({ data: { title: "Cần thợ bột", salonName: "Route QA Nails", description: "Cần thợ bột gấp. LH 832-555-0177", ownerId: feed.id, market: "US", state: "TX", city: "Katy", salaryType: "x", salaryAmount: "$1,200/tuần", skills: "", benefits: "", phone: "(832) 555-0177", expiresAt: new Date(Date.now() + 5 * 86400_000), ...o } as never });
const jIngest = await mk({ source: "ingest", sourceUrl: "https://www.facebook.com/groups/9/posts/1/?__cft__[0]=AZsecret&__tn__=R", sourceKey: "k1", sourceFbHash: "h1" });
const jNoLink = await mk({ source: "ingest", sourceUrl: null, phone: "(832) 555-0178", description: "Cần thợ chân tay nước. LH 832-555-0178" });
const jRemoved = await mk({ source: "removed", phone: "", description: "", salonName: "", expiresAt: new Date() });
const [g1, g2, g3] = await Promise.all([call(jIngest.id), call(jNoLink.id), call(jRemoved.id)]);
const bg1 = await g1.json();
const bg2 = await g2.json();
ok("J1", "Tin từ nhóm → 200, GIỮ SĐT '(832) 555-0177' (nút Gọi ngay) + mô tả đầy đủ (có cả SĐT trong bài), link 'Xem bài gốc' trên Facebook đã bỏ mã theo dõi, không lộ sourceKey / sourceFbHash / sourceUrl thô",
  g1.status === 200 && bg1.phone === "(832) 555-0177" && bg1.description === "Cần thợ bột gấp. LH 832-555-0177" && bg1.sourceLink?.name === "Facebook" && bg1.sourceLink?.href === "https://www.facebook.com/groups/9/posts/1/" && !("sourceKey" in bg1) && !("sourceFbHash" in bg1) && !("sourceUrl" in bg1),
  JSON.stringify(bg1).slice(0, 400));
ok("J2", "Tin từ nhóm KHÔNG có link bài gốc → 200, vẫn có SĐT, sourceLink null; tin đã GỠ theo yêu cầu tiệm → 410, không trả SĐT / tên tiệm",
  g2.status === 200 && bg2.phone === "(832) 555-0178" && bg2.sourceLink === null && g3.status === 410 && !JSON.stringify(await g3.json()).includes("832"),
  `${g2.status} ${JSON.stringify({ phone: bg2.phone, link: bg2.sourceLink })} ${g3.status}`);
const list = await jobsList.GET(req("/api/jobs?market=US&state=TX&page=1&pageSize=50"));
const lb = (await list.json()) as { id: string; phone: string; description: string; sourceLink: unknown; sourceUrl?: unknown }[];
const li = lb.find((j) => j.id === jIngest.id), ln = lb.find((j) => j.id === jNoLink.id);
ok("J3", "/api/jobs (bảng việc): tin từ nhóm có SĐT + mô tả đầy đủ + link; tin KHÔNG có link vẫn trong danh sách với SĐT; tin đã gỡ không có; X-Total-Count đếm cả 2",
  list.status === 200 && li?.phone === "(832) 555-0177" && /832-555-0177/.test(li?.description || "") && !!li?.sourceLink && !("sourceUrl" in (li || {})) && ln?.phone === "(832) 555-0178" && ln?.sourceLink === null && !lb.some((j) => j.id === jRemoved.id) && Number(list.headers.get("x-total-count")) >= 2,
  JSON.stringify({ st: list.status, li, ln, total: list.headers.get("x-total-count") }).slice(0, 500));

// ---- Nhận tin từ nhóm: biến KHÔNG đặt → nhận như main; chỉ "off" mới 410; sai khoá vẫn 401 ----
delete process.env.INGEST_AGGREGATED;
const n0 = Date.now() % 1000;
const p3 = (k: number) => String((n0 + k) % 1000).padStart(3, "0");
const i1 = await ingestRoute.POST(post({ authorization: `Bearer ${process.env.INGEST_KEY}` }, { posts: [{ text: `Tiệm cần thợ bột gấp. LH 281-555-0${p3(1)}`, state: "TX", market: "US" }] }));
const bi1 = await i1.json();
const i2 = await syncRoute.POST(post({ "x-api-key": process.env.INGEST_KEY }, { title: "Cần thợ", phone: `281-555-0${p3(2)}`, content: `Tiệm cần thợ bột gấp. Gọi 281-555-0${p3(2)}`, state: "TX", country: "US", post_url: "https://www.facebook.com/groups/9/posts/2" }));
const bi2 = await i2.json();
const i3 = await ingestRoute.POST(post({ authorization: "Bearer wrong" }, { posts: [] }));
const created = bi1.results?.[0]?.jobId ? await db.job.findUnique({ where: { id: bi1.results[0].jobId } }) : null;
ok("N1", "INGEST_AGGREGATED KHÔNG đặt: /api/ingest/jobs 200 tạo tin (source ingest, có SĐT) + /api/jobs/sync 201 created — nhận như main; sai khoá vẫn 401",
  i1.status === 200 && bi1.created === 1 && created?.source === "ingest" && created?.phone === `(281) 555-0${p3(1)}` && i2.status === 201 && bi2.status === "created" && i3.status === 401,
  JSON.stringify({ i1: i1.status, bi1, i2: i2.status, bi2, i3: i3.status }).slice(0, 400));
process.env.INGEST_AGGREGATED = "off";
const before = await db.job.count();
const o1 = await ingestRoute.POST(post({ authorization: `Bearer ${process.env.INGEST_KEY}` }, { posts: [{ text: `Tiệm cần thợ bột gấp. LH 281-555-0${p3(3)}`, state: "TX", market: "US" }] }));
const o2 = await syncRoute.POST(post({ "x-api-key": process.env.INGEST_KEY }, { title: "Cần thợ", phone: `281-555-0${p3(4)}`, content: "Tiệm cần thợ bột gấp", state: "TX", country: "US" }));
const og = await ingestRoute.GET(new Request("http://localhost:3000/x", { headers: { authorization: `Bearer ${process.env.INGEST_KEY}` } }));
const ogb = await og.json();
ok("N2", "Công tắc khẩn cấp INGEST_AGGREGATED=off → cả 2 địa chỉ 410 INGEST_OFF, không tạo tin; GET thống kê ghi accepting=false",
  o1.status === 410 && o2.status === 410 && (await o1.json()).code === "INGEST_OFF" && (await db.job.count()) === before && og.status === 200 && ogb.accepting === false,
  `${o1.status} ${o2.status} ${JSON.stringify(ogb).slice(0, 120)}`);
process.env.INGEST_AGGREGATED = "on";
const o3 = await ingestRoute.POST(post({ authorization: `Bearer ${process.env.INGEST_KEY}` }, { posts: [{ text: `Tiệm cần thợ bột gấp. LH 281-555-0${p3(5)}`, state: "TX", market: "US" }] }));
ok("N3", "INGEST_AGGREGATED=on (giá trị bất kỳ khác 'off') → nhận bình thường", o3.status === 200 && (await o3.json()).created === 1, String(o3.status));
delete process.env.INGEST_AGGREGATED;

globalThis.fetch = realFetch;
await db.$disconnect();
try { fs.rmSync(dbFile, { force: true }); fs.rmSync(dbFile + "-journal", { force: true }); } catch {}
console.log(`\nTuyến API tin việc đối tác: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
