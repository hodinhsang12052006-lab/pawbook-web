// ĐĂNG NHẬP / ĐĂNG KÝ BẰNG SỐ ĐIỆN THOẠI (mã SMS qua Twilio Verify).
//   1) POST /api/auth/phone/start { phone, market } → gửi mã (chỉ số Mỹ +1 / Úc +61)
//   2) signIn("phone-otp", { phone, market, code }) → đúng mã:
//        - số đã xác minh trước đó → vào đúng tài khoản đó
//        - số mới → tạo tài khoản, qua /auth/complete chọn vai trò + khu vực (như Google)
// Chống "bơm SMS" đốt tiền: đếm trong DB (máy chủ serverless không chung bộ nhớ).
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { OAUTH_PASSWORD_PREFIX } from "@/lib/oauthUsers";
import { checkCode, toE164 } from "@/lib/sms";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Email giữ chỗ cho tài khoản chỉ có SĐT — đuôi .invalid (không bao giờ gửi được thư). */
export const PHONE_EMAIL_SUFFIX = "@phone.invalid";
export const isPhoneOnlyEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith(PHONE_EMAIL_SUFFIX);
export const SMS_DAILY_CAP = () => Math.max(1, Number(process.env.SMS_DAILY_CAP) || 300);

export function normalizePhone(raw: unknown, market: unknown) {
  return toE164(typeof raw === "string" ? raw : "", market === "AU" ? "AU" : "US");
}

/** null = được gửi; chuỗi = lý do từ chối. */
export async function smsQuota(phone: string, ip: string): Promise<string | null> {
  const now = Date.now();
  const [perPhoneHour, perPhoneDay, perIpDay, all] = await Promise.all([
    prisma.smsSend.count({ where: { phone, createdAt: { gte: new Date(now - HOUR) } } }),
    prisma.smsSend.count({ where: { phone, createdAt: { gte: new Date(now - DAY) } } }),
    prisma.smsSend.count({ where: { ip, createdAt: { gte: new Date(now - DAY) } } }),
    prisma.smsSend.count({ where: { createdAt: { gte: new Date(now - DAY) } } }),
  ]);
  if (perPhoneHour >= 3 || perPhoneDay >= 5) return "Số này đã nhận mã nhiều lần — thử lại sau ít phút nữa.";
  if (perIpDay >= 10) return "Bạn đã yêu cầu mã quá nhiều lần hôm nay — thử lại ngày mai hoặc đăng nhập bằng email.";
  if (all >= SMS_DAILY_CAP()) return "Hệ thống gửi SMS đang tạm nghỉ — vui lòng đăng nhập bằng email hoặc Google.";
  return null;
}

export const logSms = (phone: string, ip: string, purpose = "login") => prisma.smsSend.create({ data: { phone, ip, purpose } });

/** Kiểm mã + tìm/tạo tài khoản. Trả về user cho NextAuth, hoặc null nếu mã sai. */
export async function authorizePhone(rawPhone: unknown, market: unknown, rawCode: unknown) {
  const phone = normalizePhone(rawPhone, market);
  const code = String(rawCode ?? "").trim();
  if (!phone || !/^\d{4,10}$/.test(code)) return null;
  if (!(await checkCode(phone, code))) return null;

  // Số ĐÃ XÁC MINH (qua SMS) mới được dùng để vào tài khoản — số chỉ gõ trong hồ sơ thì không.
  const pv = await prisma.phoneVerification.findFirst({ where: { phone }, orderBy: { verifiedAt: "desc" }, select: { userId: true } });
  if (pv) {
    const u = await prisma.user.findUnique({ where: { id: pv.userId }, select: { id: true, name: true, email: true, role: true, password: true, state: true } });
    if (u) {
      await prisma.phoneVerification.update({ where: { userId: u.id }, data: { verifiedAt: new Date() } }).catch(() => null);
      return { id: u.id, name: u.name, email: u.email, role: u.role, onb: !!u.password?.startsWith(OAUTH_PASSWORD_PREFIX) && !u.state };
    }
  }
  const digits = phone.replace(/\D/g, "");
  const email = `p${digits}${PHONE_EMAIL_SUFFIX}`;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, password: true, state: true } });
  const u =
    existing ??
    (await prisma.user.create({
      data: { email, name: "Thành viên PawNail", password: OAUTH_PASSWORD_PREFIX + crypto.randomBytes(24).toString("hex"), role: "TECHNICIAN", phone, market: phone.startsWith("+61") ? "AU" : "US" },
      select: { id: true, name: true, email: true, role: true, password: true, state: true },
    }));
  await prisma.phoneVerification.upsert({ where: { userId: u.id }, update: { phone, verifiedAt: new Date() }, create: { userId: u.id, phone } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, onb: !!u.password?.startsWith(OAUTH_PASSWORD_PREFIX) && !u.state };
}
