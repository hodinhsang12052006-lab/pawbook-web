import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isDev = process.env.NODE_ENV === "development";
    const isAdmin = session?.user && (session.user as any).role === "ADMIN";

    if (!isDev && !isAdmin) {
      return NextResponse.json(
        { error: "Chỉ quản trị viên mới có quyền thực hiện hành động này." },
        { status: 403 }
      );
    }

    const totalUsers = await prisma.user.count();
    const totalJobs = await prisma.job.count();
    const totalReviews = await prisma.review.count();

    const recentJobs = await prisma.job.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        employer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      totalUsers,
      totalJobs,
      totalReviews,
      recentJobs,
    });
  } catch (error: any) {
    console.error("Admin stats API error:", error);
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu thống kê hệ thống." },
      { status: 500 }
    );
  }
}
