import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    let gigs = await prisma.gig.findMany({
      where: {
        status: "OPEN",
      },
      include: {
        employer: {
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
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
    });

    if (gigs.length === 0) {
      const crawlerEmail = "crawler@pawbook.vn";
      let crawlerUser = await prisma.user.findUnique({
        where: { email: crawlerEmail },
      });

      if (!crawlerUser) {
        const dummyPassword = await bcrypt.hash("pawbook-crawler-bot-internal-pass-123456", 10);
        crawlerUser = await prisma.user.create({
          data: {
            name: "PawBook Crawler Engine",
            email: crawlerEmail,
            password: dummyPassword,
            role: "EMPLOYER",
            isVerified: true,
            trustScore: 4.9,
            avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&auto=format&fit=crop&q=80",
            bio: "Hệ thống Crawler Bot tự động thu thập và đồng bộ hóa các việc làm, dịch vụ spa, địa điểm nổi bật toàn quốc.",
            pawCoin: 9999,
            reputation: 99,
          },
        });
      }

      const sampleGigs = [
        {
          title: "Chạy quảng cáo Facebook Ads cho Spa khai trương",
          description: "Cần tìm chuyên gia chạy Facebook Ads tối ưu phễu khách hàng đặt lịch massage trị liệu cho Spa tại Hà Nội. Ngân sách khoán trọn gói chiến dịch.",
          budget: 2500000,
          employerId: crawlerUser.id,
          status: "OPEN",
        },
        {
          title: "Thiết kế bộ nhận diện thương hiệu cho tiệm Nails mới",
          description: "Cần thiết kế trọn bộ Logo, Menu dịch vụ, Card visit, Bảng hiệu cho salon Nails cao cấp phong cách Hàn Quốc. Cần freelancer giàu kinh nghiệm vẽ vector.",
          budget: 3000000,
          employerId: crawlerUser.id,
          status: "OPEN",
        },
        {
          title: "Khai báo báo cáo thuế doanh nghiệp Quý II",
          description: "Tuyển chuyên gia Kế toán dịch vụ/Kế toán thuế rà soát hóa đơn đầu vào/đầu ra, chuẩn bị báo cáo tài chính và nộp tờ khai thuế cho doanh nghiệp phần mềm vừa và nhỏ.",
          budget: 1500000,
          employerId: crawlerUser.id,
          status: "OPEN",
        }
      ];

      await Promise.all(sampleGigs.map((g) => prisma.gig.create({ data: g })));

      gigs = await prisma.gig.findMany({
        where: { status: "OPEN" },
        include: {
          employer: {
            select: { id: true, name: true, avatarUrl: true, role: true, isVerified: true, trustScore: true },
          },
        },
        orderBy: [
          { isBoosted: "desc" },
          { createdAt: "desc" },
        ],
      });
    }

    return NextResponse.json(gigs);
  } catch (error: any) {
    console.error("GET gigs API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách công việc thời vụ." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng việc thời vụ." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { title, description, budget } = body;

    if (!title || !description || !budget) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin (Tiêu đề, Mô tả, Ngân sách)." },
        { status: 400 }
      );
    }

    const parsedBudget = parseFloat(budget);
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      return NextResponse.json(
        { error: "Ngân sách đấu thầu phải là số dương hợp lệ." },
        { status: 400 }
      );
    }

    const newGig = await prisma.gig.create({
      data: {
        title,
        description,
        budget: parsedBudget,
        employerId: userId,
        status: "OPEN",
      },
      include: {
        employer: {
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
    });

    return NextResponse.json(newGig, { status: 201 });
  } catch (error: any) {
    console.error("POST gig API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi đăng thầu dự án mới." },
      { status: 500 }
    );
  }
}
