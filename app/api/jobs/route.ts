import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
    });
    return NextResponse.json(jobs);
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
    const { title, description, salary, companyName } = body;

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
