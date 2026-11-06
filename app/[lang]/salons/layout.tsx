import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/salons", {
    title: ["Tiệm & thợ nail gần bạn", "Nail salons & techs near you"],
    description: [
      "Xem tác phẩm thật, menu và giá, rồi gửi yêu cầu đặt lịch.",
      "Browse real work, menus and prices, then request a booking.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
