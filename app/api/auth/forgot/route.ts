import { NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { emailEnabled, resetPasswordEmail, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/siteUrl";

// POST { email } — gửi link đặt lại mật khẩu.
// • Luôn trả CÙNG một câu trả lời dù email có tài khoản hay không (không để kẻ xấu
//   dò xem email nào đã đăng ký).
// • Mỗi email tối đa 3 link / giờ; giới hạn theo IP nằm ở proxy.ts.
// • Chỉ lưu HASH của mã; mã thật chỉ có trong link email. Hiệu lực 30 phút, dùng 1 lần.
const TTL_MS = 30 * 60_000;
const PER_HOUR = 3;
const OK = { ok: true, message: "Nếu email này có tài khoản PawNail, chúng tôi vừa gửi link đặt lại mật khẩu. Kiểm tra hộp thư (cả mục Spam)." };

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  if (!emailEnabled()) {
    return NextResponse.json({ error: "Tính năng gửi email chưa được bật.", fallback: true }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return NextResponse.json(OK);

  const recent = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= PER_HOUR) return NextResponse.json(OK); // im lặng, không gửi thêm

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS) } });
  const link = `${SITE_URL}/auth/reset?token=${token}`;
  try {
    const m = resetPasswordEmail(user.name, link);
    await sendEmail(email, m.subject, m.html, m.text);
  } catch (err) {
    console.error("forgot-password email error:", (err as Error).message);
    // Vẫn trả câu chung — không để lộ trạng thái tài khoản qua lỗi gửi thư.
  }
  return NextResponse.json(OK);
}
