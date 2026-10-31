import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/salons", {
    title: ["Tiệm & thợ nail quanh bạn", "Nail salons & techs near you"],
    description: [
      "Xem ảnh tác phẩm thật, bảng giá và đánh giá của khách trước khi đặt lịch — nhắn tin trực tiếp cho tiệm. Tại Mỹ và Úc.",
      "See real work, prices and client reviews before you book, and message salons directly. US & Australia.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
