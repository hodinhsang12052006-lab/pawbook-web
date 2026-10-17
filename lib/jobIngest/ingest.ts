// NHẬN TIN TỔNG HỢP từ tool lọc nhóm → tin tuyển trên PawNail.
//   - Tách SĐT / tên tiệm / địa chỉ / bang / lương… (parse.ts); trường tool đã tách sẵn được ưu tiên.
//   - Chống trùng: cùng SĐT + nội dung (sourceKey) hoặc cùng SĐT còn hạn → CẬP NHẬT tin cũ.
//   - Tự hết hạn sau INGEST_TTL_DAYS (mặc định 14) kể từ ngày bài gốc đăng.
//   - Số đã yêu cầu "Gỡ tin" (admin duyệt) → không bao giờ đăng lại.
// Tất cả tin đứng tên 1 tài khoản hệ thống "PawNail · Tin tổng hợp" (KHÔNG tạo tài khoản mạo danh từng tiệm).
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { OAUTH_PASSWORD_PREFIX } from "@/lib/oauthUsers";
import { getSetting, setSetting } from "@/lib/settings";
import { stateFromUsPhone } from "@/lib/jobIngest/areaCodes";
import { cleanCity, cleanSalonName, findPhone, isAdPost, isJobSeeking, isSalonSale, parseJobPost, safeToolSalary, type ParsedJob } from "@/lib/jobIngest/parse";

export const INGEST_SOURCE = "ingest";
export const INGEST_OWNER_EMAIL = "tonghop@feed.pawnail.invalid";
const DAY = 86_400_000;
export const ingestTtlDays = () => Math.min(60, Math.max(3, Number(process.env.INGEST_TTL_DAYS) || 14));

// Bài SANG / BÁN tiệm mà tool từng gửi lẫn vào (trước 17/10/2026 chưa lọc) — ẩn khỏi mục Việc làm.
// Chỉ áp cho tin TỔNG HỢP (source = ingest); tin chủ tiệm tự đăng không bao giờ bị ẩn theo chữ.
// (SQLite so khớp không phân biệt hoa/thường với chữ Latin, CÓ phân biệt với chữ có dấu → liệt kê đủ kiểu viết.)
const SALE_WORDS = ["sang tiệm", "Sang tiệm", "SANG TIỆM", "cần sang", "Cần sang", "CẦN SANG", "bán tiệm", "Bán tiệm", "BÁN TIỆM", "cần bán", "Cần bán", "CẦN BÁN", "giá sang", "Giá sang", "GIÁ SANG", "nhận cọc", "Nhận cọc", "for sale"];
// Bài THỢ TÌM VIỆC lọt vào trước khi có bộ lọc isJobSeeking (17/10/2026) — ẩn lúc hiển thị (không xoá).
const SEEK_WORDS = ["Góc tìm việc", "góc tìm việc", "GÓC TÌM VIỆC", "chủ shop nào cần thợ", "Chủ shop nào cần thợ", "Vietnailshelper", "trải nghiệm dịch vụ", "dịch vụ đăng tin"];
/** Điều kiện Prisma: tin còn hạn (tin chủ tiệm tự đăng không có hạn), không phải bài sang / bán tiệm. */
export const activeJobWhere = () => ({
  AND: [
    { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    // Viết dạng OR (không dùng NOT(a AND b)): source NULL → so sánh SQL ra NULL, NOT(NULL) sẽ ẩn nhầm tin tự đăng.
    { OR: [{ source: null }, { source: { not: "ingest" } }, { NOT: { OR: [...SALE_WORDS, ...SEEK_WORDS].map((w) => ({ description: { contains: w } })) } }] },
  ],
});

export interface IngestInput {
  text?: string; // nguyên văn bài
  sourceUrl?: string;
  postedAt?: string | number; // ISO / ms — ngày bài gốc đăng
  // Trường tool đã tách sẵn (nếu có) — ưu tiên hơn kết quả tự tách
  phone?: string; salonName?: string; address?: string; city?: string; state?: string; zip?: string; market?: "US" | "AU"; salary?: string;
  title?: string; skills?: string[];
  fbUrl?: string; // Facebook người đăng — CHỈ dùng để nhận ra cùng 1 tiệm đăng lại (lưu dạng mã băm)
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

export async function ingestOne(input: IngestInput, blocked: Set<string>): Promise<IngestResult> {
  const text = clean(input.text, 4000) ? String(input.text).replace(/[<>]/g, "").slice(0, 4000) : "";
  const p: ParsedJob = parseJobPost(text);
  // Ưu tiên trường tool đã tách
  const ph = input.phone ? findPhone(String(input.phone)) ?? findPhone(String(input.phone).replace(/^\+?1?/, "")) : null;
  const phone = ph?.e164 ?? p.phone;
  const phoneDisplay = ph?.display ?? p.phoneDisplay;
  const market0 = (input.market === "AU" || input.market === "US" ? input.market : null) ?? ph?.market ?? p.market;
  // Bài không ghi bang / thành phố → đoán bang từ mã vùng SĐT Mỹ (281 → TX, 714 → CA…)
  const stateFromPhone = market0 !== "AU" ? stateFromUsPhone(phone) : null;
  const state = clean(input.state, 3).toUpperCase() || p.state || stateFromPhone;
  const market = market0 ?? (stateFromPhone ? "US" : null);
  const city = cleanCity(clean(input.city, 60) || p.city || "");
  // Tên tiệm ghi trong bài ("… Nails") đáng tin hơn tên người đăng mà tool gửi kèm.
  const salonName = p.salonName || clean(input.salonName, 60);

  if (text && p.isSale) return { status: "skipped", reason: "bài sang / bán tiệm, không phải tuyển thợ" };
  if (text && !p.isHiring && !input.salonName) return { status: "skipped", reason: "không phải bài tuyển thợ" };
  // Tool gửi kèm tên tiệm nhưng thật ra là bài THỢ TÌM VIỆC ("chủ shop nào cần thợ để lại sđt") → bỏ.
  if (text && isJobSeeking(text)) return { status: "skipped", reason: "bài thợ tìm việc, không phải tiệm tuyển" };
  if (text && isAdPost(text)) return { status: "skipped", reason: "quảng cáo dịch vụ đăng tin, không phải tiệm tuyển" };
  if (!phone || !phoneDisplay) return { status: "skipped", reason: "không có SĐT Mỹ/Úc" };
  if (!market || !state) return { status: "skipped", reason: "không xác định được bang" };
  if (blocked.has(phone)) return { status: "skipped", reason: "tiệm đã yêu cầu gỡ tin" };

  const postedMs = input.postedAt ? new Date(typeof input.postedAt === "number" ? input.postedAt : String(input.postedAt)).getTime() : Date.now();
  const posted = Number.isFinite(postedMs) ? new Date(Math.min(postedMs, Date.now())) : new Date();
  const expiresAt = new Date(posted.getTime() + ingestTtlDays() * DAY);
  if (expiresAt.getTime() <= Date.now()) return { status: "skipped", reason: `bài cũ hơn ${ingestTtlDays()} ngày` };

  const sourceKey = crypto.createHash("sha1").update(`${phone}|${norm(text || `${salonName}|${city}`)}`).digest("hex");
  const fbHash = fbKey(input.fbUrl);
  // Lương: ưu tiên bộ tách của PawNail; lương tool gửi kèm chỉ dùng khi trông đúng là lương (không phải mảnh SĐT, tiền thuê…)
  const salary = p.salaryAmount !== "Thỏa thuận" ? "" : safeToolSalary(clean(input.salary, 40), text) ?? "";
  // Kỹ năng tool đã gắn ("Thợ Bột / Acrylic", "Chân Tay Nước"…) → chuẩn PawNail, gộp với kỹ năng tự tách
  const toolSkills = Array.isArray(input.skills) ? parseJobPost(`cần thợ ${input.skills.join(", ")}`).skills : [];
  const skills = [...new Set([...toolSkills, ...p.skills])];
  const data = {
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
    source: INGEST_SOURCE,
    sourceUrl: clean(input.sourceUrl, 300) || null,
    sourceKey,
    sourcePostedAt: posted,
    expiresAt,
    address: clean(input.address, 160) || p.address,
    zip: clean(input.zip, 10) || p.zip,
  };

  // Tiệm đã TỰ đăng tin trên PawNail (đã nhận tin / có tài khoản) → không thêm bản đăng hộ trùng
  const own = await prisma.job.findFirst({ where: { source: null, phone: phoneDisplay, ...activeJobWhere() }, select: { id: true } });
  if (own) return { status: "skipped", reason: "tiệm đã tự đăng tin trên PawNail", jobId: own.id };

  // Cùng tiệm (cùng SĐT, hoặc cùng Facebook người đăng) đã có tin → KHÔNG tạo bản mới:
  //   - tool gửi lại ĐÚNG bài cũ (cùng link bài / cùng nội dung) → chỉ cập nhật
  //   - tiệm ĐĂNG LẠI bài mới → đẩy lên đầu, repostCount + 1, lastRepostedAt = bây giờ, nội dung mới nhất
  const same = await prisma.job.findFirst({
    where: { source: INGEST_SOURCE, OR: [{ sourceKey }, { phone: phoneDisplay }, ...(fbHash ? [{ sourceFbHash: fbHash }] : [])] },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceUrl: true, sourceKey: true, repostCount: true },
  });
  if (same) {
    const samePost = data.sourceUrl ? same.sourceUrl === data.sourceUrl : same.sourceKey === sourceKey;
    if (samePost) {
      await prisma.job.update({ where: { id: same.id }, data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}) } });
      return { status: "updated", jobId: same.id, repostCount: same.repostCount };
    }
    const now = new Date();
    const j = await prisma.job.update({
      where: { id: same.id },
      data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}), createdAt: posted, lastRepostedAt: now, repostCount: { increment: 1 } },
      select: { repostCount: true },
    });
    return { status: "bumped", jobId: same.id, repostCount: j.repostCount };
  }
  const job = await prisma.job.create({ data: { ...data, sourceFbHash: fbHash, repostCount: 1, ownerId: await ingestOwnerId(), createdAt: posted }, select: { id: true } });
  return { status: "created", jobId: job.id, repostCount: 1 };
}

export async function ingestBatch(items: IngestInput[]) {
  const blocked = await blockedPhones();
  const results: (IngestResult & { i: number })[] = [];
  for (const [i, it] of items.entries()) {
    try { results.push({ i, ...(await ingestOne(it, blocked)) }); }
    catch (e) { results.push({ i, status: "skipped", reason: `lỗi: ${String((e as Error).message).slice(0, 80)}` }); }
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return { created: count("created"), bumped: count("bumped"), updated: count("updated"), skipped: count("skipped"), results };
}
