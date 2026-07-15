import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Mã tin tuyển dụng không hợp lệ." },
        { status: 400 }
      );
    }

    // 1. Fetch job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Không tìm thấy công việc tương ứng." },
        { status: 404 }
      );
    }

    // 2. Identify skills required based on Job Title and Description keywords
    const keywords = [
      "next.js", "nextjs", "react", "typescript", "javascript", "python",
      "automation", "bot", "selenium", "puppeteer", "playwright", "crawler",
      "devops", "docker", "aws", "marketing", "growth hacker", "seo",
      "affiliate", "crypto", "excel", "kế toán", "accountant", "spa", "massage"
    ];

    const contentToSearch = `${job.title} ${job.description}`.toLowerCase();
    const jobKeywords = keywords.filter((kw) => contentToSearch.includes(kw));

    // 3. Scan users (Candidates)
    const users = await prisma.user.findMany({
      where: {
        role: "USER",
      },
      select: {
        id: true,
        skills: true,
        bio: true,
      },
    });

    const notificationsToCreate = [];

    for (const user of users) {
      const userSkills = (user.skills || "").toLowerCase();
      const userBio = (user.bio || "").toLowerCase();
      const userContent = `${userSkills} ${userBio}`;

      // Check if user has matching skills
      const isMatch = jobKeywords.some((kw) => userContent.includes(kw)) || jobKeywords.length === 0;

      if (isMatch) {
        notificationsToCreate.push({
          userId: user.id,
          message: `[PawBot Matchmaker] Phát hiện công việc "${job.title}" tại ${job.companyName} phù hợp với kỹ năng của bạn. Ứng tuyển ngay!`,
          type: "MATCH_JOB",
          link: `/jobs/${job.id}`,
        });
      }
    }

    // 4. Batch create notifications
    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    return NextResponse.json({
      message: `PawBot Matchmaker hoàn thành! Đã gửi ${notificationsToCreate.length} thông báo ứng tuyển.`,
      matchedCount: notificationsToCreate.length,
    });
  } catch (error: any) {
    console.error("PawBot Matchmaker API Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống trong quá trình Matchmaking." },
      { status: 500 }
    );
  }
}
