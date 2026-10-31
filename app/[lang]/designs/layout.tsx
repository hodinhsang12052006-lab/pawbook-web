import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab + bản xem trước theo ngôn ngữ (page.tsx là client component).
// Trang con /designs/[id] tự khai metadata riêng và ghi đè phần này.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/designs", {
    title: ["Mẫu nail mỗi ngày", "Daily nail design ideas"],
    description: [
      "Mẫu nail mới mỗi ngày kèm vật tư, các bước, thời gian làm và giá gợi ý — lưu mẫu, thử trên tay bạn hoặc gửi cho tiệm.",
      "New nail design ideas every day with materials, steps, timing and a suggested price — save a look, try it on your hand or send it to your salon.",
    ],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
