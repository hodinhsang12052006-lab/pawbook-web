import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Công việc không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error("Fetch job detail API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy chi tiết công việc." },
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
    const isDev = process.env.NODE_ENV === "development";
    const isAdmin = session?.user && (session.user as any).role === "ADMIN";

    if (!isDev && !isAdmin) {
      return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền thực hiện hành động này." }, { status: 403 });
    }

    const { id } = await params;

    // Delete job from database
    await prisma.job.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Xóa công việc thành công!" });
  } catch (error: any) {
    console.error("Delete job API error:", error);
    return NextResponse.json(
      { error: "Không thể xóa bài đăng. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
