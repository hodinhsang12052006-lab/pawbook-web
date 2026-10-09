import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST /api/designs/:id/save — lưu / bỏ lưu mẫu (bấm lại để bỏ). Lượt lưu THẬT
// là tín hiệu xếp "mẫu hot" và chọn mẫu làm video.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { id } = await params;
  const design = await prisma.nailDesign.findFirst({ where: { id, status: "published" }, select: { id: true } });
  if (!design) return NextResponse.json({ error: "Không tìm thấy mẫu." }, { status: 404 });
  const key = { userId_designId: { userId, designId: id } };
  const existing = await prisma.nailDesignSave.findUnique({ where: key });
  if (existing) await prisma.nailDesignSave.delete({ where: key });
  else await prisma.nailDesignSave.create({ data: { userId, designId: id } });
  const saves = await prisma.nailDesignSave.count({ where: { designId: id } });
  return NextResponse.json({ saved: !existing, saves });
}
