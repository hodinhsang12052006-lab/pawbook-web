import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem thông tin doanh thu." },
        { status: 401 }
      );
    }

    let revenues = await prisma.revenue.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Auto-seed revenues if empty
    if (revenues.length === 0) {
      const mockRevenues = [
        { source: "Outsourcing & Core IT Products", amount: 450000000 },
        { source: "Cộng tác MMO & MMO Affiliate", amount: 320000000 },
        { source: "Bán bản quyền Marketing & Automation Tools", amount: 180000000 },
        { source: "Quảng cáo tuyển dụng & Sponsored Posts", amount: 50000000 },
      ];

      await Promise.all(
        mockRevenues.map((r) =>
          prisma.revenue.create({
            data: r,
          })
        )
      );

      revenues = await prisma.revenue.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    return NextResponse.json(revenues);
  } catch (error: any) {
    console.error("GET revenues error:", error);
    return NextResponse.json(
      { error: "Không thể lấy danh sách doanh thu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để ghi chép doanh thu mới." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { source, amount } = body;

    if (!source || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Nguồn doanh thu hoặc số tiền không hợp lệ." },
        { status: 400 }
      );
    }

    const newRevenue = await prisma.revenue.create({
      data: {
        source,
        amount,
      },
    });

    return NextResponse.json(newRevenue, { status: 201 });
  } catch (error: any) {
    console.error("POST revenue error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi thêm doanh thu." },
      { status: 500 }
    );
  }
}
