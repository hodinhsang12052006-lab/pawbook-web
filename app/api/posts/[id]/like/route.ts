import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// POST /api/posts/[id]/like — toggle thả tim (like/unlike). Idempotent theo
// ý nghĩa: gọi lại nhiều lần chỉ đảo trạng thái, không tích lũy nhiều like
// từ cùng 1 người (@@unique([postId, userId]) chốt chặn ở DB).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để thả tim." }, { status: 401 });
    }
    const { id: postId } = await params;

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: session.user.id } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
    } else {
      // Bài viết có thể đã bị xóa giữa lúc người dùng đang xem — bắt lỗi FK
      // trả 404 thay vì 500 mù mờ.
      try {
        await prisma.postLike.create({ data: { postId, userId: session.user.id } });
      } catch {
        return NextResponse.json({ error: "Bài viết không còn tồn tại." }, { status: 404 });
      }
    }

    const likeCount = await prisma.postLike.count({ where: { postId } });
    return NextResponse.json({ liked: !existing, likeCount });
  } catch (error) {
    console.error("POST /api/posts/[id]/like error:", error);
    return NextResponse.json({ error: "Không thể cập nhật lượt thích." }, { status: 500 });
  }
}
