import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem lịch sử ví." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error: any) {
    console.error("GET wallet history API error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải lịch sử giao dịch ví." },
      { status: 550 }
    );
  }
}
