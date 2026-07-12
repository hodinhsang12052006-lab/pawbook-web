import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authorId = searchParams.get("authorId");

    const whereClause = authorId ? { authorId } : {};

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    const safePosts = posts.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
    }));

    return NextResponse.json(safePosts);
  } catch (error: any) {
    console.error("Fetch posts API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách bài đăng." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng bài." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin định danh người dùng." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { content, mediaType, mediaUrl } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Nội dung bài viết không được để trống." },
        { status: 400 }
      );
    }

    const newPost = await prisma.post.create({
      data: {
        content,
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || null,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    const safeNewPost = {
      ...newPost,
      createdAt: newPost.createdAt.toISOString(),
    };

    return NextResponse.json(safeNewPost, { status: 201 });
  } catch (error: any) {
    console.error("Create post API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi đăng bài viết." },
      { status: 550 }
    );
  }
}
