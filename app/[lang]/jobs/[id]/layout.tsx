import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { placeLabel } from "@/lib/stateNames";
import { firstImage, jobPostingLd } from "@/lib/jobPostingLd";
import { SITE_URL } from "@/lib/siteUrl";
import { isDemoEmail } from "@/lib/demo";
import { dtEn } from "@/lib/i18n/dtEn";
import { localePath } from "@/lib/i18n/config";
import { langFrom, openGraph, trL } from "@/lib/i18n/server";

const JOB_SELECT = { id: true, title: true, salonName: true, description: true, salaryType: true, salaryAmount: true, city: true, state: true, market: true, skills: true, benefits: true, createdAt: true, source: true, owner: { select: { email: true } } } as const;

type Params = Promise<{ lang: string; id: string }>;

// Tiêu đề tab + bản xem trước khi chia sẻ tin tuyển (nút Chia sẻ trên trang
// tin): "Gel-X tech needed · Sunny Nails, Houston, Texas".
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lang = await langFrom(params);
  const fallback = { title: trL(lang, "Tin tuyển dụng", "Nail tech job") };
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (!j) return fallback;
    // Ảnh tiệm nằm ở bảng riêng JobMedia (có thể chưa có bảng ở DB cũ → bỏ qua).
    const media = await prisma.jobMedia.findUnique({ where: { jobId: id }, select: { mediaUrls: true } }).catch(() => null);
    const place = placeLabel(j.city, j.market, j.state);
    const title = lang === "vi" ? `${j.title} · ${j.salonName}, ${place}` : `${dtEn(j.title)} · ${j.salonName}, ${place}`;
    const description =
      lang === "vi"
        ? `${j.salaryAmount} · ${place}. Gọi hoặc nhắn tin trực tiếp cho tiệm trên PawNail.`
        : `${dtEn(j.salaryAmount)} · ${place}. Call or message the salon directly on PawNail.`;
    const image = firstImage(media?.mediaUrls);
    // Nội dung tin do tiệm viết (gần như luôn bằng tiếng Việt) → bản chuẩn là /vi/jobs/…;
    // bản EN chỉ dịch giao diện nên không khai hreflang riêng.
    const canonical = localePath(`/jobs/${j.id}`, "vi");
    return {
      title,
      description,
      // Tin MẪU: không cho Google lập chỉ mục (Google for Jobs phạt tin tuyển không có thật).
      ...(isDemoEmail(j.owner?.email) || j.source ? { robots: { index: false, follow: false } } : {}), // tin mẫu / tin tổng hợp
      alternates: { canonical },
      openGraph: openGraph(lang, { title, description, url: `${SITE_URL}${localePath(`/jobs/${j.id}`, lang)}`, ...(image ? { images: [{ url: image }] } : {}) }),
      twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch {
    return fallback;
  }
}

// Dữ liệu JobPosting cho Google tìm việc — render phía máy chủ ngay trong HTML.
export default async function Layout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { id } = await params;
  let ld: object | null = null;
  try {
    const j = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });
    if (j && !isDemoEmail(j.owner?.email) && !j.source) ld = jobPostingLd(j); // Google for Jobs: chỉ tin chủ tiệm tự đăng
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
