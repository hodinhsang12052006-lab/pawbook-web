import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gigId } = await params;

    const bids = await prisma.bid.findMany({
      where: { gigId },
      include: {
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
      { error: "Đã xảy ra lỗi khi tải danh sách thầu." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi báo giá đấu thầu." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { id: gigId } = await params;
    const body = await request.json();
    const { bidAmount, message } = body;

    if (!bidAmount || !message || !message.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập giá thầu và lời nhắn chào thầu." },
        { status: 400 }
      );
    }

    const parsedBidAmount = parseFloat(bidAmount);
    if (isNaN(parsedBidAmount) || parsedBidAmount <= 0) {
      return NextResponse.json(
        { error: "Giá thầu phải là một số dương hợp lệ." },
        { status: 400 }
      );
    }

    // Verify user exists and check coin balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pawCoin: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    if (user.pawCoin < 5) {
      return NextResponse.json(
        { error: `Số dư ví không đủ để gửi chào thầu (Yêu cầu 5 PawCoin làm phí chống spam, hiện có ${user.pawCoin} PawCoin).` },
        { status: 400 }
      );
    }

    // Verify gig exists and is open
    const gig = await prisma.gig.findUnique({
      where: { id: gigId },
    });

    if (!gig) {
      return NextResponse.json(
        { error: "Dự án/Công việc thời vụ không tồn tại." },
        { status: 404 }
      );
    }

    if (gig.status !== "OPEN") {
      return NextResponse.json(
        { error: "Dự án này đã đóng đấu thầu hoặc đã được giao." },
        { status: 400 }
      );
    }

    // Check if freelancer already placed a bid
    const existingBid = await prisma.bid.findFirst({
      where: {
        gigId,
        freelancerId: userId,
      },
    });

    if (existingBid) {
      return NextResponse.json(
        { error: "Bạn đã nộp báo giá cho dự án này rồi." },
        { status: 400 }
      );
    }

    // Create Bid and charge 5 PawCoins in a transaction with ledger and notification logging
    const [newBid] = await prisma.$transaction([
      prisma.bid.create({
        data: {
          gigId,
          freelancerId: userId,
          bidAmount: parsedBidAmount,
          message,
          status: "PENDING",
        },
        include: {
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
          description: `Phí chào thầu dự án: "${gig.title.substring(0, 20)}..."`,
        },
      }),
      prisma.notification.create({
        data: {
          userId,
          title: "Trừ PawCoin 💸",
          message: `Khấu trừ 5 PawCoin phí chào thầu cho dự án "${gig.title.substring(0, 25)}...".`,
          type: "WALLET",
          link: "/profile",
        },
      }),
    ]);

    return NextResponse.json(newBid, { status: 201 });
  } catch (error: any) {
    console.error("POST bid API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi nộp chào thầu." },
      { status: 550 }
    );
  }
}
