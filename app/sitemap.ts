import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { SITE_URL } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  let jobUrls: MetadataRoute.Sitemap = [];
  try {
    // Tin còn hiệu lực (90 ngày gần nhất) — tin cũ để trong sitemap chỉ làm loãng.
    const jobs = await prisma.job.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    jobUrls = jobs.map((job) => ({
      url: `${baseUrl}/jobs/${job.id}`,
      lastModified: job.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch (e) {
    console.error("Sitemap jobs query failed:", e);
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    { url: `${baseUrl}/designs`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${baseUrl}/trends`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.1 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.1 },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ];

  return [...staticPages, ...jobUrls];
}
