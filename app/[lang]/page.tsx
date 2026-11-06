import type { Metadata } from "next";
import HomePage from "@/components/home/HomePage";
import { alternates, langFrom } from "@/lib/i18n/server";

// Trang chủ. canonical + hreflang ("/" ↔ "/vi") khai Ở ĐÂY, không ở layout gốc: layout gốc bọc mọi trang, khai
// ở đó thì mọi trang không tự khai (/offline, /auth/complete, tin đã hết hạn…) đều nhận canonical = trang chủ.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return { alternates: alternates("/", await langFrom(params)) };
}

export default function Page() {
  return <HomePage />;
}
