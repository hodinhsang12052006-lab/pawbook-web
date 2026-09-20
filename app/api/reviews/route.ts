import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// GET /api/reviews?targetUserId=xxx — danh sách đánh giá + số liệu tổng hợp
// (điểm trung bình thật tính từ Review, KHÔNG có số liệu lượng khách/tip giả
// định vì hệ thống chưa có nguồn dữ liệu POS/booking thật nào cho việc đó).
export async function GET(req: NextRequest) {
  try {
    const targetUserId = req.nextUrl.searchParams.get("targetUserId");
    if (!targetUserId) {
      return NextResponse.json({ error: "Thiếu targetUserId." }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { targetUserId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    const count = reviews.length;
    const avg = (key: "rating" | "fairnessRating" | "environmentRating" | "turnFairnessRating") =>
      count === 0 ? null : round1(reviews.reduce((sum, r) => sum + r[key], 0) / count);

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        fairnessRating: r.fairnessRating,
        environmentRating: r.environmentRating,
        turnFairnessRating: r.turnFairnessRating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        author: r.author,
      })),
      summary: {
        count,
        avgRating: avg("rating"),
        avgFairness: avg("fairnessRating"),
        avgEnvironment: avg("environmentRating"),
        avgTurnFairness: avg("turnFairnessRating"),
      },
    });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: "Không thể tải đánh giá." }, { status: 500 });
  }
}

// POST /api/reviews — gửi đánh giá cho 1 tiệm/thợ khác. Upsert theo cặp
// (authorId, targetUserId): gửi lại nghĩa là sửa đánh giá cũ, không cho spam
// nhiều bản ghi cho cùng 1 người.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để gửi đánh giá." }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, rating, fairnessRating, environmentRating, turnFairnessRating, comment } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "Thiếu targetUserId." }, { status: 400 });
    }
    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự đánh giá chính mình." }, { status: 400 });
    }

    const ratings = { rating, fairnessRating, environmentRating, turnFairnessRating };
    for (const [key, val] of Object.entries(ratings)) {
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return NextResponse.json({ error: `Điểm "${key}" phải là số nguyên từ 1 đến 5.` }, { status: 400 });
      }
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Vui lòng viết nhận xét." }, { status: 400 });
    }
    if (comment.length > 1000) {
      return NextResponse.json({ error: "Nhận xét quá dài (tối đa 1000 ký tự)." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản này." }, { status: 404 });
    }

    const review = await prisma.review.upsert({
      where: { authorId_targetUserId: { authorId: session.user.id, targetUserId } },
      update: {
        rating, fairnessRating, environmentRating, turnFairnessRating,
        comment: comment.trim(),
      },
      create: {
        authorId: session.user.id,
        targetUserId,
        rating, fairnessRating, environmentRating, turnFairnessRating,
        comment: comment.trim(),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(
      {
        id: review.id,
        rating: review.rating,
        fairnessRating: review.fairnessRating,
        environmentRating: review.environmentRating,
        turnFairnessRating: review.turnFairnessRating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        author: review.author,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: "Không thể gửi đánh giá." }, { status: 500 });
  }
}
