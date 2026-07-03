import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xử lý kết quả giao dịch." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { txnId, status } = body;

    if (!txnId || !status) {
      return NextResponse.json(
        { error: "Thông tin callback giao dịch không hợp lệ." },
        { status: 400 }
      );
    }

    // Retrieve transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: txnId },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Giao dịch không tồn tại trên hệ thống." },
        { status: 404 }
      );
    }

    if (transaction.userId !== userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác trên giao dịch này." },
        { status: 403 }
      );
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Giao dịch này đã được xử lý trước đó." },
        { status: 400 }
      );
    }

    if (status === "SUCCESS") {
      const topupCoins = transaction.pawCoinAmount || 0;

      // Update Transaction status to SUCCESS and increment user coin balance
      const [updatedTransaction, updatedUser] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id: txnId },
          data: {
            status: "SUCCESS",
            amount: topupCoins, // Show coin amount in ledger
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            pawCoin: { increment: topupCoins },
          },
        }),
        prisma.notification.create({
          data: {
            userId,
            title: "Nạp coin thành công! 💳",
            message: `Giao dịch VNPAY thành công. Tài khoản của bạn được cộng +${topupCoins} PawCoin.`,
            type: "WALLET",
            link: "/profile",
          },
        }),
      ]);

      return NextResponse.json({
        message: "Thanh toán thành công! Ví đã được cộng coin.",
        status: "SUCCESS",
        newBalance: updatedUser.pawCoin,
      });
    } else {
      // Transaction failed
      const updatedTransaction = await prisma.transaction.update({
        where: { id: txnId },
        data: {
          status: "FAILED",
        },
      });

      return NextResponse.json({
        message: "Giao dịch nạp tiền thất bại hoặc đã bị hủy.",
        status: "FAILED",
      });
    }
  } catch (error: any) {
    console.error("VNPAY callback error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi cập nhật trạng thái giao dịch." },
      { status: 550 }
    );
  }
}
