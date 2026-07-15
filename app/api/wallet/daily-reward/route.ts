import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để điểm danh nhận thưởng." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // 1. Fetch User status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastDailyReward: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    // 2. Check 24-hour limit
    if (user.lastDailyReward) {
      const lastClaim = new Date(user.lastDailyReward).getTime();
      const nextAvailableClaim = lastClaim + 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();

      if (now < nextAvailableClaim) {
        const remainingMs = nextAvailableClaim - now;
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        return NextResponse.json(
          { error: `Bạn đã nhận quà điểm danh hôm nay. Hãy quay lại sau ${remainingHours} giờ.` },
          { status: 400 }
        );
      }
    }

    // 3. Increment coin, update claim time, create transaction & notification logs in a single Prisma Transaction
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          pawCoin: { increment: 20 },
          lastDailyReward: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: 20,
          type: "INCOME",
          description: "Quà điểm danh hàng ngày",
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          title: "Điểm danh nhận quà 🎉",
          message: "Chúc mừng bạn được cộng +20 PawCoin điểm danh hàng ngày vào ví!",
          type: "WALLET",
          link: "/profile",
        },
      }),
    ]);

    return NextResponse.json({
      message: "Điểm danh nhận quà thành công! Bạn được cộng +20 PawCoin.",
      newBalance: updatedUser.pawCoin,
    });
  } catch (error: any) {
    console.error("POST daily reward error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi xử lý điểm danh." },
      { status: 500 }
    );
  }
}
