import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, jobId } = body;

    if (!userId || !jobId) {
      return NextResponse.json(
        { error: "Thiếu thông tin người dùng (userId) hoặc việc làm (jobId)." },
        { status: 400 }
      );
    }

    // 1. Check if the user exists, CV uploaded, and check spam coin fee balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cvUrl: true, pawCoin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    if (!user.cvUrl) {
      return NextResponse.json(
        { error: "Ứng viên chưa tải CV lên trang cá nhân." },
        { status: 400 }
      );
    }

    if (user.pawCoin < 5) {
      return NextResponse.json(
        { error: `Ví của bạn không đủ số dư để nộp hồ sơ (Yêu cầu 5 PawCoin làm phí chống spam, hiện có ${user.pawCoin} PawCoin).` },
        { status: 400 }
      );
    }

    // 2. Check if the job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Công việc tuyển dụng không tồn tại." },
        { status: 404 }
      );
    }

    // 3. Verify duplicate application status
    const existingApplication = await prisma.application.findFirst({
      where: {
        applicantId: userId,
        jobId,
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: "Bạn đã nộp đơn ứng tuyển cho công việc này." },
        { status: 400 }
      );
    }

    // 4. Create new Application record, deduct 5 PawCoins, and create Transaction/Notification logs
    const [application] = await prisma.$transaction([
      prisma.application.create({
        data: {
          applicantId: userId,
          jobId,
          cvUrl: user.cvUrl,
          status: "PENDING",
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pawCoin: { decrement: 5 } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -5,
          type: "EXPENSE",
          description: `Phí nộp hồ sơ ứng tuyển: "${job.title.substring(0, 20)}..."`,
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          title: "Trừ PawCoin 💸",
          message: `Trừ 5 PawCoin phí nộp hồ sơ ứng tuyển cho công việc "${job.title.substring(0, 25)}...".`,
          type: "WALLET",
          link: "/profile",
        },
      }),
    ]);

    return NextResponse.json({
      message: "Nộp hồ sơ ứng tuyển thành công! (Khấu trừ 5 PawCoin phí chống spam)",
      application,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Job Apply API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi nộp đơn ứng tuyển." },
      { status: 500 }
    );
  }
}
