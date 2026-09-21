import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role, ReviewType } from "@prisma/client";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const SALON_CRITERIA = ["punctualityOrPay", "environment", "turnFairness"] as const;
const TECHNICIAN_CRITERIA = ["skillAccuracy", "workEthic", "customerAttitude"] as const;

function avgOf(reviews: any[], key: string) {
  const vals = reviews.map((r) => r[key]).filter((v): v is number => typeof v === "number");
  return vals.length === 0 ? null : round1(vals.reduce((sum, v) => sum + v, 0) / vals.length);
}

// GET /api/reviews?targetUserId=xxx — danh sách đánh giá 2 chiều + số liệu
// tổng hợp (điểm trung bình thật tính từ Review, KHÔNG có số liệu lượng
// khách/tip giả định vì hệ thống chưa có nguồn dữ liệu POS/booking thật).
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
    // Cả 2 chiều dùng chung bảng nhưng 1 targetUserId chỉ nhận đúng 1 loại
    // review (vai trò không đổi trong vòng đời tài khoản), nên lấy type của
    // review đầu tiên làm type chung cho toàn bộ danh sách này.
    const type: ReviewType | null = reviews[0]?.type ?? null;

    return NextResponse.json({
      type,
      reviews: reviews.map((r) => ({
        id: r.id,
        type: r.type,
        overall: r.overall,
        punctualityOrPay: r.punctualityOrPay,
        environment: r.environment,
        turnFairness: r.turnFairness,
        skillAccuracy: r.skillAccuracy,
        workEthic: r.workEthic,
        customerAttitude: r.customerAttitude,
        comment: r.comment,
        isVerifiedConnection: r.isVerifiedConnection,
        createdAt: r.createdAt.toISOString(),
        author: r.author,
      })),
      summary: {
        count,
        avgOverall: avgOf(reviews, "overall"),
        avgPunctualityOrPay: avgOf(reviews, "punctualityOrPay"),
        avgEnvironment: avgOf(reviews, "environment"),
        avgTurnFairness: avgOf(reviews, "turnFairness"),
        avgSkillAccuracy: avgOf(reviews, "skillAccuracy"),
        avgWorkEthic: avgOf(reviews, "workEthic"),
        avgCustomerAttitude: avgOf(reviews, "customerAttitude"),
      },
    });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: "Không thể tải đánh giá." }, { status: 500 });
  }
}

// POST /api/reviews — gửi đánh giá 2 chiều. Chiều (SALON_REVIEW hay
// TECHNICIAN_REVIEW) được SUY RA từ role người gửi, không nhận từ client,
// để không ai giả mạo review sai chiều. Upsert theo cặp (authorId,
// targetUserId): gửi lại nghĩa là sửa đánh giá cũ, không cho spam.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để gửi đánh giá." }, { status: 401 });
    }

    const authorRole = session.user.role as Role;
    if (authorRole !== Role.OWNER && authorRole !== Role.TECHNICIAN) {
      return NextResponse.json({ error: "Tài khoản của bạn không thể gửi đánh giá." }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, overall, comment } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "Thiếu targetUserId." }, { status: 400 });
    }
    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: "Không thể tự đánh giá chính mình." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản này." }, { status: 404 });
    }

    // Chủ tiệm chỉ được review Thợ, Thợ chỉ được review Chủ tiệm.
    const type: ReviewType = authorRole === Role.OWNER ? ReviewType.TECHNICIAN_REVIEW : ReviewType.SALON_REVIEW;
    const expectedTargetRole = authorRole === Role.OWNER ? Role.TECHNICIAN : Role.OWNER;
    if (target.role !== expectedTargetRole) {
      return NextResponse.json(
        {
          error:
            authorRole === Role.OWNER
              ? "Chủ tiệm chỉ có thể đánh giá tài khoản Thợ."
              : "Thợ chỉ có thể đánh giá tài khoản Chủ tiệm.",
        },
        { status: 400 }
      );
    }

    const criteriaKeys = type === ReviewType.SALON_REVIEW ? SALON_CRITERIA : TECHNICIAN_CRITERIA;
    const criteriaValues: Record<string, number> = {};
    for (const key of criteriaKeys) {
      const val = body[key];
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return NextResponse.json({ error: `Điểm "${key}" phải là số nguyên từ 1 đến 5.` }, { status: 400 });
      }
      criteriaValues[key] = val;
    }
    if (!Number.isInteger(overall) || overall < 1 || overall > 5) {
      return NextResponse.json({ error: 'Điểm "overall" phải là số nguyên từ 1 đến 5.' }, { status: 400 });
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Vui lòng viết nhận xét." }, { status: 400 });
    }
    if (comment.length > 1000) {
      return NextResponse.json({ error: "Nhận xét quá dài (tối đa 1000 ký tự)." }, { status: 400 });
    }

    // "Verified Connection" — 2 người đã từng nhắn tin (có ít nhất 1 tin
    // nhắn trong 1 hội thoại 1-1 chung) hoặc chủ đã mở khóa liên hệ thợ.
    const ownerId = authorRole === Role.OWNER ? session.user.id : targetUserId;
    const technicianUserId = authorRole === Role.OWNER ? targetUserId : session.user.id;

    const [conversationWithMessage, unlock] = await Promise.all([
      prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: session.user.id } } },
            { participants: { some: { id: targetUserId } } },
          ],
          messages: { some: {} },
        },
        select: { id: true },
      }),
      prisma.unlockContact.findUnique({
        where: { ownerId_technicianUserId: { ownerId, technicianUserId } },
        select: { id: true },
      }),
    ]);
    const isVerifiedConnection = Boolean(conversationWithMessage || unlock);

    const dataFields = {
      type,
      overall,
      comment: comment.trim(),
      isVerifiedConnection,
      punctualityOrPay: null as number | null,
      environment: null as number | null,
      turnFairness: null as number | null,
      skillAccuracy: null as number | null,
      workEthic: null as number | null,
      customerAttitude: null as number | null,
      ...criteriaValues,
    };

    const review = await prisma.review.upsert({
      where: { authorId_targetUserId: { authorId: session.user.id, targetUserId } },
      update: dataFields,
      create: {
        authorId: session.user.id,
        targetUserId,
        ...dataFields,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    return NextResponse.json(
      {
        id: review.id,
        type: review.type,
        overall: review.overall,
        punctualityOrPay: review.punctualityOrPay,
        environment: review.environment,
        turnFairness: review.turnFairness,
        skillAccuracy: review.skillAccuracy,
        workEthic: review.workEthic,
        customerAttitude: review.customerAttitude,
        comment: review.comment,
        isVerifiedConnection: review.isVerifiedConnection,
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
