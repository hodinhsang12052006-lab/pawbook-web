import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return NextResponse.json({ users: [], jobs: [], services: [] });
    }

    const keyword = query.trim();

    // 1. Fetch Users matching keyword
    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: keyword,
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
      take: 5,
    });

    // 2. Fetch Jobs matching keyword
    const jobs = await prisma.job.findMany({
      where: {
        title: {
          contains: keyword,
        },
      },
      select: {
        id: true,
        title: true,
        companyName: true,
      },
      take: 5,
    });

    // 3. Fetch Services matching keyword
    const services = await prisma.service.findMany({
      where: {
        name: {
          contains: keyword,
        },
      },
      select: {
        id: true,
        name: true,
        priceRange: true,
      },
      take: 5,
    });

    return NextResponse.json({ users, jobs, services });
  } catch (err: any) {
    console.error("Global search error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tìm kiếm." }, { status: 500 });
  }
}
