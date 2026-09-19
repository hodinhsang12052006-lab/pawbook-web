import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { Market, Role } from "@prisma/client";

// GET /api/jobs?market=US&state=CA&city=...  — danh sách tin tuyển thợ
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const city = searchParams.get("city");

    const where: any = {};
    if (market === "US" || market === "AU") where.market = market as Market;
    if (state) where.state = state;
    if (city) where.city = { contains: city };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const safeJobs = jobs.map((job) => ({
      ...job,
      skills: job.skills ? job.skills.split(",").filter(Boolean) : [],
      benefits: job.benefits ? job.benefits.split(",").filter(Boolean) : [],
      createdAt: job.createdAt.toISOString(),
    }));

    return NextResponse.json(safeJobs);
  } catch (error: any) {
    console.error("Fetch jobs API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách tin tuyển dụng." },
      { status: 500 }
    );
  }
}

// POST /api/jobs — đăng tin tuyển thợ (chỉ chủ tiệm - role OWNER)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng tin tuyển dụng." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    if (userRole !== Role.OWNER) {
      return NextResponse.json(
        { error: "Chỉ tài khoản Chủ tiệm mới có thể đăng tin tuyển thợ." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title, salonName, description, market, state, city,
      salaryType, salaryAmount, skills, benefits, phone, isUrgent,
    } = body;

    if (!title || !salonName || !market || !state || !city || !salaryType || !salaryAmount || !phone) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const newJob = await prisma.job.create({
      data: {
        title,
        salonName,
        description: description || "",
        ownerId: userId,
        market: market === "AU" ? Market.AU : Market.US,
        state,
        city,
        salaryType,
        salaryAmount,
        skills: Array.isArray(skills) ? skills.join(",") : (skills || ""),
        benefits: Array.isArray(benefits) ? benefits.join(",") : (benefits || ""),
        phone,
        isUrgent: isUrgent !== undefined ? !!isUrgent : true,
      },
    });

    return NextResponse.json(newJob, { status: 201 });
  } catch (error: any) {
    console.error("Create job API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi đăng tin tuyển dụng." },
      { status: 500 }
    );
  }
}
