import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện giao dịch." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { amountVND, pawCoinAmount } = body;

    if (!amountVND || !pawCoinAmount) {
      return NextResponse.json(
        { error: "Thông tin số tiền thanh toán không hợp lệ." },
        { status: 400 }
      );
    }

    // Create a PENDING transaction log in the database
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: 0, // 0 coins credited until transaction is marked SUCCESS
        type: "INCOME",
        description: `Nạp ${pawCoinAmount} PawCoin qua VNPAY`,
        amountVND: parseFloat(amountVND),
        pawCoinAmount: parseInt(pawCoinAmount),
        status: "PENDING",
        provider: "VNPAY",
      },
    });

    // Return mock payment URL redirecting to local sandbox
    const paymentUrl = `/payment-sandbox?txnId=${transaction.id}&amountVND=${amountVND}&pawCoinAmount=${pawCoinAmount}`;

    return NextResponse.json({
      message: "Khởi tạo giao dịch thành công. Đang chuyển hướng...",
      paymentUrl,
    });
  } catch (error: any) {
    console.error("VNPAY initiation error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi khởi tạo giao dịch." },
      { status: 500 }
    );
  }
}
