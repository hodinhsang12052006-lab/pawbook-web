// SĐT đúng thị trường + bài ngoài Mỹ / Úc + file SQL ẩn 3 tin lỗi (soát production 07/11/2026) + điều hướng giữ /vi.
//   - parseMarketPhone: Mỹ NANP 10 số (mã vùng / đầu số không bắt đầu 0/1, không N11), Úc 04… / 02·03·07·08…
//   - hasCallableNumber (lúc hiển thị dữ liệu cũ): "+1 0901234567" → ẩn; số mẫu / số kèm ghi chú → giữ
//   - foreignMarketSignal + prepareIngest: 2 bài nhóm nail ở Anh có thật (Shenfield / Stratford DLR, 07…) bị bỏ có lý do,
//     kể cả khi tool gửi kèm market US + SĐT đã "chuẩn hoá" (cắt số 0); ô quốc gia "UK"; số Úc trong tin Mỹ
//   - /api/ingest/jobs + /api/jobs/sync (gọi thẳng hàm route trên SQLite TẠM): bài Anh bị bỏ, bài Mỹ cùng lô vẫn nhận
//   - publicJob: tin cũ đã lưu không còn hiện số / nút Gọi sai
//   - prisma/sql/2026-11-08_hide_bad_jobs(.sql|_restore.sql) trên SQLite TẠM: ẩn đúng 3 dòng, hoàn tác trả nguyên văn
//   - localeHref: /vi/* giữ /vi, trang EN không đổi
// Bài trong test: 2 bài Anh chép từ production nhưng SĐT đổi sang số HƯ CẤU (07475550142 → bot cắt 0 → (747) 555-0142);
// còn lại cũng HƯ CẤU (555-01xx).
//   TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx tsx scripts/qa/job_phone_market_unit.mts   (rỗng: @prisma/client không nạp .env production)
if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) throw new Error("Chỉ chạy trên SQLite local — env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN …");
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hasCallableNumber, marketPhoneError, parseMarketPhone } from "../../lib/phoneFormat";
import { findPhone, foreignMarketSignal, isForeignCountry } from "../../lib/jobIngest/parse";
import { publicJob } from "../../lib/jobIngest/display";
import { localeHref } from "../../lib/i18n/localeHref";

let pass = 0, fail = 0;
const ok = (id: string, d: string, c: boolean, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} [${id}] ${d}${c ? "" : "  → " + x}`); };

// DB tạm đúng schema — đặt globalThis.prisma TRƯỚC khi nạp lib/prisma (qua ingest / route) → không đụng prisma/dev.db
const dbFile = path.join(os.tmpdir(), `pawnail_badjobs_${Date.now()}.db`).replace(/\\/g, "/");
const url = `file:${dbFile}`;
execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
const db = new PrismaClient({ datasources: { db: { url } } });
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;
delete process.env.INGEST_AGGREGATED;
process.env.INGEST_KEY = "qa-ingest-key-0123456789abcdef";

// ---------- parseMarketPhone ----------
const P = (raw: string, m: string) => parseMarketPhone(raw, m)?.display ?? null;
ok("PH1", "Mỹ: (713) 555-0123 · 713.555.0123 · 7135550123 · +1 713 555 0123 · 1-713-555-0123 → (713) 555-0123, E.164 +17135550123",
  ["(713) 555-0123", "713.555.0123", "7135550123", "+1 713 555 0123", "1-713-555-0123"].every((r) => P(r, "US") === "(713) 555-0123") && parseMarketPhone("7135550123", "US")?.e164 === "+17135550123");
ok("PH2", "Mỹ: số Việt Nam \"+1 0901234567\" / \"0901234567\", số Anh 07475550142 / +447475550142, thiếu số 5550100, mã vùng 1xx / N11, đầu số 0xx/1xx, chữ → từ chối",
  ["+1 0901234567", "0901234567", "07475550142", "+447475550142", "5550100", "+1 555 0100", "(155) 555-0123", "(911) 555-0123", "(713) 055-0123", "(713) 155-0123", "(713) 911-0123", "713-555-0123 ext 2", "call me", "", "+61 412 345 678"].every((r) => P(r, "US") === null),
  JSON.stringify(["+1 0901234567", "07475550142", "(713) 911-0123"].map((r) => P(r, "US"))));
ok("PH3", "Úc: 0412 345 678 · +61 412 345 678 · +61 (0)412 345 678 · 61412345678 → 0412 345 678; (02) 9123 4567 · 0291234567 · +61 2 9123 4567 → (02) 9123 4567",
  ["0412 345 678", "+61 412 345 678", "+61 (0)412 345 678", "61412345678"].every((r) => P(r, "AU") === "0412 345 678") && ["(02) 9123 4567", "0291234567", "+61 2 9123 4567"].every((r) => P(r, "AU") === "(02) 9123 4567") && parseMarketPhone("0412 345 678", "AU")?.e164 === "+61412345678");
ok("PH4", "Úc: số Mỹ / số thiếu chữ số / đầu 05 / 01 / số Anh 11 chữ số → từ chối; thị trường lạ → từ chối",
  ["(713) 555-0123", "+1 713 555 0123", "041234567", "0512345678", "0112345678", "07475550142", "+44 7475 550142"].every((r) => P(r, "AU") === null) && P("0412 345 678", "VN") === null);
const eUS = marketPhoneError("US"), eAU = marketPhoneError("AU");
ok("PH5", "Lời nhắc rõ ràng EN + VI theo thị trường (form + API dùng chung)", /US phone number/.test(eUS.en) && /số Mỹ/.test(eUS.vi) && /\(713\) 555-0123/.test(eUS.en) && /Australian phone number/.test(eAU.en) && /số Úc/.test(eAU.vi) && /0412 345 678/.test(eAU.en));

// ---------- hasCallableNumber (lúc hiển thị) ----------
ok("CN1", "Gọi được: (713) 555-0123, \"713-555-0123 (chị Lan)\", số mẫu (555) 000-1000, +1 408 555 0100; Úc 0412 345 678, (02) 9123 4567, +61 2 5550 1234, 0410000001",
  hasCallableNumber("(713) 555-0123", "US") && hasCallableNumber("713-555-0123 (chị Lan)", "US") && hasCallableNumber("(555) 000-1000", "US") && hasCallableNumber("+1 408 555 0100", "US") &&
  hasCallableNumber("0412 345 678", "AU") && hasCallableNumber("(02) 9123 4567", "AU") && hasCallableNumber("+61 2 5550 1234", "AU") && hasCallableNumber("0410000001", "AU"));
ok("CN2", "Không gọi được: \"+1 0901234567\" (tin Mỹ), \"+44 747 555 0142\" (tin Mỹ), số Mỹ trong tin Úc, số Anh 0747 555 0142 trong tin Úc, rỗng",
  !hasCallableNumber("+1 0901234567", "US") && !hasCallableNumber("+44 747 555 0142", "US") && !hasCallableNumber("(713) 555-0123", "AU") && !hasCallableNumber("0747 555 0142", "AU") && !hasCallableNumber("", "US") && !hasCallableNumber(null, "US"));

// ---------- Bài ngoài Mỹ / Úc ----------
const UK1 = "Shop mình ở shenfield cách Stratford 20p tàu cần tìm thợ cgt,tay nghề khá, có chỗ đậu xe. Shop làm khách book lên hết khách thì về sớm, không làm muộn. Nếu bạn nào muốn thay đổi chỗ làm thì goi số 07475550142\nMany thanks";
const UK2 = "Shop gần bến tàu international Stratford DLR tìm thợ Nữ làm everything+ design, biết tiếng Anh giao tiếp. Chị em nào thay đổi môi trường nhắn gọi mình 07755550199. Thanks";
ok("FM1", "2 bài nhóm nail ở Anh trên production → dấu hiệu 'SĐT Anh'; không tách ra số Mỹ / Úc nào", !!foreignMarketSignal(UK1)?.includes("Anh") && !!foreignMarketSignal(UK2)?.includes("Anh") && !findPhone(UK1) && !findPhone(UK2), JSON.stringify([foreignMarketSignal(UK1), foreignMarketSignal(UK2)]));
ok("FM2", "Số Anh đủ kiểu viết (07475 550142 · 0747 555 0142 · +44 7475 550142 · 0044 7473…) + postcode (RM1 3AB) + 'Anh Quốc' / 'London' (bài không có số Mỹ/Úc) → ngoài thị trường",
  ["Gọi 07475 550142", "Gọi 0747 555 0142", "Cần thợ, +44 7475 550142", "LH 0044 7475 550142", "Shop ở Romford RM1 3AB cần thợ", "Tiệm ở Anh Quốc cần thợ bột", "Cần thợ nail ở London, inbox"].every((t) => !!foreignMarketSignal(t)),
  JSON.stringify(["Gọi 07475 550142", "Shop ở Romford RM1 3AB cần thợ"].map(foreignMarketSignal)));
const US_OK = ["Tiệm ở London, KY cần thợ, 606-555-0101", "Tiệm ở New London CT cần thợ bột 860-555-0101", "Cần thợ biết tiếng Anh, tiệm ở Houston 713-555-0101", "Tiệm khu New England cần thợ, 617-555-0100", "Hiring nail tech in Charlotte NC 704-555-0115. UK trained welcome", "Cần thợ anh Tuấn 713-555-0100 ở Dallas"];
const AU_OK = ["Tiệm ở Bankstown NSW, LH 0412 345 678 1 tuần $1200", "Cần thợ ở Brisbane, gọi (07) 3123 4567", "Cần thợ, gọi 0731234567", "Tiệm ở New South Wales cần thợ 0412 555 019"];
ok("FM3", "Không bắt nhầm bài Mỹ / Úc: London KY, New London CT, 'tiếng Anh', New England, 'UK trained' có số Mỹ, 'anh Tuấn'; số bàn QLD 07 xxxx xxxx, New South Wales",
  [...US_OK, ...AU_OK].every((t) => foreignMarketSignal(t) === null), JSON.stringify([...US_OK, ...AU_OK].filter((t) => foreignMarketSignal(t)).map((t) => [t, foreignMarketSignal(t)])));
ok("FM4", "Ô quốc gia của bot: UK / Anh / England / United Kingdom → ngoài; Mỹ / USA / Úc / rỗng → không",
  ["UK", "Anh", "England", "United Kingdom", "anh quốc"].every(isForeignCountry) && !["Mỹ", "USA", "Úc", "Australia", "", undefined].some((c) => isForeignCountry(c as string)));

// ---------- prepareIngest (thuần — không đọc / ghi DB) ----------
const { prepareIngest, OUT_OF_MARKET_REASON } = await import("../../lib/jobIngest/ingest");
const none = new Set<string>();
const now = new Date().toISOString();
// Đúng như production: tool gửi kèm market US + số đã cắt số 0 + tên Facebook của người đăng
const r1 = prepareIngest({ text: UK1, phone: "7475550142", market: "US", salonName: "ArticulateHedgehog6604", postedAt: now }, none);
const r2 = prepareIngest({ text: UK2, phone: "(775) 555-0199", market: "US", salonName: "RedCaterpillar8181", postedAt: now }, none);
const r3 = prepareIngest({ text: UK2, postedAt: now }, none);
ok("IN1", "2 bài Anh (tool gửi market US + số Mỹ 'chuẩn hoá' 747 / 775) → bỏ qua với lý do 'bài ở ngoài Mỹ/Úc (SĐT Anh …)', không tạo tin CA / NV",
  r1.status === "skipped" && r1.reason.startsWith(OUT_OF_MARKET_REASON) && r2.status === "skipped" && r2.reason.startsWith(OUT_OF_MARKET_REASON) && r3.status === "skipped" && r3.reason.startsWith(OUT_OF_MARKET_REASON),
  JSON.stringify([r1.status === "skipped" ? r1.reason : r1.data.phone, r2.status === "skipped" ? r2.reason : r2.data.phone]));
const r4 = prepareIngest({ text: "Cần thợ bột gấp, tiệm ở Romford. Gọi 07475550142", phone: "+447475550142", postedAt: now }, none);
const r5 = prepareIngest({ text: "Cần thợ bột gấp ở Houston TX, gọi 713-555-0141", country: "UK", postedAt: now }, none);
ok("IN2", "Số tool gửi '+44…' / ô quốc gia 'UK' → bỏ qua (ngoài Mỹ/Úc)", r4.status === "skipped" && r4.reason.startsWith(OUT_OF_MARKET_REASON) && r5.status === "skipped" && r5.reason.startsWith(OUT_OF_MARKET_REASON), JSON.stringify([r4.status === "skipped" && r4.reason, r5.status === "skipped" && r5.reason]));
const r6 = prepareIngest({ text: "Cần thợ bột gấp, bao lương. Gọi 0412 555 019", market: "US", state: "TX", postedAt: now }, none);
ok("IN3", "Tool ghi market US nhưng bài chỉ có số Úc → không đăng số Úc vào tin Mỹ (bỏ qua có lý do)", r6.status === "skipped" && /không phải số Mỹ|không xác định|SĐT/.test(r6.reason), JSON.stringify(r6.status === "skipped" ? r6.reason : r6.data));
const r7 = prepareIngest({ text: "Tiệm Lucky Nails & Spa ở Houston TX cần gấp 2 thợ bột. Bao lương $1,200/tuần. Gọi (281) 555-0142", postedAt: now }, none);
const r8 = prepareIngest({ text: "Hiring nail tech ASAP at Bella Nail Lounge, Shop 4/112 Station St, Bankstown NSW 2200. $30-35/hr cash. Call 0412 555 019", postedAt: now }, none);
const r9 = prepareIngest({ text: "Hiring nail tech in Charlotte NC, full time. UK trained welcome. Call 704-555-0115", postedAt: now }, none);
ok("IN4", "Bài Mỹ / Úc thật vẫn nhận như cũ (SĐT dạng chuẩn); 'UK trained welcome' + số Mỹ vẫn là tin Mỹ",
  r7.status === "ok" && r7.data.phone === "(281) 555-0142" && r7.data.market === "US" && r7.data.state === "TX" && r8.status === "ok" && r8.data.phone === "0412 555 019" && r8.data.market === "AU" && r9.status === "ok" && r9.data.state === "NC",
  JSON.stringify([r7.status, r8.status, r9.status === "skipped" ? r9.reason : r9.data.state]));

// ---------- publicJob: dữ liệu cũ đã lưu ----------
type J = Parameters<typeof publicJob>[0];
const base = { sourceUrl: null, sourceKey: null, sourceFbHash: null, salonName: "x", city: "New York", state: "NY", salaryAmount: "Thỏa thuận" };
const xuan = publicJob({ ...base, source: null, phone: "+1 0901234567", market: "US", description: "Xuân xanh tại New York, NY đang cần tuyển thợ nail gấp." } as J);
const uk = publicJob({ ...base, source: "ingest", phone: "(747) 555-0142", market: "US", city: "", state: "CA", description: UK1 } as J);
const good = publicJob({ ...base, source: null, phone: "4085550100", market: "US", description: "Cần thợ" } as J);
const goodIngest = publicJob({ ...base, source: "ingest", phone: "(832) 555-0178", market: "US", description: "Cần thợ chân tay nước. LH 832-555-0178" } as J);
const au = publicJob({ ...base, source: null, phone: "0412 345 678", market: "AU", description: "Cần thợ" } as J);
ok("PJ1", "Tin 'Xuân xanh' (+1 0901234567) và tin Anh đã lưu (747) 555-0142 → không còn hiện số / nút Gọi; tin đúng giữ nguyên số",
  xuan.phone === "" && uk.phone === "" && good.phone === "4085550100" && goodIngest.phone === "(832) 555-0178" && au.phone === "0412 345 678",
  JSON.stringify([xuan.phone, uk.phone, good.phone, goodIngest.phone, au.phone]));

// ---------- localeHref ----------
ok("LH1", "Trên /vi/*: /auth/login → /vi/auth/login, /?tab=jobs → /vi?tab=jobs, / → /vi, /messages?to=1#x → /vi/messages?to=1#x, /vi/jobs/1 giữ nguyên",
  localeHref("/auth/login", "/vi/jobs/1") === "/vi/auth/login" && localeHref("/?tab=jobs", "/vi") === "/vi?tab=jobs" && localeHref("/", "/vi/tools/income-tracker") === "/vi" &&
  localeHref("/messages?to=1#x", "/vi/profile/2") === "/vi/messages?to=1#x" && localeHref("/vi/jobs/1", "/vi") === "/vi/jobs/1",
  JSON.stringify([localeHref("/auth/login", "/vi/jobs/1"), localeHref("/?tab=jobs", "/vi"), localeHref("/", "/vi/x")]));
ok("LH2", "Trang EN (không tiền tố) / /video / URL ngoài / //host → không đổi",
  localeHref("/auth/login", "/jobs/1") === "/auth/login" && localeHref("/?tab=jobs", "/") === "/?tab=jobs" && localeHref("/auth/login", "/video") === "/auth/login" &&
  localeHref("https://x.com/a", "/vi") === "https://x.com/a" && localeHref("//evil.com", "/vi") === "//evil.com");

// ---------- File SQL giao chủ: ẩn đúng 3 tin, hoàn tác nguyên văn ----------
const HIDE = "prisma/sql/2026-11-08_hide_bad_jobs.sql", RESTORE = "prisma/sql/2026-11-08_hide_bad_jobs_restore.sql";
const IDS = ["cmw6ix2te0002l7072razday9", "cmw58w60o0002gz08u9vphi8v", "cmv9m3p070002jm06glq8d4fx"];
// Cắt câu lệnh đúng như scripts/apply-sql.ts (bỏ dòng "--", tách theo ";")
const stmts = (f: string) => fs.readFileSync(f, "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((s) => s.trim()).filter(Boolean);
const idsIn = (f: string) => new Set(stmts(f).join("\n").match(/\bcm[a-z0-9]{23}\b/g) || []);
ok("SQL1", "Cả 2 file chỉ nhắc đúng 3 id; không DELETE dòng Job nào; hoàn tác chỉ xoá bản cất AppSetting",
  [HIDE, RESTORE].every((f) => { const s = idsIn(f); return s.size === 3 && IDS.every((i) => s.has(i)); }) && !stmts(HIDE).some((s) => /^DELETE/i.test(s)) && stmts(RESTORE).filter((s) => /^DELETE/i.test(s)).every((s) => /FROM "AppSetting"/.test(s)));

try {
  // ---------- Tuyến bot thật (/api/ingest/jobs, /api/jobs/sync) trên DB tạm ----------
  const ingestRoute = await import("../../app/api/ingest/jobs/route");
  const syncRoute = await import("../../app/api/jobs/sync/route");
  const post = (body: unknown) => new Request("http://localhost:3000/x", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.INGEST_KEY}` }, body: JSON.stringify(body) });
  const i1 = await ingestRoute.POST(post({ posts: [
    { text: UK1, phone: "7475550142", market: "US", salonName: "ArticulateHedgehog6604", postedAt: now },
    { text: UK2, phone: "(775) 555-0199", market: "US", salonName: "RedCaterpillar8181", postedAt: now },
    { text: "Tiệm cần thợ bột gấp ở Katy TX, bao lương $1,300/tuần. LH 832-555-0161", state: "TX", market: "US", postedAt: now },
  ] }));
  const b1 = (await i1.json()) as { created: number; skipped: number; results: { status: string; reason?: string }[] };
  const s1 = await syncRoute.POST(post({ content: UK2, phone: "(775) 555-0199", salon_name: "RedCaterpillar8181", country: "UK", location: "Stratford" }));
  const sb = (await s1.json()) as { status: string; reason: string | null };
  const ukRows = await db.job.count({ where: { phone: { in: ["(747) 555-0142", "(775) 555-0199"] } } });
  const katy = await db.job.findFirst({ where: { phone: "(832) 555-0161" }, select: { market: true, state: true, source: true } });
  ok("RT1", "/api/ingest/jobs: 2 bài Anh → skipped 'bài ở ngoài Mỹ/Úc …' (bot vẫn nhận 200, bài Mỹ cùng lô vẫn tạo); /api/jobs/sync country UK → 422 có lý do; DB không có tin (747)/(775)",
    i1.status === 200 && b1.created === 1 && b1.results[0].status === "skipped" && !!b1.results[0].reason?.startsWith(OUT_OF_MARKET_REASON) && b1.results[1].status === "skipped" && !!b1.results[1].reason?.startsWith(OUT_OF_MARKET_REASON) &&
      s1.status === 422 && sb.status === "skipped" && !!sb.reason?.startsWith(OUT_OF_MARKET_REASON) && ukRows === 0 && katy?.market === "US" && katy.state === "TX" && katy.source === "ingest",
    JSON.stringify({ b1, sb, ukRows, katy }));
  await db.job.deleteMany({});

  const owner =await db.user.create({ data: { email: `bad.${Date.now()}@qa.test`, name: "QA", role: "OWNER", password: "x", market: "US" } });
  const mk = (id: string, extra: Record<string, unknown>) => db.job.create({ data: { id, title: "Cần thợ Nail", salonName: "x", description: "x", ownerId: owner.id, market: "US", state: "CA", city: "", salaryType: "Thỏa thuận", salaryAmount: "Thỏa thuận", skills: "", benefits: "", phone: "(747) 555-0142", ...extra } });
  const future = new Date(Date.now() + 10 * 86_400_000);
  await mk(IDS[0], { source: "ingest", expiresAt: future, createdAt: new Date(Date.now() - 86_400_000) });
  await mk(IDS[1], { source: "ingest", expiresAt: future, createdAt: new Date(Date.now() - 2 * 86_400_000) });
  await mk(IDS[2], { source: null, expiresAt: null, phone: "+1 0901234567", createdAt: new Date(Date.now() - 20 * 86_400_000) });
  const CONTROL = "cmqacontrol0000000000000a";
  await mk(CONTROL, { source: null, expiresAt: future, phone: "(713) 555-0123" });
  // production (adapter libSQL) có thể lưu ngày dạng chuỗi ISO → 1 dòng dạng chuỗi để chắc hoàn tác trả NGUYÊN VĂN
  const iso = new Date(future.getTime() + 1234).toISOString();
  await db.$executeRawUnsafe(`UPDATE "Job" SET "expiresAt" = ? WHERE "id" = ?`, iso, IDS[1]);
  const raw = async () => Object.fromEntries((await db.$queryRawUnsafe<{ id: string; e: unknown; t: string }[]>(`SELECT "id", "expiresAt" AS e, typeof("expiresAt") AS t FROM "Job"`)).map((r) => [r.id, `${r.t}:${String(r.e)}`]));
  const before = await raw();
  const { activeJobWhere } = await import("../../lib/jobIngest/ingest");
  const visible = async () => (await db.job.findMany({ where: activeJobWhere(), select: { id: true } })).map((j) => j.id).sort();
  const vis0 = await visible();
  const run = async (f: string) => { for (const s of stmts(f)) await db.$executeRawUnsafe(s); };
  await run(HIDE);
  const hidden = await raw();
  const vis1 = await visible();
  await run(HIDE); // chạy lại: không ghi đè bản cất
  const stash = await db.appSetting.findUnique({ where: { key: "hidden_bad_jobs_2026_11_08" } });
  const reread = await db.job.findMany({ where: { id: { in: IDS } }, select: { id: true, expiresAt: true, createdAt: true } });
  ok("SQL2", "Ẩn: 3 tin rời bảng việc (activeJobWhere), dòng đối chứng vẫn hiện; expiresAt = createdAt (Prisma đọc được, đã qua); chạy lại 2 lần không đổi bản cất",
    IDS.every((i) => vis0.includes(i)) && vis0.includes(CONTROL) && IDS.every((i) => !vis1.includes(i)) && vis1.includes(CONTROL) && hidden[CONTROL] === before[CONTROL] &&
      reread.length === 3 && reread.every((j) => !!j.expiresAt && j.expiresAt.getTime() === j.createdAt.getTime() && j.expiresAt.getTime() < Date.now()) &&
      !!stash && JSON.parse(stash.value)[IDS[2]] === null && Object.keys(JSON.parse(stash.value)).length === 3,
    JSON.stringify({ vis0, vis1, stash: stash?.value }));
  await run(RESTORE);
  const after = await raw();
  const vis2 = await visible();
  await run(RESTORE); // chạy lại: không có bản cất → không đổi gì
  const after2 = await raw();
  ok("SQL3", "Hoàn tác: expiresAt trả NGUYÊN VĂN (số ms / chuỗi ISO / NULL), 3 tin hiện lại, bản cất bị xoá; chạy lại hoàn tác không đổi gì",
    JSON.stringify(after) === JSON.stringify(before) && JSON.stringify(after2) === JSON.stringify(before) && IDS.every((i) => vis2.includes(i)) && !(await db.appSetting.findUnique({ where: { key: "hidden_bad_jobs_2026_11_08" } })),
    JSON.stringify({ before, after }));
} finally {
  await db.$disconnect();
  try { fs.unlinkSync(dbFile); } catch {}
}

console.log(`\nSĐT đúng thị trường + bài ngoài Mỹ/Úc + SQL ẩn tin + localeHref: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
