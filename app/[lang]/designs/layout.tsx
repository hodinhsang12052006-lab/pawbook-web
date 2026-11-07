import type { Metadata } from "next";
import { preconnect } from "react-dom";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
// Trang con /designs/[id] tự khai metadata riêng và ghi đè phần này.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/designs", {
    title: ["Mẫu nail mới mỗi ngày", "Nail design ideas, updated daily"],
    description: [
      "Ý tưởng mẫu nail mới mỗi ngày, kèm vật tư, các bước làm và giá gợi ý. Thử mẫu trên chính tay bạn.",
      "New nail designs every day with materials, steps and a suggested price. Try any look on your own hand.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  // Design pictures live on Cloudinary and the grid is fetched client-side: open the connection while the JS loads
  // (saves the DNS + TLS round trips on the first card, i.e. the LCP image on a phone).
  preconnect("https://res.cloudinary.com");
  return children;
}
