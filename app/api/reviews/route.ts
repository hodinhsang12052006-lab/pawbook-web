import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi đánh giá tín nhiệm." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { rating, content, targetUserId, gigId } = body;

    if (!rating || !content || !content.trim() || !targetUserId) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ xếp hạng sao, nội dung và người nhận đánh giá." },
        { status: 400 }
      );
    }

    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json(
        { error: "Xếp hạng đánh giá phải từ 1 đến 5 sao." },
        { status: 400 }
      );
    }

    if (userId === targetUserId) {
      return NextResponse.json(
        { error: "Bạn không thể tự đánh giá chính mình." },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Người dùng nhận đánh giá không tồn tại." },
        { status: 404 }
      );
    }

    // Anti-manipulation security check: Verify verified collaboration history (Bids or Applications)
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

    if (!bidLink && !jobLink) {
      return NextResponse.json(
        { error: "Bạn không có thẩm quyền đánh giá người dùng này (Yêu cầu lịch sử giao dịch: đã từng ứng tuyển hoặc đấu thầu dự án của nhau)." },
        { status: 403 }
      );
    }

    // 1. Create review entry
    const newReview = await prisma.review.create({
      data: {
        rating: parsedRating,
        content,
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

    // 2. Fetch all reviews for this target user to recalculate trust score
    const allReviews = await prisma.review.findMany({
      where: { targetUserId },
    });

    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;

    // 3. Update target user trust score
    // If averageRating falls below 3.0, auto revoke verified checkmark!
    const loseVerification = averageRating < 3.0;

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        trustScore: averageRating,
        isVerified: loseVerification ? false : undefined, // Keep if good, drop tick if < 3.0
      },
    });

    // Send a system notification to the target user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: "Đánh giá tín nhiệm ⭐",
        message: `Bạn vừa nhận được đánh giá ${parsedRating} sao: "${content.substring(0, 40)}...". Điểm tín nhiệm mới: ${averageRating.toFixed(1)}/5.0.`,
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
