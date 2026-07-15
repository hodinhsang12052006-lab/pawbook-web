import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://sang-jijl.vercel.app";

  let jobUrls: MetadataRoute.Sitemap = [];
  let serviceUrls: MetadataRoute.Sitemap = [];
  let blogUrls: MetadataRoute.Sitemap = [];

  try {
    const jobs = await prisma.job.findMany({
      select: { id: true, createdAt: true },
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

  try {
    const services = await prisma.service.findMany({
      select: { id: true, createdAt: true },
    });
    serviceUrls = services.map((srv) => ({
      url: `${baseUrl}/services/${srv.id}`,
      lastModified: srv.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (e) {
    console.error("Sitemap services query failed:", e);
  }

  try {
    const blogs = await prisma.blogPost.findMany({
      select: { id: true, createdAt: true },
    });
    blogUrls = blogs.map((post) => ({
      url: `${baseUrl}/blogs/${post.id}`,
      lastModified: post.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (e) {
    console.error("Sitemap blogs query failed:", e);
  }

  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/jobs`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/candidates`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/gigs`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blogs`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
  ];

  return [...staticPages, ...jobUrls, ...serviceUrls, ...blogUrls];
}
