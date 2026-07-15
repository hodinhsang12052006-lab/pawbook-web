import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { calculateMatchScore } from "@/lib/ai-matcher";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    let userSkills = "nextjs, react, typescript, tailwindcss, python, scraping"; // Default mock skills for guests/empty profiles

    if (session && session.user) {
      const userId = (session.user as any).id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { skills: true },
      });
      if (user && user.skills && user.skills.trim().length > 0) {
        userSkills = user.skills;
      }
    }

    // Retrieve all active jobs
    const jobs = await prisma.job.findMany({
      select: {
        id: true,
        title: true,
        companyName: true,
        salary: true,
        description: true,
        employerId: true,
        isBoosted: true,
        ai_tags: true,
        createdAt: true,
      },
      take: 100,
    });

    // Run AI Matchmaking on jobs
    const suggestedJobs = jobs
      .map(job => {
        // Fallback matching tags if ai_tags is empty: extract keywords from title/description
        const jobTags = job.ai_tags || `${job.title}, ${job.description}`;
        const matchScore = calculateMatchScore(userSkills, jobTags);
        return {
          ...job,
          matchScore,
        };
      })
      // Keep only jobs with matching score > 40%
      .filter(job => job.matchScore > 40)
      // Sort descending by matching relevance
      .sort((a, b) => b.matchScore - a.matchScore)
      // Limit to top 6 jobs
      .slice(0, 6);

    return NextResponse.json({
      userSkills,
      jobs: suggestedJobs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi chạy thuật toán ghép nối AI." },
      { status: 500 }
    );
  }
}
