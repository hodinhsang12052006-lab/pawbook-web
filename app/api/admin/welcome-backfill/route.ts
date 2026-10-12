import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { backfillWelcomeChats } from "@/lib/welcomeChat";

// POST /api/admin/welcome-backfill — CHỈ ADMIN: bù tin "📋 Thông tin đăng ký" + lời cảm ơn cho người
// dùng đăng ký trước khi có tin chào tự động (ai đã có cuộc trò chuyện với PawNail thì bỏ qua — chạy lại an toàn).
export const maxDuration = 60;

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await backfillWelcomeChats();
  return NextResponse.json(r);
}
