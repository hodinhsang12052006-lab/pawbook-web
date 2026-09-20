import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET /api/posts/[id]/comments — danh sách bình luận 1 bài viết, cũ→mới
// (đúng thứ tự đọc hội thoại), giới hạn 200 để tránh 1 bài viral kéo sập
// request.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const comments = await prisma.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(
      comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
      }))
    );
  } catch (error) {
    console.error("GET /api/posts/[id]/comments error:", error);
    return NextResponse.json({ error: "Không thể tải bình luận." }, { status: 500 });
  }
}

// POST /api/posts/[id]/comments — thêm bình luận mới.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để bình luận." }, { status: 401 });
    }
    const { id: postId } = await params;
    const body = await req.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Bình luận không được để trống." }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json({ error: "Bình luận quá dài (tối đa 500 ký tự)." }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) {
      return NextResponse.json({ error: "Bài viết không còn tồn tại." }, { status: 404 });
    }

    const comment = await prisma.postComment.create({
      data: { postId, authorId: session.user.id, content },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/posts/[id]/comments error:", error);
    return NextResponse.json({ error: "Không thể gửi bình luận." }, { status: 500 });
  }
}
