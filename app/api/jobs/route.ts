export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        reviews: true,
        employer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
            reputation: true,
            trustScore: true,
          },
        },
      },
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Read static jobs from data_crawled
    const staticJobs: any[] = [];
    const tpHcmDir = path.join(process.cwd(), "data_crawled", "TP_HCM");
    const filesToRead = ["Spa_thu_cung.json", "Khach_san_thu_cung.json", "Cap_cuu_thu_y.json"];
    
    filesToRead.forEach((file) => {
      const filePath = path.join(tpHcmDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const items = JSON.parse(content);
          items.forEach((item: any, idx: number) => {
            staticJobs.push({
              id: `static-${file.replace(".json", "")}-${idx}`,
              title: `Tuyển nhân viên ${item.category || "dịch vụ"} tại ${item.name}`,
              companyName: item.name,
              description: `Địa chỉ: ${item.address}. Xếp hạng: ${item.rating || 5.0} sao (${item.reviewCount || 0} reviews). Liên hệ làm việc ngay.`,
              salary: "12M - 20M VND",
              location: item.address || "TP. Hồ Chí Minh",
              tags: ["Grooming", "Pet Care", "Spa", "Tuyển Dụng"],
              isBoosted: idx % 3 === 0,
              createdAt: new Date().toISOString(),
              reviews: []
            });
          });
        } catch (e) {
          console.error("Error reading static file", file, e);
        }
      }
    });

    const mergedJobs = [...jobs, ...staticJobs];
    return NextResponse.json(mergedJobs);
  } catch (error: any) {
    console.error("Fetch jobs API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách công việc." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng bài tuyển dụng." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin định danh." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, description, salary, companyName, priceRange, vehicleInfo, isEmergency, workType } = body;

    if (!title || !description || !salary || !companyName) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const newJob = await prisma.job.create({
      data: {
        title,
        description,
        salary,
        companyName,
        employerId: userId,
        priceRange,
        vehicleInfo,
        isEmergency: !!isEmergency,
        workType,
      },
    });

    // Trigger PawBot matchmaking in background asynchronously
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    fetch(`${baseUrl}/api/bot/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId: newJob.id }),
    }).catch((err) => console.error("Error triggering PawBot Matchmaker in background:", err));

    return NextResponse.json(newJob, { status: 201 });
  } catch (error: any) {
    console.error("Create job API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi thêm bài tuyển dụng." },
      { status: 550 }
    );
  }
}
