import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST — ghi nhận người dùng đã cài app lên màn hình chính (để đo hiệu quả nút "Cài app").
// Chỉ ghi lần đầu; gọi lại không đổi gì.
export async function POST() {
  const id = (await getServerSession(authOptions))?.user?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  await prisma.user.updateMany({ where: { id, pwaInstalledAt: null }, data: { pwaInstalledAt: new Date() } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
