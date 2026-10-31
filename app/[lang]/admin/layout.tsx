import type { Metadata } from "next";
import { langFrom, trL } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được). Khu quản trị là nội bộ, chỉ có tiếng Việt — không
// lập chỉ mục (robots.ts cũng chặn /admin và /vi/admin).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langFrom(params);
  return { title: trL(lang, "Quản trị", "Admin"), robots: { index: false, follow: false } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
