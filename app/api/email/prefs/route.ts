import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// Bật/tắt email tóm tắt hằng tuần (mục Hồ sơ).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailDigest: true } });
  return NextResponse.json({ emailDigest: u?.emailDigest ?? true });
}
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { emailDigest?: unknown } | null;
  if (typeof body?.emailDigest !== "boolean") return NextResponse.json({ error: "emailDigest boolean required" }, { status: 400 });
  await prisma.user.update({ where: { id: session.user.id }, data: { emailDigest: body.emailDigest } });
  return NextResponse.json({ emailDigest: body.emailDigest });
}
