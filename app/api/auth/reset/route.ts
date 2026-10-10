import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// POST { token, password } — đặt mật khẩu mới bằng link trong email.
// Mã hết hạn / đã dùng / sai → từ chối. Thành công: đánh dấu đã dùng + huỷ mọi
// link khác còn hiệu lực của tài khoản đó.
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || token.length > 200) return NextResponse.json({ error: "Link không hợp lệ." }, { status: 400 });
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Mật khẩu cần từ 8 đến 128 ký tự." }, { status: 400 });
  }

  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới." }, { status: 410 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { password: hashed } }),
    prisma.passwordReset.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  return NextResponse.json({ ok: true });
}
