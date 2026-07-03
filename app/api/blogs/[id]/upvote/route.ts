import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện bình chọn." },
        { status: 401 }
      );
    }

    const { id: blogId } = await params;

    // Verify blog exists
    const blog = await prisma.blogPost.findUnique({
      where: { id: blogId },
    });

    if (!blog) {
      return NextResponse.json(
        { error: "Không tìm thấy bài viết tương ứng." },
        { status: 404 }
      );
    }

    // Update in transaction: +1 upvote for post, +5 pawCoins for author, create Transaction history, and send Wallet Notification
    const [updatedBlog, updatedAuthor] = await prisma.$transaction([
      prisma.blogPost.update({
        where: { id: blogId },
        data: { upvotes: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: blog.authorId },
        data: { pawCoin: { increment: 5 } },
      }),
      prisma.transaction.create({
        data: {
          userId: blog.authorId,
          amount: 5,
          type: "INCOME",
          description: `Thưởng Upvote từ bài viết: "${blog.title.substring(0, 25)}..."`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: blog.authorId,
          title: "Cộng PawCoin 🚀",
          message: `Bài viết "${blog.title.substring(0, 30)}..." của bạn vừa nhận được 1 Upvote. Bạn được thưởng +5 PawCoin!`,
          type: "WALLET",
          link: `/blogs/${blogId}`,
        },
      }),
    ]);

    return NextResponse.json({
      message: "Upvote bài viết thành công! Tác giả nhận được +5 PawCoin.",
      upvotes: updatedBlog.upvotes,
      authorCoins: updatedAuthor.pawCoin,
    });
  } catch (error: any) {
    console.error("Upvote API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống trong quá trình xử lý Upvote." },
      { status: 500 }
    );
  }
}
