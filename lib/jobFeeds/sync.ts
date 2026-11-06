// ĐƯỜNG ỐNG tin việc từ đối tác (Adzuna) → bảng ExternalJob. Gọi từ cron /api/cron/external-jobs (mỗi ngày).
//   1. Công tắc tắt → xoá sạch tin đã lưu của Adzuna (giấy phép hết / tạm dừng), không gọi mạng.
//      Bật mà thiếu khoá → không làm gì (no-op, không ghi DB). Bật + khoá nhưng CHƯA có ADZUNA_LICENSE_REF → vẫn lấy
//      tin để admin kiểm tra độ phủ, nhưng không hiện công khai (config.adzunaPublic).
//   2. Lấy tin nail US + AU → chuẩn hoá (normalize.ts) → thêm mới / làm mới lastSeenAt + NỘI DUNG (lương, tiêu đề,
//      đoạn trích, link… đổi thì cập nhật ngay; lọc SĐT / không-phải-nail chạy lại trên nội dung mới).
//   3. Hết hạn = min(ngày đăng gốc + 30 ngày, lần cuối còn thấy + 60 giờ); hết hạn quá 7 ngày → xoá hẳn.
//   4. Chống trùng: tin TIỆM TỰ ĐĂNG / đăng hộ theo yêu cầu tiệm trên PawNail thắng (ẩn bản Adzuna trùng, kiểm lại
//      mỗi lượt). Tin TỔNG HỢP từ nhóm (source "ingest") KHÔNG dùng để ẩn tin Adzuna — bản có giấy phép, ghi nguồn rõ
//      ràng được giữ. Trùng nhau trong Adzuna → giữ tin mới nhất.
//   5. Ghi tóm tắt lượt chạy (AppSetting "external_jobs_last_run") cho trang admin — không có khoá / URL / nội dung tin.
//   Ngân sách thời gian: `deadline` = hạn GỌI Adzuna (mỗi lượt gọi tự rút ngắn timeout cho khớp), `workDeadline` = hạn
//   bắt đầu ghi DB; đối chiếu + ghi tóm tắt LUÔN chạy (route đặt 30 s / 45 s trong maxDuration 60 s).
// Mọi hàm nhận `db` (mặc định Prisma của app) để bài kiểm thử chạy trên SQLite riêng.
import type { Market, Prisma, PrismaClient } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { activeJobWhere, INGEST_SOURCE } from "@/lib/jobIngest/ingest";
import { fetchAdzunaMarket, type AdzunaStatus } from "@/lib/jobFeeds/adzuna";
import { adzunaFlagOn, adzunaKeys, adzunaLicenseRef, adzunaPublic, attributionFor, careerjetEnabled, careerjetFlagOn, careerjetKey, careerjetTermsRef, MAX_AGE_DAYS, purgeAfterDays, referralFeeDisclosed, seenTtlHours } from "@/lib/jobFeeds/config";
import { companyTokens, companyTokensMatch, isNailJob, normalizeAdzuna, normText } from "@/lib/jobFeeds/normalize";
import type { ExternalJobInput, FeedMarket, FetchLike, HiddenReason, PublicExternalJob } from "@/lib/jobFeeds/types";

type Db = PrismaClient;
const DAY = 86_400_000;
const HOUR = 3_600_000;
export const SUMMARY_KEY = "external_jobs_last_run";
const MARKETS: FeedMarket[] = ["US", "AU"];
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
/** Mã lỗi Prisma (VD "P2002" trùng khoá) — không phải bí mật, an toàn để ghi log. */
export const prismaCode = (e: unknown) => (e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : null);

export const expiryFor = (providerCreatedAt: Date, lastSeenAt: Date) =>
  new Date(Math.min(providerCreatedAt.getTime() + MAX_AGE_DAYS * DAY, lastSeenAt.getTime() + seenTtlHours() * HOUR));

// Nội dung tin được làm mới mỗi lần Adzuna còn trả tin (ngày đăng gốc thì GIỮ NGUYÊN — không "làm mới" độ mới của tin).
const CONTENT_FIELDS = ["title", "company", "locationLabel", "state", "city", "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod", "contractTime", "contractType", "snippet", "redirectUrl", "dedupeKey"] as const;
type ContentField = (typeof CONTENT_FIELDS)[number];
type Content = Pick<ExternalJobInput, ContentField>;
type Dated = ExternalJobInput & { providerCreatedAt: Date };
const contentOf = (x: Content): Content => ({
  title: x.title, company: x.company ?? null, locationLabel: x.locationLabel, state: x.state ?? null, city: x.city ?? null,
  salaryMin: x.salaryMin ?? null, salaryMax: x.salaryMax ?? null, salaryCurrency: x.salaryCurrency ?? null, salaryPeriod: x.salaryPeriod ?? null,
  contractTime: x.contractTime ?? null, contractType: x.contractType ?? null, snippet: x.snippet ?? null, redirectUrl: x.redirectUrl, dedupeKey: x.dedupeKey,
});

/** createMany theo lô; lượt cron chạy CHỒNG (Vercel đôi khi gửi trùng) làm 1 lô trùng khoá (P2002) → thêm từng dòng, bỏ dòng đã có. */
async function createRows(db: Db, rows: Prisma.ExternalJobCreateManyInput[]) {
  let n = 0;
  for (const part of chunk(rows, 100)) {
    try {
      n += (await db.externalJob.createMany({ data: part })).count;
    } catch (e) {
      if (prismaCode(e) !== "P2002") throw e;
      for (const r of part) {
        try { await db.externalJob.create({ data: r }); n++; } catch (e2) { if (prismaCode(e2) !== "P2002") throw e2; }
      }
    }
  }
  return n;
}

/** Thêm tin mới / làm mới tin đã có (cùng provider + providerJobId): lastSeenAt, hạn, và nội dung nếu đã đổi. */
export async function upsertExternalJobs(db: Db, items: ExternalJobInput[], now = new Date()) {
  const seen = new Map<string, Dated>();
  for (const it of items) {
    if (!it.providerCreatedAt) continue; // không có ngày đăng → không lưu (normalize đã bỏ; chặn thêm cho chắc)
    const k = `${it.provider}:${it.providerJobId}`;
    if (!seen.has(k)) seen.set(k, it as Dated);
  }
  const list = [...seen.values()];
  let created = 0, updated = 0, refreshed = 0, skippedOld = 0;
  for (const provider of [...new Set(list.map((x) => x.provider))]) {
    const mine = list.filter((x) => x.provider === provider);
    type Existing = Content & { id: string; providerJobId: string; providerCreatedAt: Date };
    const existing = new Map<string, Existing>();
    for (const ids of chunk(mine.map((x) => x.providerJobId), 200)) {
      const found = await db.externalJob.findMany({
        where: { provider, providerJobId: { in: ids } },
        select: { id: true, providerJobId: true, providerCreatedAt: true, title: true, company: true, locationLabel: true, state: true, city: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true, contractTime: true, contractType: true, snippet: true, redirectUrl: true, dedupeKey: true },
      });
      for (const r of found) existing.set(r.providerJobId, r);
    }
    const fresh = mine.filter((x) => !existing.has(x.providerJobId));
    const rows = fresh
      .map(({ notNail, ...x }) => ({ ...x, market: x.market as Market, hiddenReason: notNail ? "not_nail" : null, firstSeenAt: now, lastSeenAt: now, expiresAt: expiryFor(x.providerCreatedAt, now) }))
      .filter((r) => r.expiresAt.getTime() > now.getTime());
    skippedOld += fresh.length - rows.length;
    created += await createRows(db, rows);
    // Tin đã có: lastSeenAt = bây giờ; hạn = now + SEEN_TTL (đa số, gộp 1 câu lệnh) hoặc ngày đăng + 30 (tin sắp đủ 30 ngày).
    // Nội dung đổi (lương, tiêu đề, đoạn trích, link…) → cập nhật riêng dòng đó (thường rất ít).
    const capped = expiryFor(new Date(now.getTime() + 365 * DAY), now);
    const groupA: string[] = [];
    const groupB: { id: string; expiresAt: Date }[] = [];
    for (const x of mine) {
      const e = existing.get(x.providerJobId);
      if (!e) continue;
      const exp = expiryFor(e.providerCreatedAt, now);
      const next = contentOf(x);
      const was = contentOf(e);
      if (CONTENT_FIELDS.some((f) => was[f] !== next[f])) {
        await db.externalJob.update({ where: { id: e.id }, data: { ...next, lastSeenAt: now, expiresAt: exp } });
        updated++; refreshed++;
      } else if (exp.getTime() === capped.getTime()) groupA.push(e.id);
      else groupB.push({ id: e.id, expiresAt: exp });
    }
    for (const ids of chunk(groupA, 200)) updated += (await db.externalJob.updateMany({ where: { id: { in: ids } }, data: { lastSeenAt: now, expiresAt: capped } })).count;
    for (const b of groupB) { await db.externalJob.update({ where: { id: b.id }, data: { lastSeenAt: now, expiresAt: b.expiresAt } }); updated++; }
  }
  return { created, updated, refreshed, skippedOld };
}

/** Xoá tin hết hạn lâu, rồi tính lại trạng thái ẩn: không phải nail / trùng tin tiệm trên PawNail / trùng trong Adzuna. */
export async function reconcileExternalJobs(db: Db, provider: string, now = new Date()) {
  const purged = (await db.externalJob.deleteMany({ where: { provider, expiresAt: { lt: new Date(now.getTime() - purgeAfterDays() * DAY) } } })).count;
  const rows = await db.externalJob.findMany({
    where: { provider, expiresAt: { gt: now } },
    select: { id: true, market: true, state: true, city: true, company: true, title: true, snippet: true, dedupeKey: true, providerCreatedAt: true, hiddenReason: true },
  });
  // Tin trên PawNail đang hiện, chỉ tài khoản thật: tiệm tự đăng (source null) + đăng hộ theo yêu cầu tiệm ("assisted").
  // Tin tổng hợp từ nhóm ("ingest") bị bỏ qua: không được ẩn bản Adzuna có giấy phép + ghi nguồn thay cho nó.
  const jobs = await db.job.findMany({
    where: { AND: [activeJobWhere(), { owner: realOnly() }, { OR: [{ source: null }, { source: { not: INGEST_SOURCE } }] }] },
    select: { salonName: true, city: true, state: true, market: true, source: true },
    take: 5000,
  });
  // Gom theo thị trường|bang + tách từ tên tiệm 1 lần (không chuẩn hoá lại cho mỗi cặp)
  const byArea = new Map<string, { own: boolean; city: string; tokens: string[] }[]>();
  for (const j of jobs) {
    if (j.source === INGEST_SOURCE) continue;
    const k = `${j.market}|${j.state}`;
    if (!byArea.has(k)) byArea.set(k, []);
    byArea.get(k)!.push({ own: !j.source, city: normText(j.city), tokens: [...new Set(companyTokens(j.salonName))] });
  }
  const want = new Map<string, string | null>();
  for (const r of rows) {
    if (r.hiddenReason === "admin") { want.set(r.id, "admin"); continue; }
    if (!isNailJob(r.title, r.snippet)) { want.set(r.id, "not_nail"); continue; }
    const area = r.state ? byArea.get(`${r.market}|${r.state}`) ?? [] : [];
    const city = normText(r.city);
    const tokens = area.length ? [...new Set(companyTokens(r.company))] : [];
    const hits = area.filter((j) => (!j.city || !city || j.city === city) && companyTokensMatch(j.tokens, tokens));
    want.set(r.id, hits.some((j) => j.own) ? "dup_salon_post" : hits.length ? "dup_job" : null);
  }
  // Trùng trong cùng nhà cung cấp (cùng tiêu đề + công ty + thành phố, đăng cách nhau ≤ 14 ngày) → giữ tin mới nhất
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) if (want.get(r.id) === null) byKey.set(r.dedupeKey, [...(byKey.get(r.dedupeKey) ?? []), r]);
  for (const g of byKey.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => b.providerCreatedAt.getTime() - a.providerCreatedAt.getTime());
    for (const r of g.slice(1)) if (g[0].providerCreatedAt.getTime() - r.providerCreatedAt.getTime() <= 14 * DAY) want.set(r.id, "dup_provider");
  }
  const changes = new Map<string | null, string[]>();
  for (const r of rows) {
    const w = want.get(r.id) ?? null;
    if (w !== r.hiddenReason) changes.set(w, [...(changes.get(w) ?? []), r.id]);
  }
  for (const [reason, ids] of changes) for (const part of chunk(ids, 200)) await db.externalJob.updateMany({ where: { id: { in: part } }, data: { hiddenReason: reason } });
  const hidden: Record<string, number> = {};
  const active: Record<FeedMarket, number> = { US: 0, AU: 0 };
  for (const r of rows) {
    const w = want.get(r.id) ?? null;
    if (w) hidden[w] = (hidden[w] ?? 0) + 1;
    else active[r.market as FeedMarket]++;
  }
  return { purged, hidden, active };
}

export interface ProviderRun {
  flag: boolean; keys: boolean; licensed?: boolean; status: AdzunaStatus | "disabled" | "no_keys" | "purged" | "table_missing";
  calls?: number; httpStatus?: number | null;
  markets?: Partial<Record<FeedMarket, { fetched: number; dropped: number; created: number; updated: number; refreshed: number; providerCount: number | null; status: AdzunaStatus }>>;
  hidden?: Record<string, number>; active?: Record<FeedMarket, number>; purged?: number;
  lastSuccessAt?: string | null; lastNonEmptyAt?: string | null; enabledSince?: string | null; alert?: string | null;
}
export interface SyncSummary { at: string; adzuna: ProviderRun }

async function readSummary(db: Db): Promise<SyncSummary | null> {
  try { return JSON.parse((await db.appSetting.findUnique({ where: { key: SUMMARY_KEY } }))?.value || "null"); } catch { return null; }
}
async function writeSummary(db: Db, s: SyncSummary) {
  await db.appSetting.upsert({ where: { key: SUMMARY_KEY }, update: { value: JSON.stringify(s) }, create: { key: SUMMARY_KEY, value: JSON.stringify(s) } });
}

/** Còn kịp gọi Adzuna thêm lượt nữa không (cần ≥ 1,5 s trước hạn — mỗi lượt gọi tự rút timeout cho vừa). */
export const MIN_FETCH_MS = 1_500;

export async function runExternalJobsSync(opts: { db?: Db; fetchImpl?: FetchLike; now?: Date; deadline?: number; workDeadline?: number } = {}): Promise<SyncSummary> {
  const db = opts.db ?? defaultPrisma;
  const now = opts.now ?? new Date();
  const flag = adzunaFlagOn();
  const keys = adzunaKeys();
  const licensed = !!adzunaLicenseRef();
  const at = now.toISOString();
  if (!flag) {
    // Tắt → xoá mọi tin Adzuna đã lưu (không giữ dữ liệu đối tác khi không còn dùng). Bảng trống / chưa có → không ghi gì.
    try {
      const n = await db.externalJob.count({ where: { provider: "adzuna" } });
      if (!n) return { at, adzuna: { flag, keys: !!keys, licensed, status: "disabled" } };
      const purged = (await db.externalJob.deleteMany({ where: { provider: "adzuna" } })).count;
      const s: SyncSummary = { at, adzuna: { flag, keys: !!keys, licensed, status: "purged", purged } };
      await writeSummary(db, s);
      return s;
    } catch {
      return { at, adzuna: { flag, keys: !!keys, licensed, status: "table_missing" } };
    }
  }
  if (!keys) return { at, adzuna: { flag, keys: false, licensed, status: "no_keys" } }; // không khoá → không gọi mạng, không ghi DB
  try { await db.externalJob.count({ where: { provider: "adzuna" } }); } catch { return { at, adzuna: { flag, keys: true, licensed, status: "table_missing" } }; }

  const prev = (await readSummary(db))?.adzuna;
  const run: ProviderRun = { flag, keys: true, licensed, status: "ok", calls: 0, httpStatus: null, markets: {} };
  for (const market of MARKETS) {
    if (run.status === "rate_limited" || run.status === "auth_error") break; // hết lượt / khoá hỏng → dừng, lượt sau làm tiếp
    if (opts.deadline && Date.now() > opts.deadline - MIN_FETCH_MS) { run.status = "deadline"; break; } // hết giờ gọi → để dành cho DB
    const f = await fetchAdzunaMarket(market, { keys, fetchImpl: opts.fetchImpl, deadline: opts.deadline });
    run.calls! += f.calls;
    run.httpStatus = f.httpStatus;
    const items = f.results.map((r) => normalizeAdzuna(r, market, now)).filter((x): x is ExternalJobInput => !!x);
    const dropped = f.results.length - items.length; // link lạ / thiếu tiêu đề / không có ngày đăng
    if (opts.workDeadline && Date.now() > opts.workDeadline) {
      // Quá hạn ghi DB → bỏ lô này (lượt sau lấy lại), dành thời gian cho đối chiếu + tóm tắt
      run.markets![market] = { fetched: items.length, dropped, created: 0, updated: 0, refreshed: 0, providerCount: f.count, status: "deadline" };
      run.status = "deadline";
      break;
    }
    const u = await upsertExternalJobs(db, items, now);
    run.markets![market] = { fetched: items.length, dropped, created: u.created, updated: u.updated, refreshed: u.refreshed, providerCount: f.count, status: f.status };
    if (f.status !== "ok") run.status = f.status;
  }
  const rec = await reconcileExternalJobs(db, "adzuna", now);
  Object.assign(run, rec);
  const ok = run.status === "ok";
  run.lastSuccessAt = ok ? at : prev?.lastSuccessAt ?? null;
  run.lastNonEmptyAt = rec.active.US + rec.active.AU > 0 ? at : prev?.lastNonEmptyAt ?? null;
  run.enabledSince = prev?.enabledSince ?? at;
  // Cảnh báo admin: khoá bị từ chối (401/403), hoặc 48 giờ liền không có tin nào hiện được
  const since = run.lastNonEmptyAt ?? run.enabledSince;
  run.alert = run.status === "auth_error" ? "auth_error" : now.getTime() - new Date(since).getTime() > 48 * HOUR ? "empty_48h" : run.status !== "ok" ? run.status : null;
  const s: SyncSummary = { at, adzuna: run };
  await writeSummary(db, s);
  return s;
}

// ===== Đọc (API công khai + admin) =====
const displayWhere = (now: Date) => ({ provider: "adzuna", expiresAt: { gt: now }, hiddenReason: null });

export async function listExternalJobs(opts: { db?: Db; market: FeedMarket; state?: string | null; city?: string | null; q?: string | null; page?: number; pageSize?: number; now?: Date }) {
  const db = opts.db ?? defaultPrisma;
  const now = opts.now ?? new Date();
  const where: Record<string, unknown> = { ...displayWhere(now), market: opts.market };
  if (opts.state) where.state = opts.state;
  const and: object[] = [];
  if (opts.city) and.push({ OR: [{ city: { contains: opts.city } }, { locationLabel: { contains: opts.city } }] });
  if (opts.q) and.push({ OR: ["title", "company", "locationLabel", "city"].map((f) => ({ [f]: { contains: opts.q } })) });
  if (and.length) where.AND = and;
  const pageSize = Math.min(50, Math.max(5, Math.floor(opts.pageSize || 12)));
  const page = Math.min(100, Math.max(1, Math.floor(opts.page || 1)));
  const [rows, total] = await Promise.all([
    db.externalJob.findMany({ where, orderBy: [{ providerCreatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.externalJob.count({ where }),
  ]);
  const items: PublicExternalJob[] = rows.map((r) => toPublic({ ...r, id: r.id, provider: "adzuna" }, opts.market));
  return { items, total, page, pageSize };
}

export function toPublic(r: Pick<ExternalJobInput, "title" | "company" | "locationLabel" | "state" | "city" | "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod" | "contractTime" | "snippet" | "redirectUrl" | "providerCreatedAt" | "provider"> & { id: string }, market: FeedMarket): PublicExternalJob {
  return {
    id: r.id,
    provider: r.provider,
    title: r.title,
    company: r.company,
    locationLabel: r.locationLabel,
    state: r.state,
    city: r.city,
    salary: r.salaryMin != null || r.salaryMax != null ? { min: r.salaryMin, max: r.salaryMax, currency: r.salaryCurrency, period: r.salaryPeriod } : null,
    contractTime: r.contractTime,
    snippet: r.snippet,
    url: r.redirectUrl,
    postedAt: r.providerCreatedAt ? r.providerCreatedAt.toISOString() : null, // không ghi ngày → null, KHÔNG phải "vừa đăng"
    attribution: attributionFor(r.provider, market),
  };
}

/** Trang admin: công tắc / khoá (chỉ có hay không), lượt chạy gần nhất, số tin đang hiện / ẩn theo lý do. */
export async function externalJobsStatus(db: Db = defaultPrisma, now = new Date()) {
  // Chỉ có / không — không bao giờ trả khoá hay mã giấy phép
  const flags = {
    adzuna: { flag: adzunaFlagOn(), keys: !!adzunaKeys(), licensed: !!adzunaLicenseRef(), public: adzunaPublic() },
    careerjet: { flag: careerjetFlagOn(), keys: !!careerjetKey(), terms: !!careerjetTermsRef(), enabled: careerjetEnabled() },
    referralFee: referralFeeDisclosed(),
  };
  const last = await readSummary(db).catch(() => null);
  let live: { active: Record<string, number>; hidden: Record<string, number>; expired: number } | null = null;
  try {
    const [act, hid, expired] = await Promise.all([
      db.externalJob.groupBy({ by: ["market"], where: displayWhere(now), _count: { _all: true } }),
      db.externalJob.groupBy({ by: ["hiddenReason"], where: { provider: "adzuna", expiresAt: { gt: now }, NOT: { hiddenReason: null } }, _count: { _all: true } }),
      db.externalJob.count({ where: { provider: "adzuna", expiresAt: { lte: now } } }),
    ]);
    live = {
      active: Object.fromEntries(act.map((r) => [r.market, r._count._all])),
      hidden: Object.fromEntries(hid.map((r) => [String(r.hiddenReason), r._count._all])),
      expired,
    };
  } catch {
    live = null; // bảng chưa tạo (chưa chạy prisma/sql/2026-11-07_external_jobs.sql)
  }
  return { flags, last, live };
}

export type { HiddenReason };
