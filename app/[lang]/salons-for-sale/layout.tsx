import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// page.tsx là client component → tiêu đề tab / thẻ chia sẻ khai báo ở đây.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/salons-for-sale", {
    title: ["Sang tiệm nail — tiệm nail cần sang, bán", "Nail salons for sale"],
    description: [
      "Tiệm nail đang sang / bán ở Mỹ và Úc: giá sang, tiền thuê, doanh thu, số ghế. Gọi hoặc nhắn tin trực tiếp cho chủ tiệm.",
      "Nail salons for sale in the US and Australia: asking price, rent, revenue and chairs. Call or message the owner directly.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
