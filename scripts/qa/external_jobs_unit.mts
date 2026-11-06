// Tin việc từ ĐỐI TÁC (Adzuna lưu / Careerjet tìm trực tiếp) — chuẩn hoá, chống trùng, hết hạn, xoá, ghi nguồn,
// không lộ khoá. Nhà cung cấp GIẢ (fetch giả, dữ liệu hư cấu) trên 1 SQLite TẠM — không gọi mạng, không đụng prisma/dev.db.
//   env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npx tsx scripts/qa/external_jobs_unit.mts
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

// ---- DB tạm từ đúng schema, rồi tạo lại bảng ExternalJob bằng file SQL giao cho chủ (kiểm luôn file SQL) ----
const dbFile = path.join(os.tmpdir(), `pawnail_extjobs_${Date.now()}.db`).replace(/\\/g, "/");
const url = `file:${dbFile}`;
execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
const db = new PrismaClient({ datasources: { db: { url } } });
await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ExternalJob"`);
const sql = fs.readFileSync("prisma/sql/2026-11-07_external_jobs.sql", "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((x) => x.trim()).filter(Boolean);
for (const st of sql) await db.$executeRawUnsafe(st);
ok("X0", "File SQL 2026-11-07_external_jobs.sql tạo được bảng ExternalJob mà Prisma đọc / ghi được", (await db.externalJob.count()) === 0);

const { normalizeAdzuna, normalizeCareerjet, isNailJob, companyMatch, hasContactInfo, stripHtml, stateCode } = await import("../../lib/jobFeeds/normalize");
const { runExternalJobsSync, listExternalJobs, SUMMARY_KEY } = await import("../../lib/jobFeeds/sync");
const { searchCareerjet } = await import("../../lib/jobFeeds/careerjet");

// ---- Thuần hàm ----
ok("N1", "Lọc nail: 'Nail Technician', 'Manicurist', 'Beauty Therapist' (đoạn trích có nail tech) → nail; 'Roofing Nailer', 'Framing Carpenter (nail gun)' → không",
  isNailJob("Nail Technician") && isNailJob("Manicurist / Pedicurist") && isNailJob("Beauty Therapist", "We need a nail technician for acrylics") && !isNailJob("Roofing Nailer") && !isNailJob("Framing Carpenter - nail gun") && !isNailJob("Warehouse Associate", "nail salon supplies"));
ok("N2", "Trùng tiệm: 'Lucky Nails & Spa' ~ 'LUCKY NAILS LLC'; 'Rose Nail Lounge' ~ 'Rose Nail Lounge Inc'; 'Happy Nails' ≠ 'Lucky Nails'; tên chỉ có chữ chung ('Nails & Spa') không khớp bừa",
  companyMatch("Lucky Nails & Spa", "LUCKY NAILS LLC") && companyMatch("Rose Nail Lounge", "Rose Nail Lounge Inc") && !companyMatch("Happy Nails", "Lucky Nails") && !companyMatch("Nails & Spa", "Nail Salon"));
ok("N3", "Phát hiện SĐT / email trong đoạn trích; bỏ HTML", hasContactInfo("Call (713) 555-0101 today") && hasContactInfo("text 0412 555 019") && hasContactInfo("email jobs@x.com") && !hasContactInfo("$45,000 - 55,000 per year") && stripHtml("<strong>Nail</strong> Tech &amp; Spa") === "Nail Tech & Spa");
ok("N4", "Tên bang Adzuna → mã PawNail (Texas → TX, New South Wales → NSW, District of Columbia → DC)", stateCode("US", "Texas") === "TX" && stateCode("AU", "New South Wales") === "NSW" && stateCode("US", "District of Columbia") === "DC" && stateCode("US", "Victoria") === null);

// ---- Nhà cung cấp giả ----
const T0 = new Date("2026-11-07T06:30:00Z");
const H = 3600_000;
const adz = <T extends { id: string }>(o: T) => ({ salary_is_predicted: "0", contract_time: "full_time", latitude: 29.7, longitude: -95.3, ...o });
const US_ALL = [
  adz({ id: "a1", title: "Nail Technician", company: { display_name: "Lucky Nails" }, location: { display_name: "Houston, Harris County", area: ["US", "Texas", "Harris County", "Houston"] }, salary_min: 40000, salary_max: 50000, redirect_url: "https://www.adzuna.com/land/ad/a1?se=x&v=y", created: "2026-11-05T10:00:00Z", description: "Busy salon hiring a <b>nail tech</b>." }),
  adz({ id: "a2", title: "Nail Tech", company: { display_name: "Glam Studio" }, location: { display_name: "Dallas, Dallas County", area: ["US", "Texas", "Dallas County", "Dallas"] }, salary_min: 99999, salary_max: 99999, salary_is_predicted: "1", redirect_url: "https://www.adzuna.com/land/ad/a2", created: "2026-11-04T10:00:00Z", description: "Acrylic and gel." }),
  adz({ id: "a3", title: "Roofing Nailer", company: { display_name: "Top Roofs" }, location: { display_name: "Austin", area: ["US", "Texas", "Travis County", "Austin"] }, redirect_url: "https://www.adzuna.com/land/ad/a3", created: "2026-11-04T10:00:00Z", description: "Roof work." }),
  adz({ id: "a4", title: "Manicurist", company: { display_name: "Rose Spa" }, location: { display_name: "Austin", area: ["US", "Texas", "Travis County", "Austin"] }, redirect_url: "https://www.adzuna.com/land/ad/a4", created: "2026-11-06T10:00:00Z", description: "Call 512-555-0199 to apply." }),
  adz({ id: "a5", title: "Manicurist", company: { display_name: "Rose Spa" }, location: { display_name: "Austin", area: ["US", "Texas", "Travis County", "Austin"] }, redirect_url: "https://www.adzuna.com/land/ad/a5", created: "2026-11-01T10:00:00Z", description: "Same ad, older." }),
  adz({ id: "a6", title: "<strong>Nail</strong> Artist", company: { display_name: "Polished Bar" }, location: { display_name: "Miami, Florida", area: ["US", "Florida", "Miami-Dade County", "Miami"] }, redirect_url: "https://www.adzuna.com/land/ad/a6", created: "2026-11-06T12:00:00Z", description: "Gel-X &amp; design." }),
  adz({ id: "a7", title: "Nail Technician", company: { display_name: "Phish" }, location: { display_name: "X", area: ["US", "Texas"] }, redirect_url: "https://evil.example.com/a7", created: "2026-11-06T12:00:00Z" }),
];
const AU_ALL = [
  adz({ id: "b1", title: "Nail Technician", company: { display_name: "Blacktown Beauty" }, location: { display_name: "Blacktown, Sydney", area: ["Australia", "New South Wales", "Sydney", "Blacktown"] }, salary_min: 60000, salary_max: 65000, redirect_url: "https://www.adzuna.com.au/land/ad/b1", created: "2026-11-05T00:00:00Z", description: "Full time nail technician." }),
];
let usNow = US_ALL;
const calls: string[] = [];
const fakeFetch = async (u: string) => {
  calls.push(u);
  const m = u.match(/jobs\/(us|au)\/search\/(\d+)/)!;
  const rows = m[1] === "us" ? usNow : AU_ALL;
  return new Response(JSON.stringify({ count: rows.length, results: m[2] === "1" ? rows : [] }), { status: 200, headers: { "content-type": "application/json" } });
};
// Ghi lại MỌI dòng log trong lúc chạy để kiểm không lộ khoá
const logs: string[] = [];
for (const k of ["log", "info", "warn", "error", "debug"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); if (k !== "debug") orig(...a); };
}

// Người dùng + tin tiệm tự đăng trùng với Adzuna a1 (cùng tiệm Lucky Nails, Houston TX)
const owner = await db.user.create({ data: { email: `ext.owner.${Date.now()}@qa.test`, name: "QA Owner", password: "x", role: "OWNER", market: "US", state: "TX" } });
const selfPost = await db.job.create({ data: { title: "Cần thợ bột", salonName: "Lucky Nails & Spa", description: "", ownerId: owner.id, market: "US", state: "TX", city: "Houston", salaryType: "Bao lương tuần", salaryAmount: "$1,200/tuần", skills: "", benefits: "", phone: "(713) 555-0100", expiresAt: new Date(Date.now() + 20 * 86400_000) } });
const jobsBefore = await db.job.count();

// ---- Tắt / thiếu khoá → no-op ----
delete process.env.EXTERNAL_JOBS_ADZUNA; delete process.env.ADZUNA_APP_ID; delete process.env.ADZUNA_APP_KEY;
const off = await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: T0 });
process.env.EXTERNAL_JOBS_ADZUNA = "on";
const noKeys = await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: T0 });
ok("S1", "Công tắc tắt → 'disabled'; bật mà thiếu khoá → 'no_keys'; KHÔNG gọi mạng, không ghi DB", off.adzuna.status === "disabled" && noKeys.adzuna.status === "no_keys" && calls.length === 0 && (await db.externalJob.count()) === 0 && !(await db.appSetting.findUnique({ where: { key: SUMMARY_KEY } })), JSON.stringify([off.adzuna.status, noKeys.adzuna.status, calls.length]));

// ---- Lượt 1 ----
const SECRET = "SECRET-KEY-do-not-log-9f8e7d";
process.env.ADZUNA_APP_ID = "qa-app-id";
process.env.ADZUNA_APP_KEY = SECRET;
const r1 = await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: T0 });
const row = (id: string) => db.externalJob.findUnique({ where: { provider_providerJobId: { provider: "adzuna", providerJobId: id } } });
const [a1, a2, a3, a4, a5, a6, a7, b1] = await Promise.all(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "b1"].map(row));
ok("S2", "Lượt 1: gọi đúng 2 thị trường, lưu 7 tin hợp lệ (bỏ tin link lạ không phải Adzuna)", r1.adzuna.status === "ok" && calls.length === 2 && (await db.externalJob.count()) === 7 && !a7, JSON.stringify({ st: r1.adzuna.status, calls: calls.length, n: await db.externalJob.count() }));
ok("S3", "Lương DỰ ĐOÁN của Adzuna không lưu; lương thật của nhà tuyển dụng thì lưu (USD / năm)", a2?.salaryMin === null && a2?.salaryMax === null && a2?.salaryCurrency === null && a1?.salaryMin === 40000 && a1?.salaryMax === 50000 && a1?.salaryCurrency === "USD" && a1?.salaryPeriod === "YEAR", JSON.stringify([a2?.salaryMin, a1?.salaryMin, a1?.salaryCurrency]));
ok("S4", "'Roofing Nailer' bị ẩn not_nail (vẫn giữ dòng để lượt sau không coi là tin mới)", a3?.hiddenReason === "not_nail", String(a3?.hiddenReason));
ok("S5", "Tin TIỆM TỰ ĐĂNG trên PawNail thắng: Adzuna 'Lucky Nails' Houston TX bị ẩn dup_salon_post", a1?.hiddenReason === "dup_salon_post", String(a1?.hiddenReason));
ok("S6", "Đoạn trích có SĐT → bỏ hẳn đoạn trích; HTML trong tiêu đề / đoạn trích bị bỏ", a4?.snippet === null && a6?.title === "Nail Artist" && a6?.snippet === "Gel-X & design." && a1?.snippet === "Busy salon hiring a nail tech.", JSON.stringify([a4?.snippet, a6?.title, a6?.snippet]));
ok("S7", "Trùng trong Adzuna (cùng tiêu đề + công ty + thành phố, cách ≤ 14 ngày) → giữ tin mới nhất, ẩn tin cũ", a4?.hiddenReason === null && a5?.hiddenReason === "dup_provider", JSON.stringify([a4?.hiddenReason, a5?.hiddenReason]));
ok("S8", "Bang / thành phố từ location.area (Texas → TX, Dallas; New South Wales → NSW, Blacktown); link Adzuna giữ nguyên", a2?.state === "TX" && a2?.city === "Dallas" && b1?.state === "NSW" && b1?.city === "Blacktown" && b1?.salaryCurrency === "AUD" && a1?.redirectUrl === "https://www.adzuna.com/land/ad/a1?se=x&v=y", JSON.stringify([a2?.state, a2?.city, b1?.state, b1?.city]));
ok("S9", "Hạn = min(ngày đăng + 30 ngày, lần cuối thấy + 60 giờ)", a6!.expiresAt.getTime() === T0.getTime() + 60 * H && a5!.expiresAt.getTime() === T0.getTime() + 60 * H, a6?.expiresAt.toISOString());

const usList = await listExternalJobs({ db, market: "US", now: T0 });
const auList = await listExternalJobs({ db, market: "AU", now: T0 });
ok("S10", "API đọc chỉ trả tin hiện được (US: a2, a4, a6 — mới nhất trước); ghi nguồn đúng quốc gia (adzuna.com / adzuna.com.au) trên TỪNG tin", usList.total === 3 && usList.items.map((i) => i.title).join("|") === "Nail Artist|Manicurist|Nail Tech" && usList.items.every((i) => i.attribution.href === "https://www.adzuna.com" && i.attribution.label === "Jobs by Adzuna") && auList.total === 1 && auList.items[0].attribution.href === "https://www.adzuna.com.au", JSON.stringify([usList.total, usList.items.map((i) => i.title), auList.items[0]?.attribution]));
ok("S11", "Tin công khai không có trường SĐT / email / mô tả đầy đủ", usList.items.every((i) => !("phone" in i) && !("email" in i) && !("description" in i)));
ok("S12", "Bảng Job (tin PawNail, X-Total-Count của /api/jobs) KHÔNG đổi vì tin đối tác; /api/jobs không đọc bảng ExternalJob", (await db.job.count()) === jobsBefore && !/externalJob/i.test(fs.readFileSync("app/api/jobs/route.ts", "utf8")));
const sum1 = (await db.appSetting.findUnique({ where: { key: SUMMARY_KEY } }))?.value || "";
ok("S13", "KHÔNG lộ app_key: không có trong log, trong tóm tắt admin, trong kết quả trả về (dù URL gọi Adzuna có khoá)", calls.every((u) => u.includes(SECRET)) && !logs.some((l) => l.includes(SECRET)) && !sum1.includes(SECRET) && !JSON.stringify(r1).includes(SECRET) && /"active":\{"US":3,"AU":1\}/.test(sum1), sum1.slice(0, 200));

// ---- Tin vắng 2 lượt liên tiếp → hết hạn; hết hạn quá 7 ngày → xoá ----
usNow = US_ALL.filter((r) => r.id !== "a2");
await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: new Date(T0.getTime() + 25 * H) });
await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: new Date(T0.getTime() + 50 * H) });
const at61 = await listExternalJobs({ db, market: "US", now: new Date(T0.getTime() + 61 * H) });
ok("S14", "Tin Adzuna không còn trả về 2 lượt liên tiếp → tự hết hạn (a2 biến mất, tin còn thấy vẫn hiện)", !at61.items.some((i) => i.title === "Nail Tech") && at61.items.some((i) => i.title === "Nail Artist"), JSON.stringify(at61.items.map((i) => i.title)));
await db.job.update({ where: { id: selfPost.id }, data: { expiresAt: new Date(Date.now() - H) } }); // activeJobWhere dùng giờ thật
await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: new Date(T0.getTime() + 62 * H) });
ok("S15", "Tin tiệm tự đăng hết hạn → bản Adzuna trùng được hiện lại (kiểm lại mỗi lượt)", (await row("a1"))?.hiddenReason === null, String((await row("a1"))?.hiddenReason));
await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: new Date(T0.getTime() + 60 * H + 7 * 86400_000 + H) });
ok("S16", "Tin hết hạn quá 7 ngày → xoá hẳn (không lưu trữ dữ liệu đối tác)", !(await row("a2")) && !!(await row("a6")));

// ---- Khoá bị từ chối → cảnh báo admin ----
const deny = async () => new Response("{}", { status: 401 });
const r401 = await runExternalJobsSync({ db, fetchImpl: deny, now: new Date(T0.getTime() + 9 * 86400_000) });
ok("S17", "Adzuna trả 401 → dừng ngay (1 lượt gọi), cảnh báo auth_error cho admin", r401.adzuna.status === "auth_error" && r401.adzuna.calls === 1 && r401.adzuna.alert === "auth_error", JSON.stringify(r401.adzuna).slice(0, 200));

// ---- Tắt công tắc → xoá sạch ----
process.env.EXTERNAL_JOBS_ADZUNA = "off";
const purged = await runExternalJobsSync({ db, fetchImpl: fakeFetch, now: new Date(T0.getTime() + 9 * 86400_000) });
ok("S18", "Tắt EXTERNAL_JOBS_ADZUNA → cron xoá toàn bộ tin Adzuna đã lưu", purged.adzuna.status === "purged" && (await db.externalJob.count()) === 0, JSON.stringify(purged.adzuna));

// ---- Careerjet: tìm trực tiếp, không lưu ----
const cj = normalizeCareerjet({ title: "Nail Technician", company: "Sunny Nails", locations: "Houston, TX", salary_min: 18, salary_max: 25, salary_type: "H", salary_currency_code: "USD", date: "2026-11-05", description: "Email jobs@sunny.example for info", url: "https://jobviewtrack.com/en-us/job-abc" }, "US", T0);
ok("C1", "Careerjet: 'Houston, TX' → TX / Houston; lương theo giờ; đoạn trích có email → bỏ", cj?.state === "TX" && cj?.city === "Houston" && cj?.salaryPeriod === "HOUR" && cj?.snippet === null && cj?.provider === "careerjet", JSON.stringify(cj));
let seen: { url: string; auth: string } | null = null;
process.env.CAREERJET_API_KEY = "cj-test-key";
const cjFetch = async (u: string, init?: RequestInit) => {
  seen = { url: u, auth: String((init?.headers as Record<string, string>)?.Authorization || "") };
  return new Response(JSON.stringify({ hits: 2, jobs: [
    { title: "Nail Tech", company: "Glow Nails", locations: "Sydney NSW", url: "https://jobviewtrack.com/en-au/job-1", date: "2026-11-05", description: "Acrylic" },
    { title: "Roofer / Nailer", company: "Roof Co", locations: "Sydney NSW", url: "https://jobviewtrack.com/en-au/job-2", date: "2026-11-05" },
  ] }), { status: 200 });
};
const live = await searchCareerjet({ market: "AU", state: "NSW", userIp: "203.0.113.9", userAgent: "QA-Agent/1.0", fetchImpl: cjFetch, now: T0 });
const sUrl = new URL((seen as { url: string } | null)?.url || "https://x");
ok("C2", "Careerjet: gửi IP + trình duyệt của người xem, locale en_AU, Basic auth bằng API key; bỏ tin không phải nail; không ghi DB",
  live.status === "ok" && live.jobs.length === 1 && live.jobs[0].state === "NSW" && sUrl.searchParams.get("user_ip") === "203.0.113.9" && sUrl.searchParams.get("user_agent") === "QA-Agent/1.0" && sUrl.searchParams.get("locale_code") === "en_AU" && (seen as { auth: string } | null)?.auth === `Basic ${Buffer.from("cj-test-key:").toString("base64")}` && (await db.externalJob.count()) === 0,
  JSON.stringify({ st: live.status, n: live.jobs.length, q: sUrl.search }));
delete process.env.CAREERJET_API_KEY;
ok("C3", "Careerjet thiếu khoá → disabled, không gọi mạng", (await searchCareerjet({ market: "US", userIp: "1.1.1.1", userAgent: "x", fetchImpl: async () => { throw new Error("no"); } })).status === "disabled");

const raw = normalizeAdzuna({ id: "z1", title: "Nail Tech", redirect_url: "http://www.adzuna.com/land/ad/z1", created: "2026-11-01" }, "US", T0);
ok("C4", "Adzuna: chỉ nhận link https về đúng tên miền Adzuna", raw === null);

await db.$disconnect();
try { fs.rmSync(dbFile, { force: true }); fs.rmSync(dbFile + "-journal", { force: true }); } catch {}
console.log(`\nTin việc đối tác: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
