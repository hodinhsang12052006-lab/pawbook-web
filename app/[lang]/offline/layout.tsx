import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Trang dự phòng khi mất mạng (service worker phục vụ) — không lập chỉ mục.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/offline", { title: ["Không có mạng", "You're offline"], noindex: true });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
