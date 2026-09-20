import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Tin tuyển dụng không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...job,
      skills: job.skills ? job.skills.split(",").filter(Boolean) : [],
      benefits: job.benefits ? job.benefits.split(",").filter(Boolean) : [],
      createdAt: job.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Fetch job detail API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy chi tiết tin tuyển dụng." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const job = await prisma.job.findUnique({ where: { id }, select: { ownerId: true } });
    const isOwner = job?.ownerId === (session.user as any).id;
    const isAdmin = (session.user as any).role === "ADMIN";

    if (!job) {
      return NextResponse.json({ error: "Tin tuyển dụng không tồn tại." }, { status: 404 });
    }
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Bạn không có quyền xóa tin này." }, { status: 403 });
    }

    await prisma.job.delete({ where: { id } });

    return NextResponse.json({ message: "Xóa tin tuyển dụng thành công!" });
  } catch (error: any) {
    console.error("Delete job API error:", error);
    return NextResponse.json(
      { error: "Không thể xóa tin. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
