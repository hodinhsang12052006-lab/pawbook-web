import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { stateName } from "@/lib/stateNames";
import { firstImage, jobPostingLd } from "@/lib/jobPostingLd";
import { SITE_URL } from "@/lib/siteUrl";

const JOB_SELECT = { id: true, title: true, salonName: true, description: true, salaryType: true, salaryAmount: true, city: true, state: true, market: true, skills: true, benefits: true, createdAt: true } as const;

// Tiêu đề tab + bản xem trước khi chia sẻ tin tuyển (nút Chia sẻ trên trang
// tin): "Cần thợ Gel-X · Sunny Nails — $1,300/tuần · Houston, Texas".
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (!j) return { title: "Tin tuyển dụng — PawNail Jobs" };
    // Ảnh tiệm nằm ở bảng riêng JobMedia (có thể chưa có bảng ở DB cũ → bỏ qua).
    const media = await prisma.jobMedia.findUnique({ where: { jobId: id }, select: { mediaUrls: true } }).catch(() => null);
    const title = `${j.title} · ${j.salonName} — PawNail Jobs`;
    const description = `${j.salaryAmount} · ${j.city}, ${stateName(j.market, j.state)}. Gọi hoặc nhắn tin trực tiếp cho tiệm trên PawNail Jobs.`;
    const image = firstImage(media?.mediaUrls);
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/jobs/${j.id}` },
      openGraph: { title, description, url: `${SITE_URL}/jobs/${j.id}`, siteName: "PawNail Jobs", type: "website", ...(image ? { images: [{ url: image }] } : {}) },
      twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch {
    return { title: "Tin tuyển dụng — PawNail Jobs" };
  }
}

// Dữ liệu JobPosting cho Google tìm việc — render phía máy chủ ngay trong HTML.
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ld: object | null = null;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (j) ld = jobPostingLd(j);
  } catch {}
  return (
    <>
      {ld && (
        <script
          type="application/ld+json"
          // JSON.stringify + thay "<" để nội dung tin (do người dùng nhập) không thể đóng thẻ script.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
        />
      )}
      {children}
    </>
  );
}
