import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { RETIRED_OCCASIONS } from "@/lib/season";
import { SITE_URL } from "@/lib/siteUrl";
import { realUserWhere } from "@/lib/demo";
import { localePath } from "@/lib/i18n/config";
import { activeJobWhere } from "@/lib/jobIngest/ingest";

// Tạo mỗi lần Google đọc (không đóng băng lúc deploy): tin tuyển + mẫu nail mới mỗi ngày phải có mặt ngay
export const dynamic = "force-dynamic";

// Mỗi trang có 2 bản: tiếng Anh ở URL không tiền tố (x-default) và tiếng Việt ở /vi/… —
// khai cả 2 kèm hreflang qua lại (Google cần mỗi bản liệt kê đủ các bản còn lại).
function bilingual(path: string, entry: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">): MetadataRoute.Sitemap {
  const en = `${SITE_URL}${localePath(path, "en")}`;
  const vi = `${SITE_URL}${localePath(path, "vi")}`;
  const alternates = { languages: { en, vi, "x-default": en } };
  return [
    { ...entry, url: en, alternates },
    { ...entry, url: vi, alternates },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  let jobUrls: MetadataRoute.Sitemap = [];
  try {
    // Chỉ tin CÒN HIỆN trên bảng việc (khớp hạn thật / bộ lọc — activeJobWhere), chủ tiệm tự đăng, tài khoản thật.
    // Tin hết hạn / bị ẩn / tin mẫu / tin tổng hợp / đăng hộ / đã gỡ không khai cho Google.
    const jobs = await prisma.job.findMany({
      where: { AND: [activeJobWhere(), { owner: realUserWhere }, { source: null }] },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    // Cả 2 bản (EN /jobs/… + VI /vi/jobs/…) kèm hreflang — cùng quy tắc canonical với trang tin.
    jobUrls = jobs.flatMap((job) => bilingual(`/jobs/${job.id}`, { lastModified: job.createdAt, changeFrequency: "daily" as const, priority: 0.8 }));
  } catch (e) {
    console.error("Sitemap jobs query failed:", e);
  }

  // Trang riêng từng mẫu nail đã đăng (có ảnh) — mỗi ngày thêm mẫu mới cho Google
  let designUrls: MetadataRoute.Sitemap = [];
  try {
    const designs = await prisma.nailDesign.findMany({
      // chỉ mẫu đang đăng; không bao giờ mẫu của dịp đã nghỉ (Halloween) — kể cả khi lỡ còn "published"
      where: { status: "published", imageUrl: { not: null }, OR: [{ occasion: null }, { occasion: { notIn: [...RETIRED_OCCASIONS] } }] },
      select: { id: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 3000,
    });
    designUrls = designs.flatMap((d) => bilingual(`/designs/${d.id}`, { lastModified: d.publishedAt ?? undefined, changeFrequency: "weekly" as const, priority: 0.6 }));
  } catch (e) {
    console.error("Sitemap designs query failed:", e);
  }

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    ...bilingual("/", { lastModified: now, changeFrequency: "daily" as const, priority: 1.0 }),
    ...bilingual("/auth/login", { lastModified: now, changeFrequency: "monthly" as const, priority: 0.3 }),
    ...bilingual("/designs", { lastModified: now, changeFrequency: "daily" as const, priority: 0.8 }),
    ...bilingual("/trends", { lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 }),
    ...bilingual("/terms", { lastModified: now, changeFrequency: "yearly" as const, priority: 0.1 }),
    ...bilingual("/privacy", { lastModified: now, changeFrequency: "yearly" as const, priority: 0.1 }),
    ...bilingual("/data-deletion", { lastModified: now, changeFrequency: "yearly" as const, priority: 0.1 }),
    ...bilingual("/support", { lastModified: now, changeFrequency: "yearly" as const, priority: 0.1 }),
    ...bilingual("/auth/register", { lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 }),
  ];

  return [...staticPages, ...jobUrls, ...designUrls];
}
