import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện tác vụ này." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Thiếu mã công việc (jobId)." },
        { status: 400 }
      );
    }

    // Retrieve job and check ownership
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        employerId: true,
        is_premium: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Không tìm thấy công việc tương ứng." },
        { status: 404 }
      );
    }

    if (job.employerId !== userId) {
      return NextResponse.json(
        { error: "Bạn không phải chủ sở hữu bài đăng này để có thể đẩy Top." },
        { status: 403 }
      );
    }

    if (job.is_premium) {
      return NextResponse.json(
        { error: "Bài đăng này đã được đẩy Top và đang trên Top." },
        { status: 400 }
      );
    }

    // Retrieve user wallet details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pawCoin: true },
    });

    if (!user || user.pawCoin < 50) {
      return NextResponse.json(
        { error: "Số dư ví của bạn không đủ (Yêu cầu tối thiểu 50 PawCoins)." },
        { status: 402 }
      );
    }

    const boostDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const boostedUntil = new Date(Date.now() + boostDurationMs);

    // Atomic transaction operation updating wallet points, job states and transactions list
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          pawCoin: { decrement: 50 },
        },
      }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          is_premium: true,
          boosted_until: boostedUntil,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -50,
          type: "EXPENSE",
          description: `Đẩy Top bài đăng tuyển dụng: "${job.title}" (-50 PawCoins)`,
          pawCoinAmount: -50,
          status: "SUCCESS",
          provider: "SYSTEM",
        },
      }),
    ]);

    return NextResponse.json({
      message: "Đẩy bài viết lên Top thành công! 🚀",
      jobId,
      boostedUntil,
    });
  } catch (err: any) {
    console.error("Boost job API error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi thực hiện đẩy Top tin tuyển dụng." },
      { status: 500 }
    );
  }
}
