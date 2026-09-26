import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST /api/jobs/[id]/save — lưu 1 tin tuyển dụng (bất kỳ role nào cũng lưu
// được, nhưng thực tế chỉ THỢ dùng — không khoá cứng role để giữ đơn giản,
// giống quy ước sẵn có của SupplyProduct).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      return NextResponse.json({ error: "Tin tuyển dụng không tồn tại." }, { status: 404 });
    }

    const saved = await prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {},
      create: { userId, jobId },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    console.error("Save job API error:", error);
    return NextResponse.json({ error: "Không thể lưu tin. Vui lòng thử lại." }, { status: 500 });
  }
}

// DELETE /api/jobs/[id]/save — bỏ lưu
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const { id: jobId } = await params;

    await prisma.savedJob.deleteMany({ where: { userId, jobId } });

    return NextResponse.json({ message: "Đã bỏ lưu tin." });
  } catch (error: any) {
    console.error("Unsave job API error:", error);
    return NextResponse.json({ error: "Không thể bỏ lưu tin. Vui lòng thử lại." }, { status: 500 });
  }
}
