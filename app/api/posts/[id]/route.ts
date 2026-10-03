import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

// DELETE /api/posts/[id] — tác giả tự xóa bài của mình, hoặc ADMIN gỡ bài vi
// phạm (yêu cầu kiểm duyệt nội dung người dùng của App Store 1.2). Like và
// bình luận tự xóa theo (onDelete: Cascade).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const { id } = await params;

    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) {
      return NextResponse.json({ error: "Bài viết không tồn tại." }, { status: 404 });
    }

    if (post.authorId !== session.user.id) {
      // Không tin role trong JWT (có thể đã cũ) cho thao tác xóa nội dung
      // người khác — xác minh lại trong DB.
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (me?.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Bạn không có quyền xóa bài viết này." }, { status: 403 });
      }
    }

    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Không thể xóa bài viết." }, { status: 500 });
  }
}
