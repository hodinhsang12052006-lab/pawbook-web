import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json(
        { error: "Từ chối truy cập. Quyền Quản trị viên cấp cao yêu cầu." },
        { status: 403 }
      );
    }

    const [totalUsers, totalEmployers, totalJobs, coinsAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "EMPLOYER" } }),
      prisma.job.count(),
      prisma.user.aggregate({ _sum: { pawCoin: true } }),
    ]);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        trustScore: true,
        pawCoin: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const services = await prisma.service.findMany({
      include: {
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { rating: "desc" },
    });

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalEmployers,
        totalJobs,
        totalPawCoins: coinsAgg._sum.pawCoin || 0,
      },
      users,
      services,
    });
  } catch (error: any) {
    console.error("Admin stats fetch error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi tải dữ liệu Admin." },
      { status: 500 }
    );
  }
}
