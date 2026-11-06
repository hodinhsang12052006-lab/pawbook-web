// NHẬN TIN TỔNG HỢP từ tool lọc nhóm (source "ingest") + tin ADMIN ĐĂNG HỘ theo yêu cầu tiệm (source "assisted").
//   - Tách SĐT / tên tiệm / địa chỉ / bang / lương… (parse.ts); trường tool đã tách sẵn được ưu tiên.
//   - Chống trùng: cùng SĐT + nội dung (sourceKey) hoặc cùng SĐT còn hạn → CẬP NHẬT tin cũ.
//   - Tự hết hạn sau INGEST_TTL_DAYS (mặc định 14) kể từ ngày bài gốc đăng.
//   - Số đã yêu cầu "Gỡ tin" (admin duyệt) → không bao giờ đăng lại.
//   - prepareIngest (thuần, không ghi DB) → commitIngest: admin "Xem trước" dùng ĐÚNG quyết định thật (dryRun).
// Tất cả tin đứng tên 1 tài khoản hệ thống "PawNail · Tin tổng hợp" (KHÔNG tạo tài khoản mạo danh từng tiệm).
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { OAUTH_PASSWORD_PREFIX } from "@/lib/oauthUsers";
import { getSetting, setSetting } from "@/lib/settings";
import { stateFromUsPhone } from "@/lib/jobIngest/areaCodes";
import { cleanCity, cleanSalonName, findPhone, isAdPost, isJobSeeking, parseJobPost, safeToolSalary, stateFromAuPhone, type ParsedJob } from "@/lib/jobIngest/parse";
import { AU_ALL_CODES, US_ALL_CODES } from "@/lib/stateNames";

export const INGEST_SOURCE = "ingest";
/** Admin đăng hộ THEO YÊU CẦU của tiệm (có ghi nhận người yêu cầu) — khác tin tổng hợp từ bài công khai. */
export const ASSISTED_SOURCE = "assisted";
export const INGEST_OWNER_EMAIL = "tonghop@feed.pawnail.invalid";
/** Lần cuối tool lọc nhóm gửi được ≥ 1 tin (nhịp tim — admin thấy khi nguồn tin ngừng gửi). */
export const INGEST_LAST_AT_KEY = "ingest_last_at";
/** Lần cuối tool gửi 1 lô đúng khoá, KỂ CẢ khi mọi bài bị loại → phân biệt "tool ngừng gửi" với "tool gửi nhưng bị loại hết". */
export const INGEST_LAST_BATCH_AT_KEY = "ingest_last_batch_at";
/** Quá N giờ không nhận được tin nào → trang admin cảnh báo đỏ. */
export const INGEST_STALE_HOURS = 24;
const DAY = 86_400_000;
export const ingestTtlDays = () => Math.min(60, Math.max(3, Number(process.env.INGEST_TTL_DAYS) || 14));
/** Tin chủ tiệm TỰ ĐĂNG tự ẩn sau N ngày (mặc định 30, 7–90) nếu không bấm "Vẫn đang tuyển? Gia hạn". */
export const jobTtlDays = () => Math.min(90, Math.max(7, Number(process.env.JOB_TTL_DAYS) || 30));

// Bài SANG / BÁN tiệm mà tool từng gửi lẫn vào (trước 17/10/2026 chưa lọc) — ẩn khỏi mục Việc làm.
// Chỉ áp cho tin TỔNG HỢP CŨ (source = ingest, bài gốc trước 18/10/2026): từ 17/10 bộ tách đã tự loại bài bán tiệm /
// thợ tìm việc lúc nhận, còn bài TUYỂN có nhắc "sang tiệm" / "cần bán bớt ghế" / "nhận cọc giữ chỗ ở" là tin thật
// (trước đây nhận rồi bị ẩn mãi mãi). Tin chủ tiệm tự đăng không bao giờ bị ẩn theo chữ.
// (SQLite so khớp không phân biệt hoa/thường với chữ Latin, CÓ phân biệt với chữ có dấu → liệt kê đủ kiểu viết.)
const SALE_WORDS = ["sang tiệm", "Sang tiệm", "SANG TIỆM", "cần sang", "Cần sang", "CẦN SANG", "bán tiệm", "Bán tiệm", "BÁN TIỆM", "cần bán", "Cần bán", "CẦN BÁN", "giá sang", "Giá sang", "GIÁ SANG", "nhận cọc", "Nhận cọc", "for sale"];
// Bài THỢ TÌM VIỆC lọt vào trước khi có bộ lọc isJobSeeking (17/10/2026) — ẩn lúc hiển thị (không xoá).
const SEEK_WORDS = ["Góc tìm việc", "góc tìm việc", "GÓC TÌM VIỆC", "chủ shop nào cần thợ", "Chủ shop nào cần thợ", "Vietnailshelper", "trải nghiệm dịch vụ", "dịch vụ đăng tin"];
const LEGACY_FILTER_BEFORE = new Date("2026-10-18T00:00:00Z");
/** Điều kiện Prisma: tin còn hạn, không phải bài sang / bán tiệm cũ.
 *  Tin tự đăng: có expiresAt (đăng từ 11/2026) → theo hạn; tin cũ chưa có hạn → còn hiện JOB_TTL_DAYS ngày từ lúc đăng. */
export const activeJobWhere = () => {
  const now = new Date();
  return {
    AND: [
      { OR: [{ expiresAt: { gt: now } }, { expiresAt: null, createdAt: { gt: new Date(now.getTime() - jobTtlDays() * DAY) } }] },
      // Viết dạng OR (không dùng NOT(a AND b)): source NULL → so sánh SQL ra NULL, NOT(NULL) sẽ ẩn nhầm tin tự đăng.
      // sourcePostedAt NULL → nhánh "gte" ra sai → rơi xuống nhánh lọc chữ (đúng ý: tin cũ không rõ ngày vẫn bị lọc).
      { OR: [{ source: null }, { source: { not: INGEST_SOURCE } }, { sourcePostedAt: { gte: LEGACY_FILTER_BEFORE } }, { NOT: { OR: [...SALE_WORDS, ...SEEK_WORDS].map((w) => ({ description: { contains: w } })) } }] },
    ],
  };
};

export interface IngestInput {
  text?: string; // nguyên văn bài
  sourceUrl?: string;
  postedAt?: string | number; // ISO / ms — ngày bài gốc đăng
  // Trường tool đã tách sẵn (nếu có) — ưu tiên hơn kết quả tự tách. Admin đăng hộ: trường admin sửa tay THẮNG bộ tách.
  phone?: string; salonName?: string; address?: string; city?: string; state?: string; zip?: string; market?: "US" | "AU"; salary?: string;
  title?: string; skills?: string[];
  fbUrl?: string; // Facebook người đăng — CHỈ dùng để nhận ra cùng 1 tiệm đăng lại (lưu dạng mã băm)
}
export interface IngestOpts {
  /** Admin đăng hộ THEO YÊU CẦU tiệm: chỉ bỏ qua bộ đoán "có phải bài tuyển" (SĐT bị chặn / bài bán tiệm / thợ tìm việc vẫn chặn). */
  assisted?: boolean;
}
// created = tin mới · bumped = tiệm ĐĂNG LẠI (đẩy lên đầu, repostCount+1) · updated = tool gửi lại đúng bài cũ
export type IngestResult = { status: "created" | "bumped" | "updated" | "skipped"; reason?: string; jobId?: string; repostCount?: number };

// Không nhớ id trong bộ nhớ máy chủ: tài khoản hệ thống có thể bị xoá / DB đổi → upsert mỗi lần tạo tin
// (chỉ khi TẠO tin mới, rẻ) thay vì giữ id cũ gây lỗi khoá ngoại tới khi máy chủ khởi động lại.
async function ingestOwnerId() {
  const u = await prisma.user.upsert({
    where: { email: INGEST_OWNER_EMAIL },
    update: {},
    create: { email: INGEST_OWNER_EMAIL, name: "PawNail · Tin tổng hợp", role: "OWNER", password: OAUTH_PASSWORD_PREFIX + crypto.randomBytes(24).toString("hex"), market: "US", state: "CA", city: "—", emailDigest: false },
    select: { id: true },
  });
  return u.id;
}

const blockedKey = "ingest_blocked_phones";
export async function blockedPhones(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await getSetting(blockedKey)) || "[]")); } catch { return new Set(); }
}
export async function blockPhone(e164: string) {
  const s = await blockedPhones();
  s.add(e164);
  await setSetting(blockedKey, JSON.stringify([...s].slice(-20000)));
}

/** Link Facebook người đăng → mã băm ổn định (bỏ http/www/m., dấu / cuối, tham số rác; giữ ?id= của profile.php). */
export function fbKey(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(u.hostname)) return null;
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const id = path === "/profile.php" ? u.searchParams.get("id") : null;
    const key = id ? `id:${id}` : path ? `p:${path}` : null;
    return key ? crypto.createHash("sha256").update(key).digest("hex") : null;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 300);
const clean = (s?: string, n = 80) => (typeof s === "string" ? s.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n) : "");
/** Mã bang có đúng của thị trường đó không (tin Mỹ không được mang bang "VIC"). */
export const validState = (market: "US" | "AU" | null, st: string | null | undefined) => !!market && !!st && (market === "AU" ? AU_ALL_CODES : US_ALL_CODES).includes(st);

export type IngestData = {
  title: string; salonName: string; description: string; market: "US" | "AU"; state: string; city: string; salaryType: string; salaryAmount: string;
  skills: string; benefits: string; phone: string; isUrgent: boolean; source: string; sourceUrl: string | null; sourceKey: string;
  sourcePostedAt: Date; expiresAt: Date; address: string | null; zip: string | null;
};
export type PreparedIngest =
  | { status: "ok"; data: IngestData; parsed: ParsedJob; fbHash: string | null; posted: Date }
  | { status: "skipped"; reason: string; parsed: ParsedJob };

/** Tách + kiểm tra 1 bài (KHÔNG đọc / ghi DB). Trả lý do bỏ qua, hoặc dữ liệu tin sẵn sàng lưu. */
export function prepareIngest(input: IngestInput, blocked: Set<string>, opts: IngestOpts = {}): PreparedIngest {
  // NFKC: chữ in đậm kiểu Facebook ("𝗖𝗔̂̀𝗡 𝗧𝗛𝗢̛̣") / tiếng Việt tổ hợp (NFD) → chữ thường — lưu luôn bản NFKC để bộ lọc hiển thị khớp.
  const text = clean(input.text, 4000) ? String(input.text).normalize("NFKC").replace(/[<>]/g, "").slice(0, 4000) : "";
  const p: ParsedJob = parseJobPost(text);
  const assisted = !!opts.assisted;
  // Ưu tiên trường tool đã tách
  const ph = input.phone ? findPhone(String(input.phone)) ?? findPhone(String(input.phone).replace(/^\+?1?/, "")) : null;
  const phone = ph?.e164 ?? p.phone;
  const phoneDisplay = ph?.display ?? p.phoneDisplay;
  const market0 = (input.market === "AU" || input.market === "US" ? input.market : null) ?? ph?.market ?? p.market;
  // Bài không ghi bang / thành phố → đoán bang từ mã vùng SĐT (Mỹ 281 → TX, 714 → CA…; số bàn Úc 02 → NSW, 03 → VIC, 07 → QLD)
  const stateFromPhone = market0 === "AU" ? stateFromAuPhone(phone) : stateFromUsPhone(phone);
  const market = market0 ?? (stateFromPhone ? "US" : null);
  // Bang phải thuộc đúng thị trường; bang sai (tool gửi "VIC" cho tin Mỹ) → thử bang tự tách → mã vùng SĐT
  const state = [clean(input.state, 3).toUpperCase(), p.state].find((st) => validState(market, st)) || (validState(market, stateFromPhone) ? stateFromPhone : null);
  const city = cleanCity(clean(input.city, 60) || p.city || "");
  // Tên tiệm ghi trong bài ("… Nails") đáng tin hơn tên người đăng mà tool gửi kèm; admin sửa tay thì theo admin.
  const salonName = assisted ? clean(input.salonName, 60) || p.salonName || "" : p.salonName || clean(input.salonName, 60);

  if (text && p.isSale) return { status: "skipped", reason: "bài sang / bán tiệm, không phải tuyển thợ", parsed: p };
  if (text && !p.isHiring && !input.salonName && !assisted) return { status: "skipped", reason: "không phải bài tuyển thợ", parsed: p };
  // Tool gửi kèm tên tiệm nhưng thật ra là bài THỢ TÌM VIỆC ("chủ shop nào cần thợ để lại sđt") → bỏ.
  if (text && isJobSeeking(text)) return { status: "skipped", reason: "bài thợ tìm việc, không phải tiệm tuyển", parsed: p };
  if (text && isAdPost(text)) return { status: "skipped", reason: "quảng cáo dịch vụ đăng tin, không phải tiệm tuyển", parsed: p };
  if (!phone || !phoneDisplay) return { status: "skipped", reason: "không có SĐT Mỹ/Úc", parsed: p };
  if (!market || !state) return { status: "skipped", reason: "không xác định được bang", parsed: p };
  if (blocked.has(phone)) return { status: "skipped", reason: "tiệm đã yêu cầu gỡ tin", parsed: p };

  const postedMs = input.postedAt ? new Date(typeof input.postedAt === "number" ? input.postedAt : String(input.postedAt)).getTime() : Date.now();
  const posted = Number.isFinite(postedMs) ? new Date(Math.min(postedMs, Date.now())) : new Date();
  const expiresAt = new Date(posted.getTime() + ingestTtlDays() * DAY);
  if (expiresAt.getTime() <= Date.now()) return { status: "skipped", reason: `bài cũ hơn ${ingestTtlDays()} ngày`, parsed: p };

  const sourceKey = crypto.createHash("sha1").update(`${phone}|${norm(text || `${salonName}|${city}`)}`).digest("hex");
  const fbHash = fbKey(input.fbUrl);
  // Lương: ưu tiên bộ tách của PawNail; lương tool gửi kèm chỉ dùng khi trông đúng là lương (không phải mảnh SĐT, tiền thuê…).
  // Admin đăng hộ ghi lương tay → dùng lương admin.
  const adminSalary = assisted ? clean(input.salary, 40) : "";
  const salary = adminSalary || (p.salaryAmount !== "Thỏa thuận" ? "" : safeToolSalary(clean(input.salary, 40), text) ?? "");
  // Kỹ năng tool đã gắn ("Thợ Bột / Acrylic", "Chân Tay Nước"…) → chuẩn PawNail, gộp với kỹ năng tự tách
  const toolSkills = Array.isArray(input.skills) ? parseJobPost(`cần thợ ${input.skills.join(", ")}`).skills : [];
  const skills = [...new Set([...toolSkills, ...p.skills])];
  const data: IngestData = {
    // Tiêu đề PawNail tự tạo (đồng nhất, gọn) — tiêu đề tool gửi kèm thường lẫn chữ thừa.
    title: `Cần thợ ${skills.length ? skills.slice(0, 2).join("/") : "Nail"}${p.isUrgent ? " gấp" : ""}`,
    salonName: cleanSalonName(salonName, city, state),
    description: text || [salonName, input.address, salary].filter(Boolean).join(" · "),
    market, state, city,
    salaryType: p.salaryType,
    salaryAmount: salary || p.salaryAmount,
    skills: skills.join(","),
    benefits: p.benefits.join(","),
    phone: phoneDisplay,
    isUrgent: p.isUrgent,
    source: assisted ? ASSISTED_SOURCE : INGEST_SOURCE,
    sourceUrl: clean(input.sourceUrl, 300) || null,
    sourceKey,
    sourcePostedAt: posted,
    expiresAt,
    address: clean(input.address, 160) || p.address,
    zip: clean(input.zip, 10) || p.zip,
  };
  return { status: "ok", data, parsed: p, fbHash, posted };
}

/** Lưu tin đã chuẩn bị (chống trùng theo SĐT / nội dung / Facebook người đăng). dryRun → chỉ đọc, trả quyết định sẽ xảy ra. */
export async function commitIngest(prep: Extract<PreparedIngest, { status: "ok" }>, opts: { dryRun?: boolean } = {}): Promise<IngestResult> {
  const { data, fbHash, posted } = prep;
  // Tiệm đã TỰ đăng tin trên PawNail (đã nhận tin / có tài khoản) → không thêm bản đăng hộ trùng
  const own = await prisma.job.findFirst({ where: { source: null, phone: data.phone, ...activeJobWhere() }, select: { id: true } });
  if (own) return { status: "skipped", reason: "tiệm đã tự đăng tin trên PawNail", jobId: own.id };

  // Cùng tiệm (cùng SĐT, hoặc cùng Facebook người đăng) đã có tin → KHÔNG tạo bản mới:
  //   - tool gửi lại ĐÚNG bài cũ (cùng link bài / cùng nội dung) → chỉ cập nhật
  //   - tiệm ĐĂNG LẠI bài mới → đẩy lên đầu, repostCount + 1, lastRepostedAt = bây giờ, nội dung mới nhất
  const same = await prisma.job.findFirst({
    where: { source: { in: [INGEST_SOURCE, ASSISTED_SOURCE] }, OR: [{ sourceKey: data.sourceKey }, { phone: data.phone }, ...(fbHash ? [{ sourceFbHash: fbHash }] : [])] },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceUrl: true, sourceKey: true, repostCount: true },
  });
  if (same) {
    const samePost = data.sourceUrl ? same.sourceUrl === data.sourceUrl : same.sourceKey === data.sourceKey;
    if (samePost) {
      if (!opts.dryRun) await prisma.job.update({ where: { id: same.id }, data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}) } });
      return { status: "updated", jobId: same.id, repostCount: same.repostCount };
    }
    if (opts.dryRun) return { status: "bumped", jobId: same.id, repostCount: same.repostCount + 1 };
    const now = new Date();
    const j = await prisma.job.update({
      where: { id: same.id },
      data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}), createdAt: posted, lastRepostedAt: now, repostCount: { increment: 1 } },
      select: { repostCount: true },
    });
    return { status: "bumped", jobId: same.id, repostCount: j.repostCount };
  }
  if (opts.dryRun) return { status: "created", repostCount: 1 };
  const job = await prisma.job.create({ data: { ...data, sourceFbHash: fbHash, repostCount: 1, ownerId: await ingestOwnerId(), createdAt: posted }, select: { id: true } });
  return { status: "created", jobId: job.id, repostCount: 1 };
}

export async function ingestOne(input: IngestInput, blocked: Set<string>, opts: IngestOpts & { dryRun?: boolean } = {}): Promise<IngestResult> {
  const prep = prepareIngest(input, blocked, opts);
  if (prep.status === "skipped") return { status: "skipped", reason: prep.reason };
  return commitIngest(prep, { dryRun: opts.dryRun });
}

export async function ingestBatch(items: IngestInput[], opts: IngestOpts = {}) {
  const blocked = await blockedPhones();
  const results: (IngestResult & { i: number })[] = [];
  for (const [i, it] of items.entries()) {
    try { results.push({ i, ...(await ingestOne(it, blocked, opts)) }); }
    catch (e) { results.push({ i, status: "skipped", reason: `lỗi: ${String((e as Error).message).slice(0, 80)}` }); }
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  if (!opts.assisted) await recordIngestHeartbeat(results); // admin đăng hộ không tính là nguồn tin tổng hợp
  return { created: count("created"), bumped: count("bumped"), updated: count("updated"), skipped: count("skipped"), results };
}

/** Nhịp tim nguồn tin tổng hợp (tool lọc nhóm): ghi mỗi lô đúng khoá; ghi "lần cuối nhận tin" khi ≥ 1 bài được nhận. */
export async function recordIngestHeartbeat(results: { status: string }[], now = new Date()) {
  if (!results.length) return;
  const at = now.toISOString();
  await setSetting(INGEST_LAST_BATCH_AT_KEY, at).catch(() => {});
  if (results.some((r) => r.status !== "skipped")) await setSetting(INGEST_LAST_AT_KEY, at).catch(() => {});
}

/** Cho trang admin: lần cuối nhận tin / nhận lô, và có quá INGEST_STALE_HOURS giờ không có tin mới không. */
export async function ingestHeartbeat(now = new Date()) {
  const [lastAt, lastBatchAt] = await Promise.all([getSetting(INGEST_LAST_AT_KEY).catch(() => null), getSetting(INGEST_LAST_BATCH_AT_KEY).catch(() => null)]);
  const t = lastAt ? Date.parse(lastAt) : NaN;
  const stale = !Number.isFinite(t) || now.getTime() - t > INGEST_STALE_HOURS * 3_600_000;
  return { lastAt, lastBatchAt, stale, staleHours: INGEST_STALE_HOURS };
}
