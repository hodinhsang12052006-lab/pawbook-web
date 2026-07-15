import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi đánh giá." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { rating, content, comment, targetUserId, jobId, gigId } = body;

    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json(
        { error: "Xếp hạng đánh giá phải từ 1 đến 5 sao." },
        { status: 400 }
      );
    }

    const reviewComment = comment || content || "";
    if (!reviewComment.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung đánh giá." },
        { status: 400 }
      );
    }

    // 1. Job review path
    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, employerId: true },
      });

      if (!job) {
        return NextResponse.json(
          { error: "Tin tuyển dụng hoặc dịch vụ không tồn tại." },
          { status: 404 }
        );
      }

      if (job.employerId === userId) {
        return NextResponse.json(
          { error: "Bạn không thể tự đánh giá dịch vụ của chính mình." },
          { status: 400 }
        );
      }

      // Create review under Job and target user (employer)
      const newReview = await prisma.review.create({
        data: {
          rating: parsedRating,
          content: reviewComment,
          comment: reviewComment,
          reviewerId: userId,
          targetUserId: job.employerId,
          jobId,
        },
        include: {
          reviewer: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return NextResponse.json({
        message: "Gửi đánh giá dịch vụ thành công! ⭐",
        review: newReview,
      });
    }

    // 2. Legacy: User evaluation path
    if (!targetUserId) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ xếp hạng sao, nội dung và người nhận đánh giá." },
        { status: 400 }
      );
    }

    if (userId === targetUserId) {
      return NextResponse.json(
        { error: "Bạn không thể tự đánh giá chính mình." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Người dùng nhận đánh giá không tồn tại." },
        { status: 404 }
      );
    }

    // Anti-manipulation collaboration check
    const bidLink = await prisma.bid.findFirst({
      where: {
        OR: [
          { freelancerId: userId, gig: { employerId: targetUserId } },
          { freelancerId: targetUserId, gig: { employerId: userId } },
        ],
      },
    });

    const jobLink = await prisma.application.findFirst({
      where: {
        OR: [
          { applicantId: userId, job: { employerId: targetUserId } },
          { applicantId: targetUserId, job: { employerId: userId } },
        ],
      },
    });

    const bookingLink = await prisma.booking.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId, status: "COMPLETED" },
          { senderId: targetUserId, receiverId: userId, status: "COMPLETED" },
        ],
      },
    });

    if (!bidLink && !jobLink && !bookingLink) {
      return NextResponse.json(
        { error: "Bạn không có thẩm quyền đánh giá người dùng này (Yêu cầu lịch sử giao dịch: đã từng ứng tuyển, đấu thầu hoặc hoàn thành đơn đặt hàng của nhau)." },
        { status: 403 }
      );
    }

    const newReview = await prisma.review.create({
      data: {
        rating: parsedRating,
        content: reviewComment,
        comment: reviewComment,
        reviewerId: userId,
        targetUserId,
        gigId: gigId || null,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Recalculate average trust rating
    const allReviews = await prisma.review.findMany({
      where: { targetUserId },
      // Every review for this user must be included for the average rating
      // to be accurate — the cap below is a defensive ceiling against
      // unbounded growth, not a page size.
      take: 2000,
    });

    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;
    const loseVerification = averageRating < 3.0;

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        trustScore: averageRating,
        isVerified: loseVerification ? false : undefined,
      },
    });

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: "Đánh giá tín nhiệm ⭐",
        message: `Bạn vừa nhận được đánh giá ${parsedRating} sao: "${reviewComment.substring(0, 40)}...". Điểm tín nhiệm mới: ${averageRating.toFixed(1)}/5.0.`,
        type: "INFO",
      },
    });

    return NextResponse.json({
      message: "Gửi đánh giá tín nhiệm thành công!",
      review: newReview,
      newTrustScore: averageRating,
      revokedVerification: loseVerification,
    });
  } catch (error: any) {
    console.error("POST review API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi lưu đánh giá." },
      { status: 500 }
    );
  }
}

// GET method to fetch reviews for a specific job
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp jobId." },
        { status: 400 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: { jobId },
      take: 100,
      include: {
        reviewer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(reviews);
  } catch (err: any) {
    console.error("GET reviews error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải đánh giá." },
      { status: 500 }
    );
  }
}
