import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { placeLabel } from "@/lib/stateNames";
import { firstImage, jobPostingLd } from "@/lib/jobPostingLd";
import { SITE_URL } from "@/lib/siteUrl";
import { isDemoEmail } from "@/lib/demo";
import { effectiveExpiry, isPastExpiry, isRemovedJob } from "@/lib/jobIngest/ingest";

const JOB_SELECT = { id: true, title: true, salonName: true, description: true, salaryType: true, salaryAmount: true, city: true, state: true, market: true, skills: true, benefits: true, createdAt: true, expiresAt: true, source: true, owner: { select: { email: true } } } as const;
const GENERIC: Metadata = { title: "Tin tuyển dụng — PawNail Jobs" };

// Tiêu đề tab + bản xem trước khi chia sẻ tin tuyển (nút Chia sẻ trên trang
// tin): "Cần thợ Gel-X · Sunny Nails — $1,300/tuần · Houston, Texas".
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (!j) return GENERIC;
    // Tin đã gỡ theo yêu cầu tiệm: không còn tên tiệm / tiêu đề trong thẻ chia sẻ, không lập chỉ mục
    if (isRemovedJob(j)) return { ...GENERIC, robots: { index: false, follow: false } };
    // Ảnh tiệm nằm ở bảng riêng JobMedia (có thể chưa có bảng ở DB cũ → bỏ qua).
    const media = await prisma.jobMedia.findUnique({ where: { jobId: id }, select: { mediaUrls: true } }).catch(() => null);
    const title = `${j.title} · ${j.salonName} — PawNail Jobs`;
    // Tin đăng hộ / từ nhóm cộng đồng: tiệm chưa dùng app → chỉ gọi trực tiếp (không "nhắn tin")
    const description = j.source
      ? `${j.salaryAmount} · ${placeLabel(j.city, j.market, j.state)}. Gọi trực tiếp cho tiệm trên PawNail Jobs.`
      : `${j.salaryAmount} · ${placeLabel(j.city, j.market, j.state)}. Gọi hoặc nhắn tin trực tiếp cho tiệm trên PawNail Jobs.`;
    const image = firstImage(media?.mediaUrls);
    const expired = isPastExpiry(effectiveExpiry(j));
    return {
      title,
      description,
      // Tin MẪU / tin từ nhóm / đăng hộ / tin đã hết hạn: không cho Google lập chỉ mục (Google for Jobs phạt tin không còn tuyển).
      ...(isDemoEmail(j.owner?.email) || j.source || expired ? { robots: { index: false, follow: false } } : {}),
      alternates: { canonical: `${SITE_URL}/jobs/${j.id}` },
      openGraph: { title, description, url: `${SITE_URL}/jobs/${j.id}`, siteName: "PawNail Jobs", type: "website", ...(image ? { images: [{ url: image }] } : {}) },
      twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch {
    return GENERIC;
  }
}

// Dữ liệu JobPosting cho Google tìm việc — render phía máy chủ ngay trong HTML.
// Chỉ tin chủ tiệm TỰ ĐĂNG, tài khoản thật, CÒN HẠN; validThrough = hạn thật (lúc tin tự ẩn khỏi bảng việc).
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ld: object | null = null;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (j && !isDemoEmail(j.owner?.email) && !j.source) {
      const validThrough = effectiveExpiry(j);
      if (!isPastExpiry(validThrough)) ld = jobPostingLd({ ...j, validThrough });
    }
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
