import crypto from "crypto";
import prisma from "@/lib/prisma";

// Tài khoản tạo qua Google/Apple: mật khẩu là chuỗi đánh dấu "oauth:" (KHÔNG
// phải hash bcrypt → không ai đăng nhập bằng mật khẩu vào được). Chưa chọn
// vai trò/khu vực → bắt buộc qua /auth/complete trước khi dùng app.
export const OAUTH_PASSWORD_PREFIX = "oauth:";

export function needsOnboarding(u: { password: string | null; state: string | null }): boolean {
  return !!u.password?.startsWith(OAUTH_PASSWORD_PREFIX) && !u.state;
}

/** Tìm theo email (liên kết luôn tài khoản cũ cùng email đã xác minh), chưa có thì tạo mới. */
export async function findOrCreateOAuthUser(p: { email: string; name?: string | null; image?: string | null }) {
  const email = p.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, password: true, state: true } });
  if (existing) return existing;
  const name = (p.name || email.split("@")[0]).trim().slice(0, 80) || "Thành viên PawNail";
  // Ảnh từ Google (lh3.googleusercontent.com) không nằm trong CSP img-src → bỏ, dùng chữ cái đầu.
  return prisma.user.create({
    data: { email, name, password: OAUTH_PASSWORD_PREFIX + crypto.randomBytes(24).toString("hex"), role: "TECHNICIAN", avatarUrl: null },
    select: { id: true, role: true, password: true, state: true },
  });
}
