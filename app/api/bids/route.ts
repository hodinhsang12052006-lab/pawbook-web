import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem danh sách thầu dự án." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // Get bids placed by this candidate OR bids received on gigs posted by this employer
    const bids = await prisma.bid.findMany({
      where: {
        OR: [
          { freelancerId: userId },
          {
            gig: {
              employerId: userId,
            },
          },
        ],
      },
      include: {
        gig: {
          select: {
            id: true,
            title: true,
            budget: true,
            employerId: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            isVerified: true,
            trustScore: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json(bids);
  } catch (error: any) {
    console.error("GET bids error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải danh sách báo giá chào thầu." },
      { status: 500 }
    );
  }
}
