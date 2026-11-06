// Ngôn ngữ của từng người dùng cho nội dung MÁY CHỦ gửi đi khi họ không mở trang (thông báo đẩy,
// email tóm tắt tuần, email đặt lại mật khẩu, tin chào mừng).
//
// Lưu trong bảng AppSetting có sẵn (khoá "user.locale:<id>") thay vì thêm cột User.locale: thêm cột
// cần chạy SQL lên Turso trước khi deploy, nếu quên thì MỌI truy vấn bảng User đều lỗi. Bảng
// AppSetting đã có trên production nên đổi này deploy an toàn, không cần migration.
//
// Ghi khi: đăng ký (ngôn ngữ của form), đổi VI/EN, và mỗi lần ngôn ngữ trang khác giá trị đã lưu
// (SessionUserContext → POST /api/me/locale).
//
// CHƯA lưu → SUY ĐOÁN thay vì mặc định "en": ngay sau khi bản tiếng-Anh-trước lên production, mọi thành viên cũ
// (đa số thợ / chủ tiệm nói tiếng Việt, đăng ký khi app còn mặc định tiếng Việt) chưa có giá trị lưu cho tới khi
// mở lại app — nếu mặc định "en" thì thông báo việc gấp, đánh giá, email tuần của họ đột nhiên thành tiếng Anh.
//   - tên / giới thiệu có chữ tiếng Việt → "vi"
//   - tài khoản tạo TRƯỚC mốc EN_FIRST_SINCE (bản tiếng-Anh-trước) → "vi"
//   - còn lại → "en"
// Tài khoản tạo sau mốc đó luôn có giá trị lưu từ lúc đăng ký (app/api/register, /auth/complete).
import prisma from "@/lib/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { hasVietnamese } from "@/lib/i18n/viText";

const key = (userId: string) => `user.locale:${userId}`;
/** Mốc phát hành bản tiếng-Anh-trước (ghi đè bằng biến môi trường EN_FIRST_SINCE khi deploy). */
const EN_FIRST_SINCE = () => new Date(process.env.EN_FIRST_SINCE || "2026-12-01T00:00:00Z").getTime();

type Hint = { createdAt: Date; name: string | null; technicianProfile?: { bio: string | null } | null };
export function inferLocale(u: Hint | null | undefined): Locale {
  if (!u) return "en";
  if (hasVietnamese(u.name) || hasVietnamese(u.technicianProfile?.bio)) return "vi";
  return u.createdAt.getTime() < EN_FIRST_SINCE() ? "vi" : "en";
}
const HINT_SELECT = { id: true, createdAt: true, name: true, technicianProfile: { select: { bio: true } } } as const;

export async function getUserLocale(userId: string | null | undefined): Promise<Locale> {
  if (!userId) return "en";
  try {
    const v = (await prisma.appSetting.findUnique({ where: { key: key(userId) }, select: { value: true } }))?.value;
    if (isLocale(v)) return v;
    return inferLocale(await prisma.user.findUnique({ where: { id: userId }, select: HINT_SELECT }));
  } catch {
    return "en";
  }
}

/** Nhiều người một lần (thông báo đẩy hàng loạt, email tuần). Người chưa lưu → suy đoán (inferLocale). */
export async function getUserLocales(userIds: string[]): Promise<Map<string, Locale>> {
  const out = new Map<string, Locale>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return out;
  try {
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await prisma.appSetting.findMany({ where: { key: { in: ids.slice(i, i + 500).map(key) } }, select: { key: true, value: true } });
      for (const r of rows) if (isLocale(r.value)) out.set(r.key.slice("user.locale:".length), r.value);
    }
  } catch {
    // bảng chưa có (DB cũ) → suy đoán cho tất cả
  }
  const missing = ids.filter((id) => !out.has(id));
  try {
    for (let i = 0; i < missing.length; i += 500) {
      const users = await prisma.user.findMany({ where: { id: { in: missing.slice(i, i + 500) } }, select: HINT_SELECT });
      for (const u of users) out.set(u.id, inferLocale(u));
    }
  } catch {}
  for (const id of ids) if (!out.has(id)) out.set(id, "en");
  return out;
}

export async function setUserLocale(userId: string, locale: Locale): Promise<void> {
  if (!userId || !isLocale(locale)) return;
  try {
    await prisma.appSetting.upsert({ where: { key: key(userId) }, update: { value: locale }, create: { key: key(userId), value: locale } });
  } catch (err) {
    console.error("setUserLocale error:", err);
  }
}

/** Chọn chuỗi theo ngôn ngữ người nhận. */
export const pick = (locale: Locale, vi: string, en: string) => (locale === "vi" ? vi : en);
