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
// lib/prisma dùng globalThis.prisma nếu đã có → mọi hàm dùng Prisma mặc định (ingest, activeJobWhere…) chạy trên DB TẠM này
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;

const { normalizeAdzuna, normalizeCareerjet, isNailJob, companyMatch, hasContactInfo, stripHtml, stateCode, dropContacts } = await import("../../lib/jobFeeds/normalize");
const { runExternalJobsSync, listExternalJobs, upsertExternalJobs, toPublic, SUMMARY_KEY } = await import("../../lib/jobFeeds/sync");
const { searchCareerjet } = await import("../../lib/jobFeeds/careerjet");
const cfg = await import("../../lib/jobFeeds/config");

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

// ================= Vòng sửa 2 (review 11/2026) =================
// ---- Giấy phép: khoá dùng thử KHÔNG BAO GIỜ đủ để hiện công khai ----
for (const k of ["EXTERNAL_JOBS_ADZUNA", "ADZUNA_LICENSE_REF", "EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY", "CAREERJET_TERMS_CONFIRMED"]) delete process.env[k];
process.env.EXTERNAL_JOBS_ADZUNA = "on"; process.env.ADZUNA_APP_ID = "qa-app-id"; process.env.ADZUNA_APP_KEY = SECRET;
const trialOnly = cfg.adzunaEnabled() && !cfg.adzunaPublic();
process.env.ADZUNA_LICENSE_REF = "off";
const offRef = cfg.adzunaPublic();
process.env.ADZUNA_LICENSE_REF = "ADZ-2026-117 / 2026-11-20";
const licensed = cfg.adzunaPublic();
process.env.EXTERNAL_JOBS_CAREERJET = "on"; process.env.CAREERJET_API_KEY = "cj-test-key";
const cjNoTerms = cfg.careerjetEnabled();
process.env.CAREERJET_TERMS_CONFIRMED = "email 2026-11-21";
const cjTerms = cfg.careerjetEnabled();
ok("L1", "Adzuna bật + khoá mà CHƯA có ADZUNA_LICENSE_REF → cron được lấy (admin kiểm tra) nhưng KHÔNG hiện công khai; 'off' không tính là mã giấy phép; Careerjet cần CAREERJET_TERMS_CONFIRMED",
  trialOnly && !offRef && licensed && !cjNoTerms && cjTerms, JSON.stringify({ trialOnly, offRef, licensed, cjNoTerms, cjTerms }));
for (const k of ["EXTERNAL_JOBS_CAREERJET", "CAREERJET_API_KEY", "CAREERJET_TERMS_CONFIRMED", "ADZUNA_LICENSE_REF"]) delete process.env[k];

// ---- Không bịa độ mới ----
const noDate = normalizeAdzuna({ id: "nd1", title: "Nail Technician", redirect_url: "https://www.adzuna.com/land/ad/nd1" }, "US", T0);
const badDate = normalizeAdzuna({ id: "nd2", title: "Nail Technician", redirect_url: "https://www.adzuna.com/land/ad/nd2", created: "not a date" }, "US", T0);
const futureDate = normalizeAdzuna({ id: "nd3", title: "Nail Technician", redirect_url: "https://www.adzuna.com/land/ad/nd3", created: "2027-01-01T00:00:00Z" }, "US", T0);
const cjUndated = normalizeCareerjet({ title: "Nail Technician", company: "Glow", locations: "Houston, TX", url: "https://jobviewtrack.com/en-us/job-nd" }, "US", T0);
const cjPub = cjUndated ? toPublic({ ...cjUndated, id: "cj_x" }, "US") : null;
ok("D1", "Thiếu / sai / tương lai ngày đăng: Adzuna → BỎ tin; Careerjet → providerCreatedAt null, postedAt null (không bao giờ = 'bây giờ')",
  noDate === null && badDate === null && futureDate === null && cjUndated?.providerCreatedAt === null && cjPub?.postedAt === null, JSON.stringify({ noDate, badDate, futureDate, cj: cjUndated?.providerCreatedAt, pub: cjPub?.postedAt }));

// ---- Link về đúng tên miền, chỉ https ----
const hostCases = [
  normalizeAdzuna({ id: "h1", title: "Nail Tech", created: "2026-11-01", redirect_url: "https://adzuna.attacker.com/land/ad/h1" }, "US", T0),
  normalizeAdzuna({ id: "h2", title: "Nail Tech", created: "2026-11-01", redirect_url: "https://evil-adzuna.com/land/ad/h2" }, "US", T0),
  normalizeAdzuna({ id: "h3", title: "Nail Tech", created: "2026-11-01", redirect_url: "https://www.adzuna.com.evil.io/x" }, "US", T0),
  normalizeCareerjet({ title: "Nail Tech", url: "https://evil.example/phish", date: "2026-11-01" }, "US", T0),
  normalizeCareerjet({ title: "Nail Tech", url: "http://jobviewtrack.com/en-us/job-1", date: "2026-11-01" }, "US", T0),
];
const hostOk = [
  normalizeAdzuna({ id: "h4", title: "Nail Tech", created: "2026-11-01", redirect_url: "https://www.adzuna.com.au/land/ad/h4" }, "AU", T0),
  normalizeCareerjet({ title: "Nail Tech", url: "https://www.careerjet.com.au/jobad/x", date: "2026-11-01" }, "AU", T0),
];
ok("H1", "Chặn adzuna.attacker.com / evil-adzuna.com / adzuna.com.evil.io / evil.example / http://; nhận adzuna.com.au + careerjet.com.au https", hostCases.every((x) => x === null) && hostOk.every((x) => !!x), JSON.stringify(hostCases.map((x) => !!x)));

// ---- Lọc SĐT / email (lỗ cũ) + dọn đuôi tiêu đề ----
const leaks = ["+61 (0)412 345 678", "call 1300 123 456", "ring 1800-555-019", "ph 13 12 34", "name[at]domain.com", "jobs (at) glow (dot) com"];
const clean = ["$45,000 - 55,000 per year", "$130,000 package", "13 years experience", "Level 13, 1300 sq ft"];
ok("P1", "Bắt '+61 (0)4xx', 1300/1800/13xx, email '[at]'/'(at)'; không bắt nhầm lương / số năm / diện tích; 'Nail Tech - call 0412 555 019' → 'Nail Tech'",
  leaks.every(hasContactInfo) && !clean.some(hasContactInfo) && dropContacts("Nail Tech - call 0412 555 019") === "Nail Tech" && dropContacts("Nail Tech (call 0412 555 019)") === "Nail Tech" && dropContacts("Gel-X Artist") === "Gel-X Artist",
  JSON.stringify({ leaks: leaks.map(hasContactInfo), clean: clean.map(hasContactInfo), t: dropContacts("Nail Tech (call 0412 555 019)") }));

// ---- Làm mới nội dung mỗi lần thấy + không lưu toạ độ + chạy chồng (P2002) ----
process.env.EXTERNAL_JOBS_ADZUNA = "on";
const T1 = new Date("2026-11-20T06:30:00Z");
const base = { salary_is_predicted: "0", latitude: 29.7, longitude: -95.3, location: { display_name: "Houston, Texas", area: ["US", "Texas", "Harris County", "Houston"] }, created: "2026-11-19T10:00:00Z" };
const v1 = normalizeAdzuna({ ...base, id: "r1", title: "Nail Technician", company: { display_name: "Refresh Nails" }, salary_min: 30000, salary_max: 35000, redirect_url: "https://www.adzuna.com/land/ad/r1?v=1", description: "Old text." }, "US", T1)!;
const v2 = normalizeAdzuna({ ...base, id: "r1", title: "Senior Nail Technician", company: { display_name: "Refresh Nails" }, salary_min: 42000, salary_max: 48000, redirect_url: "https://www.adzuna.com/land/ad/r1?v=2", description: "Now call 713-555-0101.", created: "2026-11-20T01:00:00Z" }, "US", T1)!;
await upsertExternalJobs(db, [v1], T1);
const u2 = await upsertExternalJobs(db, [v2], new Date(T1.getTime() + 24 * H));
const rr1 = await row("r1");
ok("R1", "Tin đã có: lương / tiêu đề / link / đoạn trích đổi → cập nhật ngay (đoạn trích mới có SĐT → bỏ); ngày đăng gốc giữ nguyên; không lưu lat/lng",
  u2.refreshed === 1 && rr1?.salaryMin === 42000 && rr1?.title === "Senior Nail Technician" && rr1?.redirectUrl.endsWith("v=2") && rr1?.snippet === null && rr1?.providerCreatedAt.toISOString() === "2026-11-19T10:00:00.000Z" && rr1?.lat === null && rr1?.lng === null,
  JSON.stringify({ refreshed: u2.refreshed, s: rr1?.salaryMin, t: rr1?.title, sn: rr1?.snippet, lat: rr1?.lat }));
const dupItems = ["o1", "o2", "o3"].map((id) => normalizeAdzuna({ ...base, id, title: "Nail Technician", company: { display_name: `Overlap ${id}` }, redirect_url: `https://www.adzuna.com/land/ad/${id}` }, "US", T1)!);
const both = await Promise.allSettled([upsertExternalJobs(db, dupItems, T1), upsertExternalJobs(db, dupItems, T1)]);
ok("O1", "2 lượt cron chạy chồng cùng tin mới → không lỗi P2002 / 500; mỗi tin đúng 1 dòng", both.every((b) => b.status === "fulfilled") && (await db.externalJob.count({ where: { providerJobId: { in: ["o1", "o2", "o3"] } } })) === 3, JSON.stringify(both.map((b) => b.status === "rejected" ? String((b.reason as Error)?.message).slice(0, 120) : "ok")));

// ---- Tin của tiệm trên PawNail thắng bản Adzuna trùng: tin từ nhóm cộng đồng ('ingest', có SĐT) và đăng hộ ('assisted') ----
const ingestOwner = await db.user.create({ data: { email: `ext.ingest.${Date.now()}@qa.test`, name: "QA Feed", password: "x", role: "OWNER", market: "US", state: "TX" } });
await db.job.create({ data: { title: "Cần thợ", salonName: "Ingest Only Nails", description: "x", ownerId: ingestOwner.id, market: "US", state: "TX", city: "Houston", salaryType: "x", salaryAmount: "x", skills: "", benefits: "", phone: "(713) 555-0111", source: "ingest", sourceUrl: "https://www.facebook.com/groups/1/posts/2", sourcePostedAt: T1, expiresAt: new Date(Date.now() + 5 * 86400_000) } });
await db.job.create({ data: { title: "Cần thợ", salonName: "Assisted Glam Nails", description: "x", ownerId: ingestOwner.id, market: "US", state: "TX", city: "Houston", salaryType: "x", salaryAmount: "x", skills: "", benefits: "", phone: "(713) 555-0112", source: "assisted", sourcePostedAt: T1, expiresAt: new Date(Date.now() + 5 * 86400_000) } });
const ingestMatch = normalizeAdzuna({ ...base, id: "i1", title: "Nail Technician", company: { display_name: "Ingest Only Nails" }, redirect_url: "https://www.adzuna.com/land/ad/i1" }, "US", T1)!;
const assistMatch = normalizeAdzuna({ ...base, id: "i2", title: "Nail Technician", company: { display_name: "Assisted Glam Nails LLC" }, redirect_url: "https://www.adzuna.com/land/ad/i2" }, "US", T1)!;
await upsertExternalJobs(db, [ingestMatch, assistMatch], T1);
const { reconcileExternalJobs } = await import("../../lib/jobFeeds/sync");
await reconcileExternalJobs(db, "adzuna", T1);
ok("I1", "Adzuna trùng tin TỪ NHÓM cộng đồng PawNail (có SĐT + Gọi ngay) → ẩn dup_job; trùng tin ĐĂNG HỘ theo yêu cầu → ẩn dup_job", (await row("i1"))?.hiddenReason === "dup_job" && (await row("i2"))?.hiddenReason === "dup_job", JSON.stringify([(await row("i1"))?.hiddenReason, (await row("i2"))?.hiddenReason]));

// ---- Ngân sách thời gian: fetch chậm không làm cron quá 60 s; đối chiếu + tóm tắt luôn chạy ----
await db.appSetting.deleteMany({ where: { key: SUMMARY_KEY } });
let slowCalls = 0;
const slowFetch = (_u: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
  slowCalls++;
  const t = setTimeout(() => resolve(new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 })), 20_000);
  init?.signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); });
});
const t0 = Date.now();
const slow = await runExternalJobsSync({ db, fetchImpl: slowFetch, now: T1, deadline: t0 + 2_500, workDeadline: t0 + 3_500 });
const took = Date.now() - t0;
const sumSlow = (await db.appSetting.findUnique({ where: { key: SUMMARY_KEY } }))?.value || "";
ok("T1", "Fetch treo: lượt gọi bị cắt đúng hạn (timeout = thời gian còn lại), không gọi thị trường sau, status 'deadline', đối chiếu + tóm tắt admin vẫn ghi, tổng < 5 s",
  slow.adzuna.status === "deadline" && slowCalls === 1 && took < 5_000 && /"status":"deadline"/.test(sumSlow) && !!slow.adzuna.active, JSON.stringify({ st: slow.adzuna.status, slowCalls, took }));
delete process.env.EXTERNAL_JOBS_ADZUNA;

// ---- Tin tự đăng: hạn 30 ngày tính từ max(ngày đăng, ngày áp dụng) — không ẩn đột ngột lúc triển khai ----
const ing = await import("../../lib/jobIngest/ingest");
const disp = await import("../../lib/jobIngest/display");
const legacy = await db.job.create({ data: { title: "Cần thợ (QA legacy)", salonName: "Legacy QA Nails", description: "", ownerId: owner.id, market: "US", state: "NY", city: "Queens", salaryType: "x", salaryAmount: "x", skills: "", benefits: "", phone: "(718) 555-0100", createdAt: new Date("2026-10-15T12:00:00Z") } });
const visibleAt = async (d: string) => !!(await db.job.findFirst({ where: { AND: [{ id: legacy.id }, ing.activeJobWhere(new Date(d))] }, select: { id: true } }));
const eff = ing.effectiveExpiry(legacy)?.toISOString();
ok("E1", "Tin tự đăng cũ (15/10, chưa có hạn): vẫn hiện 14/11 và 06/12, ẩn từ 07/12 (= ngày áp dụng 07/11 + 30); effectiveExpiry khớp",
  (await visibleAt("2026-11-14T12:00:00Z")) && (await visibleAt("2026-12-06T12:00:00Z")) && !(await visibleAt("2026-12-07T00:00:01Z")) && eff === "2026-12-07T00:00:00.000Z", String(eff));
const newer = await db.job.create({ data: { title: "Cần thợ (QA newer)", salonName: "Newer QA Nails", description: "", ownerId: owner.id, market: "US", state: "NY", city: "Queens", salaryType: "x", salaryAmount: "x", skills: "", benefits: "", phone: "(718) 555-0101", createdAt: new Date("2026-11-20T00:00:00Z") } });
ok("E2", "Tin tự đăng không có hạn đăng sau ngày áp dụng → hạn = ngày đăng + 30", ing.effectiveExpiry(newer)?.toISOString() === "2026-12-20T00:00:00.000Z" && ing.effectiveExpiry({ expiresAt: null, createdAt: new Date(), source: "ingest" }) === null);

// ---- Gỡ tin: xoá dữ liệu công khai, đánh dấu removed ----
const toRemove = await db.job.create({ data: { title: "Cần thợ bột", salonName: "Takedown QA Nails", description: "Gọi 832-555-0199 gặp Linda", ownerId: ingestOwner.id, market: "US", state: "TX", city: "Katy", salaryType: "x", salaryAmount: "$1,200/tuần", skills: "Bột", benefits: "", phone: "(832) 555-0199", address: "1 Main St, Katy TX", zip: "77449", source: "ingest", sourceUrl: "https://www.facebook.com/groups/1/posts/9", sourceKey: "k", sourceFbHash: "h", expiresAt: new Date(Date.now() + 5 * 86400_000) } });
await ing.removeJobPublicData(toRemove.id, db);
const gone = await db.job.findUnique({ where: { id: toRemove.id } });
ok("K1", "Gỡ tin: SĐT / mô tả / địa chỉ / ZIP / link bài gốc / tên tiệm bị xoá, source = removed, hết hạn ngay, không còn trong activeJobWhere",
  !!gone && ing.isRemovedJob(gone) && gone.phone === "" && gone.description === "" && gone.address === null && gone.zip === null && gone.sourceUrl === null && gone.salonName === "" && gone.sourceFbHash === null && !(await db.job.findFirst({ where: { AND: [{ id: toRemove.id }, ing.activeJobWhere()] } })),
  JSON.stringify(gone));

// ---- Quyết định của chủ (06/11/2026): tin TỪ NHÓM cộng đồng PawNail giữ SĐT + mô tả đầy đủ; có link → "Xem bài gốc";
//      KHÔNG có link vẫn hiện ----
const FULL = "Cần thợ bột gấp\nLH: 713-555-0111 hoặc text 7135550112\nemail glow[at]mail.com";
const ingPub = disp.publicJob({ source: "ingest", sourceUrl: "https://m.facebook.com/groups/1/posts/3/?__cft__[0]=AZWsecret&__tn__=%2CO%2CP-R&mibextid=abc#c", sourceKey: "k", sourceFbHash: "h", phone: "(713) 555-0111", salonName: "Ingest Only Nails", city: "Houston", state: "TX", salaryAmount: "$1,200/tuần", description: FULL, market: "US" });
const selfPub = disp.publicJob({ source: null, sourceUrl: null, sourceKey: null, sourceFbHash: null, phone: "(718) 555-0100", salonName: "Self Nails", city: "Queens", state: "NY", salaryAmount: "$1,000", description: "Call 718-555-0100", market: "US" });
const permalink = disp.sourceLinkOf("https://www.facebook.com/permalink.php?story_fbid=123&id=456&__cft__[0]=x&ref=share");
const noLink = await db.job.create({ data: { title: "Cần thợ", salonName: "No Link Nails", description: "x", ownerId: ingestOwner.id, market: "US", state: "TX", city: "Houston", salaryType: "x", salaryAmount: "x", skills: "", benefits: "", phone: "(713) 555-0113", source: "ingest", sourcePostedAt: T1, expiresAt: new Date(Date.now() + 5 * 86400_000) } });
const noLinkPub = disp.publicJob(noLink);
ok("G1", "Tin từ nhóm: GIỮ SĐT tiệm + mô tả đầy đủ (kể cả SĐT trong bài); nguồn 'Facebook' + link https đã bỏ mã theo dõi (__cft__, __tn__, mibextid, #); không lộ sourceKey / sourceUrl; tin tự đăng giữ nguyên",
  ingPub.phone === "(713) 555-0111" && ingPub.description === FULL && ingPub.sourceLink?.name === "Facebook" && ingPub.sourceLink.href === "https://m.facebook.com/groups/1/posts/3/" && !("sourceKey" in ingPub) && !("sourceUrl" in ingPub) && !("sourceFbHash" in ingPub)
    && permalink?.href === "https://www.facebook.com/permalink.php?story_fbid=123&id=456"
    && selfPub.phone === "(718) 555-0100" && selfPub.description === "Call 718-555-0100" && selfPub.sourceLink === null,
  JSON.stringify({ ingPub, permalink, selfPhone: selfPub.phone }));
const badLinks = ["http://www.facebook.com/groups/1/posts/4", "javascript:alert(1)", "https://user:pw@facebook.com/groups/1", "ftp://x.com/a", "not a url", ""].map((u) => disp.sourceLinkOf(u));
ok("G2", "Tin từ nhóm KHÔNG có link bài gốc → vẫn nằm trong activeJobWhere (vẫn hiện), sourceLink null, SĐT còn; link http / javascript: / có user:pass / rác → không thành link",
  !!(await db.job.findFirst({ where: { AND: [{ id: noLink.id }, ing.activeJobWhere()] } })) && noLinkPub.sourceLink === null && noLinkPub.phone === "(713) 555-0113" && badLinks.every((x) => x === null),
  JSON.stringify({ noLinkPub: { link: noLinkPub.sourceLink, phone: noLinkPub.phone }, badLinks }));

// ---- Nhận tin từ nhóm: MẶC ĐỊNH NHẬN (biến không đặt); INGEST_AGGREGATED=off = công tắc khẩn cấp; tin đăng hộ không bị ghi đè ----
delete process.env.INGEST_AGGREGATED;
const unsetOn = ing.aggregatedIngestOn();
const onRes = await ing.ingestOne({ text: "Tiệm cần thợ bột gấp, lương cao. LH 281-555-0144", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/10" }, new Set());
const onRow = onRes.jobId ? await db.job.findUnique({ where: { id: onRes.jobId } }) : null;
const switchVals: Record<string, boolean> = {};
for (const v of ["off", "OFF", " off ", "on", "", "0", "false", "yes"]) { process.env.INGEST_AGGREGATED = v; switchVals[`[${v}]`] = ing.aggregatedIngestOn(); }
process.env.INGEST_AGGREGATED = "off";
const offRes = await ing.ingestOne({ text: "Tiệm cần thợ chân tay nước gấp. LH 281-555-0146", state: "TX", market: "US" }, new Set());
const assistedRes = await ing.ingestOne({ text: "Tiệm cần thợ bột gấp ở Houston TX, bao lương $1,200/tuần. LH 281-555-0145", salonName: "Requested QA Nails", state: "TX", market: "US" }, new Set(), { assisted: true });
delete process.env.INGEST_AGGREGATED;
const overwrite = await ing.ingestOne({ text: "Cần thợ chân tay nước, tip cao. LH 281-555-0145", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/11" }, new Set());
const kept = assistedRes.jobId ? await db.job.findUnique({ where: { id: assistedRes.jobId } }) : null;
ok("A1", "INGEST_AGGREGATED KHÔNG đặt → bài từ nhóm được NHẬN (created, source ingest, giữ SĐT + nội dung)",
  unsetOn && onRes.status === "created" && onRow?.source === "ingest" && onRow?.phone === "(281) 555-0144" && /lương cao/.test(onRow?.description || ""),
  JSON.stringify({ unsetOn, onRes, phone: onRow?.phone }));
ok("A2", "Chỉ đúng 'off' (không phân biệt hoa thường / khoảng trắng) mới tắt; 'on' / rỗng / '0' / 'false' / 'yes' → vẫn nhận",
  switchVals["[off]"] === false && switchVals["[OFF]"] === false && switchVals["[ off ]"] === false && ["[on]", "[]", "[0]", "[false]", "[yes]"].every((k) => switchVals[k] === true),
  JSON.stringify(switchVals));
ok("A3", "INGEST_AGGREGATED=off → bài từ nhóm bị bỏ (công tắc khẩn cấp) nhưng ĐĂNG HỘ vẫn đăng được; bài từ nhóm cùng SĐT KHÔNG ghi đè / đổi nhãn tin đăng hộ",
  offRes.status === "skipped" && /INGEST_AGGREGATED=off/.test(offRes.reason || "") && assistedRes.status === "created" && overwrite.status === "skipped" && kept?.source === "assisted" && /bao lương/.test(kept?.description || ""),
  JSON.stringify({ offRes, assistedRes, overwrite, src: kept?.source }));

// ---- Tin đăng hộ chỉ được "giữ chỗ" khi CÒN HẠN: hết hạn rồi thì bài mới từ nhóm của tiệm lại lên bảng như main ----
const onBoard = async (phone: string) => db.job.count({ where: { AND: [{ phone }, ing.activeJobWhere()] } });
const DAYMS = 86400_000;
// (a) admin đăng hộ → hết hạn → bot gửi bài mới cùng SĐT
const asg = await ing.ingestOne({ text: "Tiệm cần thợ bột gấp ở Katy TX, bao lương $1,300/tuần. LH 281-555-0147", salonName: "Expired Assist Nails", state: "TX", market: "US" }, new Set(), { assisted: true });
await db.job.update({ where: { id: asg.jobId! }, data: { expiresAt: new Date(Date.now() - DAYMS) } });
const dryAfter = await ing.ingestOne({ text: "Cần thợ chân tay nước gấp, tip cao. LH 281-555-0147", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/12" }, new Set(), { dryRun: true });
const grpAfter = await ing.ingestOne({ text: "Cần thợ chân tay nước gấp, tip cao. LH 281-555-0147", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/12" }, new Set());
const grpRow = grpAfter.jobId ? await db.job.findUnique({ where: { id: grpAfter.jobId } }) : null;
const oldAsg = await db.job.findUnique({ where: { id: asg.jobId! } });
ok("A4", "Tin ĐĂNG HỘ đã HẾT HẠN không chặn bot: bài mới từ nhóm cùng SĐT được nhận (xem trước + thật = created, source ingest, giữ SĐT, hiện trên bảng); tin đăng hộ cũ giữ nguyên làm lịch sử",
  asg.status === "created" && dryAfter.status === "created" && grpAfter.status === "created" && grpRow?.source === "ingest" && grpRow?.phone === "(281) 555-0147" && /tip cao/.test(grpRow?.description || "")
    && (await onBoard("(281) 555-0147")) === 1 && oldAsg?.source === "assisted" && /bao lương/.test(oldAsg?.description || ""),
  JSON.stringify({ asg, dryAfter, grpAfter, grpSrc: grpRow?.source, oldSrc: oldAsg?.source, board: await onBoard("(281) 555-0147") }));
// (b) chiều ngược: bot đăng tiệm → admin đăng hộ cùng SĐT (đẩy tin, đổi nhãn "assisted") → còn hạn: bot nhường (tiệm vẫn
//     hiện qua tin đăng hộ); hết hạn: bài sau của bot lại lên bảng (trước đây khoá mãi mãi)
const grpFirst = await ing.ingestOne({ text: "Tiệm cần thợ bột gấp, lương cao. LH 832-555-0148", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/13" }, new Set());
const asgBump = await ing.ingestOne({ text: "Tiệm cần thợ bột + chân tay nước, bao lương $1,400/tuần. LH 832-555-0148", salonName: "Relabel QA Nails", state: "TX", market: "US" }, new Set(), { assisted: true });
const relabeled = await db.job.findUnique({ where: { id: grpFirst.jobId! } });
const whileActive = await ing.ingestOne({ text: "Cần thợ dip gấp, bao ăn ở. LH 832-555-0148", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/14" }, new Set());
const boardActive = await onBoard("(832) 555-0148");
await db.job.update({ where: { id: grpFirst.jobId! }, data: { expiresAt: new Date(Date.now() - DAYMS) } });
const afterExpiry = await ing.ingestOne({ text: "Cần thợ dip gấp, bao ăn ở. LH 832-555-0148", state: "TX", market: "US", sourceUrl: "https://www.facebook.com/groups/1/posts/14" }, new Set());
const boardAfter = await onBoard("(832) 555-0148");
ok("A5", "Bot đăng → admin đăng hộ cùng tiệm (đổi nhãn assisted) → còn hạn: bài từ nhóm nhường, tiệm VẪN hiện 1 tin; hết hạn: bài mới từ nhóm được nhận lại (created, hiện trên bảng)",
  grpFirst.status === "created" && asgBump.status === "bumped" && asgBump.jobId === grpFirst.jobId && relabeled?.source === "assisted" && whileActive.status === "skipped" && /còn hạn/.test(whileActive.reason || "") && boardActive === 1
    && afterExpiry.status === "created" && afterExpiry.jobId !== grpFirst.jobId && boardAfter === 1,
  JSON.stringify({ grpFirst, asgBump, relabeled: relabeled?.source, whileActive, boardActive, afterExpiry, boardAfter }));

// ---- Nhịp tim NGAY SAU TRIỂN KHAI: chưa có ingest_last_at (bản cũ không ghi) → không báo động giả ----
const tDeploy = Date.now();
const hbEst = await ing.ingestHeartbeat(new Date(tDeploy + 2 * H)); // tin từ nhóm mới nhất trong DB vừa tạo
const hbGrace = await ing.ingestHeartbeat(new Date(tDeploy + 25 * H)); // tin trong DB đã cũ nhưng mới bắt đầu theo dõi
const hbWatched = await ing.ingestHeartbeat(new Date(tDeploy + 50 * H)); // đã theo dõi đủ 24 giờ mà không có tin nào
ok("B0", "Chưa có ingest_last_at: lấy tin từ nhóm mới nhất trong DB làm 'lần cuối nhận' (ước tính) → không cảnh báo; tin trong DB cũ → chỉ cảnh báo sau khi đã theo dõi đủ 24 giờ",
  hbEst.stale === false && hbEst.lastAtEstimated === true && !!hbEst.lastAt && Math.abs(Date.parse(hbEst.lastAt) - tDeploy) < 10 * 60_000
    && hbGrace.stale === false && hbWatched.stale === true && hbWatched.rejectedOnly === false,
  JSON.stringify({ hbEst, hbGrace, hbWatched }));

// ---- Nhịp tim: lô đúng khoá ghi lại; quá 24 giờ không có tin mới → stale; bot gửi mà bị loại hết → rejectedOnly ----
const tNow = new Date();
await ing.recordIngestHeartbeat([{ status: "created" }], tNow);
const hbFresh = await ing.ingestHeartbeat(new Date(tNow.getTime() + 2 * H));
const hbOld = await ing.ingestHeartbeat(new Date(tNow.getTime() + 25 * H));
await ing.recordIngestHeartbeat([{ status: "skipped" }], new Date(tNow.getTime() + 3 * H));
const hbRejected = await ing.ingestHeartbeat(new Date(tNow.getTime() + 26 * H));
ok("B1", "Nhịp tim: vừa nhận → không cảnh báo; quá 24 giờ → stale (admin cảnh báo); lô sau đó toàn bài bị loại → rejectedOnly; accepting = true khi biến không đặt",
  hbFresh.stale === false && hbFresh.rejectedOnly === false && hbOld.stale === true && hbRejected.stale === true && hbRejected.rejectedOnly === true && hbFresh.accepting === true && hbFresh.lastAt === tNow.toISOString() && hbFresh.lastAtEstimated === false,
  JSON.stringify({ hbFresh, hbOld, hbRejected }));

await db.$disconnect();
try { fs.rmSync(dbFile, { force: true }); fs.rmSync(dbFile + "-journal", { force: true }); } catch {}
console.log(`\nTin việc đối tác: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
