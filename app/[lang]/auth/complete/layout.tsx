import type { Metadata } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Bước hoàn tất sau đăng nhập Google / Apple — trang riêng tư, không lập chỉ mục.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/auth/complete", { title: ["Hoàn tất đăng ký", "Finish signing up"], noindex: true });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
