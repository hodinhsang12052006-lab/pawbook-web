import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp mã ứng viên (userId)." },
        { status: 400 }
      );
    }

    // 1. Fetch Candidate details
    const candidate = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        skills: true,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin ứng viên tương ứng." },
        { status: 404 }
      );
    }

    // 2. Parse candidate skills
    const skillsString = candidate.skills || "";
    const candidateSkills = skillsString
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (candidateSkills.length === 0) {
      return NextResponse.json({
        candidate,
        matchedJobs: [],
        message: "Ứng viên chưa thiết lập kỹ năng trong trang cá nhân.",
      });
    }

    // 3. Retrieve all job listings
    const allJobs = await prisma.job.findMany({
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
    });

    // 4. Perform keyword-matching on Job Title & Description
    const matchedJobs = allJobs.filter((job) => {
      const searchContent = `${job.title} ${job.description}`.toLowerCase();
      return candidateSkills.some((skill) => searchContent.includes(skill));
    });

    return NextResponse.json({
      candidate,
      matchedJobs,
      totalMatched: matchedJobs.length,
    });
  } catch (error: any) {
    console.error("Matchmaker API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống trong quá trình định vị việc làm phù hợp." },
      { status: 500 }
    );
  }
}
