import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/jobs/create", {
    title: ["Đăng tin tuyển thợ", "Post a nail tech job"],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
