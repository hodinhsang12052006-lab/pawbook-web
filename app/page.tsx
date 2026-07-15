import HomeContent from "@/components/feed/HomeContent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  let currentUser = null;

  if (session?.user?.id) {
    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        jobs: {
          select: {
            id: true,
            title: true,
            companyName: true,
            salary: true,
            niche: true,
            createdAt: true,
          },
        },
      },
    });
    if (userData) {
      currentUser = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        avatarUrl: userData.avatarUrl || null,
        bio: userData.bio || null,
        phone: userData.phone || null,
        address: userData.address || null,
        cover_image: userData.cover_image || null,
        cv_url: userData.cv_url || null,
        skills: userData.skills || null,
        reputation: userData.reputation || 0,
        trustScore: userData.trustScore || 5.0,
        isVerified: userData.isVerified || false,
        pawCoin: userData.pawCoin || 0,
        jobs: userData.jobs.map((j) => ({
          id: j.id,
          title: j.title,
          companyName: j.companyName,
          salary: j.salary,
          niche: j.niche,
          createdAt: j.createdAt.toISOString(),
        })),
      };
    }
  }

  const jobsData = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const jobs = jobsData.map((job) => ({
    id: job.id,
    title: job.title,
    companyName: job.companyName,
    description: job.description,
    salary: job.salary,
    location: job.location,
    tags: job.tags ? job.tags.split(",") : [],
    createdAt: job.createdAt.toISOString(),
  }));

  return <HomeContent initialUser={currentUser} initialJobs={jobs} />;
}
