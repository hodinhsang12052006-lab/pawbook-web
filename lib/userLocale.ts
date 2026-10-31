// Ngôn ngữ của từng người dùng cho nội dung MÁY CHỦ gửi đi khi họ không mở trang (thông báo đẩy,
// email tóm tắt tuần, email đặt lại mật khẩu, tin chào mừng).
//
// Lưu trong bảng AppSetting có sẵn (khoá "user.locale:<id>") thay vì thêm cột User.locale: thêm cột
// cần chạy SQL lên Turso trước khi deploy, nếu quên thì MỌI truy vấn bảng User đều lỗi. Bảng
// AppSetting đã có trên production nên đổi này deploy an toàn, không cần migration.
//
// Ghi khi: đăng ký (ngôn ngữ của form), đổi VI/EN, và mỗi lần ngôn ngữ trang khác giá trị đã lưu
// (SessionUserContext → POST /api/me/locale). Chưa lưu → "en" (mặc định của nền tảng).
import prisma from "@/lib/prisma";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

const key = (userId: string) => `user.locale:${userId}`;

export async function getUserLocale(userId: string | null | undefined): Promise<Locale> {
  if (!userId) return DEFAULT_LOCALE;
  try {
    const v = (await prisma.appSetting.findUnique({ where: { key: key(userId) }, select: { value: true } }))?.value;
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Nhiều người một lần (thông báo đẩy hàng loạt, email tuần). Người chưa lưu → "en". */
export async function getUserLocales(userIds: string[]): Promise<Map<string, Locale>> {
  const out = new Map<string, Locale>();
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const id of ids) out.set(id, DEFAULT_LOCALE);
  if (!ids.length) return out;
  try {
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await prisma.appSetting.findMany({ where: { key: { in: ids.slice(i, i + 500).map(key) } }, select: { key: true, value: true } });
      for (const r of rows) if (isLocale(r.value)) out.set(r.key.slice("user.locale:".length), r.value);
    }
  } catch {
    // bảng chưa có (DB cũ) → mọi người dùng mặc định
  }
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
