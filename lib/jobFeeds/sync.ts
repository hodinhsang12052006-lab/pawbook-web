// ĐƯỜNG ỐNG tin việc từ đối tác (Adzuna) → bảng ExternalJob. Gọi từ cron /api/cron/external-jobs (mỗi ngày).
//   1. Công tắc tắt → xoá sạch tin đã lưu của Adzuna (giấy phép hết / tạm dừng), không gọi mạng.
//      Bật mà thiếu khoá → không làm gì (no-op, không ghi DB).
//   2. Lấy tin nail US + AU → chuẩn hoá (normalize.ts) → thêm mới / làm mới lastSeenAt.
//   3. Hết hạn = min(ngày đăng gốc + 30 ngày, lần cuối còn thấy + 60 giờ); hết hạn quá 7 ngày → xoá hẳn.
//   4. Chống trùng: tin TIỆM TỰ ĐĂNG trên PawNail luôn thắng (ẩn bản Adzuna trùng, kiểm lại mỗi lượt);
//      trùng nhau trong Adzuna → giữ tin mới nhất.
//   5. Ghi tóm tắt lượt chạy (AppSetting "external_jobs_last_run") cho trang admin — không có khoá / URL / nội dung tin.
// Mọi hàm nhận `db` (mặc định Prisma của app) để bài kiểm thử chạy trên SQLite riêng.
import type { Market, PrismaClient } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { activeJobWhere } from "@/lib/jobIngest/ingest";
import { fetchAdzunaMarket, type AdzunaStatus } from "@/lib/jobFeeds/adzuna";
import { adzunaFlagOn, adzunaKeys, attributionFor, careerjetFlagOn, careerjetKey, MAX_AGE_DAYS, purgeAfterDays, seenTtlHours } from "@/lib/jobFeeds/config";
import { companyMatch, isNailJob, normalizeAdzuna, sameCity } from "@/lib/jobFeeds/normalize";
import type { ExternalJobInput, FeedMarket, FetchLike, HiddenReason, PublicExternalJob } from "@/lib/jobFeeds/types";

type Db = PrismaClient;
const DAY = 86_400_000;
const HOUR = 3_600_000;
export const SUMMARY_KEY = "external_jobs_last_run";
const MARKETS: FeedMarket[] = ["US", "AU"];
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export const expiryFor = (providerCreatedAt: Date, lastSeenAt: Date) =>
  new Date(Math.min(providerCreatedAt.getTime() + MAX_AGE_DAYS * DAY, lastSeenAt.getTime() + seenTtlHours() * HOUR));

/** Thêm tin mới / làm mới tin đã có (cùng provider + providerJobId). Nội dung tin cũ giữ nguyên lần đầu thấy. */
export async function upsertExternalJobs(db: Db, items: ExternalJobInput[], now = new Date()) {
  const seen = new Map<string, ExternalJobInput>();
  for (const it of items) if (!seen.has(`${it.provider}:${it.providerJobId}`)) seen.set(`${it.provider}:${it.providerJobId}`, it);
  const list = [...seen.values()];
  let created = 0, updated = 0, skippedOld = 0;
  for (const provider of [...new Set(list.map((x) => x.provider))]) {
    const mine = list.filter((x) => x.provider === provider);
    const existing = new Map<string, { id: string; providerCreatedAt: Date }>();
    for (const ids of chunk(mine.map((x) => x.providerJobId), 200)) {
      for (const r of await db.externalJob.findMany({ where: { provider, providerJobId: { in: ids } }, select: { id: true, providerJobId: true, providerCreatedAt: true } })) existing.set(r.providerJobId, r);
    }
    const fresh = mine.filter((x) => !existing.has(x.providerJobId));
    const rows = fresh
      .map(({ notNail, ...x }) => ({ ...x, market: x.market as Market, hiddenReason: notNail ? "not_nail" : null, firstSeenAt: now, lastSeenAt: now, expiresAt: expiryFor(x.providerCreatedAt, now) }))
      .filter((r) => r.expiresAt.getTime() > now.getTime());
    skippedOld += fresh.length - rows.length;
    for (const part of chunk(rows, 100)) created += (await db.externalJob.createMany({ data: part })).count;
    // Tin đã có: lastSeenAt = bây giờ; hạn = now + SEEN_TTL (đa số, gộp 1 câu lệnh) hoặc ngày đăng + 30 (tin sắp đủ 30 ngày)
    const capped = expiryFor(new Date(now.getTime() + 365 * DAY), now);
    const groupA: string[] = [];
    const groupB: { id: string; expiresAt: Date }[] = [];
    for (const x of mine) {
      const e = existing.get(x.providerJobId);
      if (!e) continue;
      const exp = expiryFor(e.providerCreatedAt, now);
      if (exp.getTime() === capped.getTime()) groupA.push(e.id);
      else groupB.push({ id: e.id, expiresAt: exp });
    }
    for (const ids of chunk(groupA, 200)) updated += (await db.externalJob.updateMany({ where: { id: { in: ids } }, data: { lastSeenAt: now, expiresAt: capped } })).count;
    for (const b of groupB) { await db.externalJob.update({ where: { id: b.id }, data: { lastSeenAt: now, expiresAt: b.expiresAt } }); updated++; }
  }
  return { created, updated, skippedOld };
}

/** Xoá tin hết hạn lâu, rồi tính lại trạng thái ẩn: không phải nail / trùng tin tiệm tự đăng / trùng trong Adzuna. */
export async function reconcileExternalJobs(db: Db, provider: string, now = new Date()) {
  const purged = (await db.externalJob.deleteMany({ where: { provider, expiresAt: { lt: new Date(now.getTime() - purgeAfterDays() * DAY) } } })).count;
  const rows = await db.externalJob.findMany({
    where: { provider, expiresAt: { gt: now } },
    select: { id: true, market: true, state: true, city: true, company: true, title: true, snippet: true, dedupeKey: true, providerCreatedAt: true, hiddenReason: true },
  });
  // Tin trên PawNail đang hiện (tiệm tự đăng + tin tổng hợp), chỉ tài khoản thật
  const jobs = await db.job.findMany({ where: { AND: [activeJobWhere(), { owner: realOnly() }] }, select: { salonName: true, city: true, state: true, market: true, source: true }, take: 5000 });
  const want = new Map<string, string | null>();
  for (const r of rows) {
    if (r.hiddenReason === "admin") { want.set(r.id, "admin"); continue; }
    if (!isNailJob(r.title, r.snippet)) { want.set(r.id, "not_nail"); continue; }
    const hit = (j: (typeof jobs)[number]) => j.market === r.market && !!r.state && j.state === r.state && sameCity(j.city, r.city) && companyMatch(j.salonName, r.company);
    const own = jobs.find((j) => !j.source && hit(j));
    const agg = own ? null : jobs.find((j) => !!j.source && hit(j));
    want.set(r.id, own ? "dup_salon_post" : agg ? "dup_job" : null);
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
  flag: boolean; keys: boolean; status: AdzunaStatus | "disabled" | "no_keys" | "purged" | "table_missing";
  calls?: number; httpStatus?: number | null;
  markets?: Partial<Record<FeedMarket, { fetched: number; created: number; updated: number; providerCount: number | null; status: AdzunaStatus }>>;
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

export async function runExternalJobsSync(opts: { db?: Db; fetchImpl?: FetchLike; now?: Date; deadline?: number } = {}): Promise<SyncSummary> {
  const db = opts.db ?? defaultPrisma;
  const now = opts.now ?? new Date();
  const flag = adzunaFlagOn();
  const keys = adzunaKeys();
  const at = now.toISOString();
  if (!flag) {
    // Tắt → xoá mọi tin Adzuna đã lưu (không giữ dữ liệu đối tác khi không còn dùng). Bảng trống / chưa có → không ghi gì.
    try {
      const n = await db.externalJob.count({ where: { provider: "adzuna" } });
      if (!n) return { at, adzuna: { flag, keys: !!keys, status: "disabled" } };
      const purged = (await db.externalJob.deleteMany({ where: { provider: "adzuna" } })).count;
      const s: SyncSummary = { at, adzuna: { flag, keys: !!keys, status: "purged", purged } };
      await writeSummary(db, s);
      return s;
    } catch {
      return { at, adzuna: { flag, keys: !!keys, status: "table_missing" } };
    }
  }
  if (!keys) return { at, adzuna: { flag, keys: false, status: "no_keys" } }; // không khoá → không gọi mạng, không ghi DB
  try { await db.externalJob.count({ where: { provider: "adzuna" } }); } catch { return { at, adzuna: { flag, keys: true, status: "table_missing" } }; }

  const prev = (await readSummary(db))?.adzuna;
  const run: ProviderRun = { flag, keys: true, status: "ok", calls: 0, httpStatus: null, markets: {} };
  for (const market of MARKETS) {
    if (run.status === "rate_limited" || run.status === "auth_error") break; // hết lượt / khoá hỏng → dừng, lượt sau làm tiếp
    const f = await fetchAdzunaMarket(market, { keys, fetchImpl: opts.fetchImpl, deadline: opts.deadline });
    run.calls! += f.calls;
    run.httpStatus = f.httpStatus;
    const items = f.results.map((r) => normalizeAdzuna(r, market, now)).filter((x): x is ExternalJobInput => !!x);
    const u = await upsertExternalJobs(db, items, now);
    run.markets![market] = { fetched: items.length, created: u.created, updated: u.updated, providerCount: f.count, status: f.status };
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
    postedAt: r.providerCreatedAt.toISOString(),
    attribution: attributionFor(r.provider, market),
  };
}

/** Trang admin: công tắc / khoá (chỉ có hay không), lượt chạy gần nhất, số tin đang hiện / ẩn theo lý do. */
export async function externalJobsStatus(db: Db = defaultPrisma, now = new Date()) {
  const flags = { adzuna: { flag: adzunaFlagOn(), keys: !!adzunaKeys() }, careerjet: { flag: careerjetFlagOn(), keys: !!careerjetKey() } };
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
