import type { Metadata } from "next";
import { langFrom, trL } from "@/lib/i18n/server";

// Link đánh giá riêng của từng lịch hẹn: render theo request như trước khi có segment [lang]
// (không để ISR lưu một bản HTML cho mỗi token).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langFrom(params);
  return { title: trL(lang, "Đánh giá buổi làm nail", "Rate your nail appointment"), robots: { index: false } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
