import type { Metadata, Viewport } from "next";
import { langFrom, pageMetadata } from "@/lib/i18n/server";

// Tiêu đề tab riêng cho trang (page.tsx là client component nên không tự
// khai báo metadata được).
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/messages", {
    title: ["Tin nhắn", "Messages"],
    noindex: true,
  });
}

// Chrome / Firefox Android: bàn phím ảo CO trang lại (như WebView của app với adjustResize) thay vì phủ lên rồi kéo cả trang
// lên để lộ ô nhập (mặc định resizes-visual: thanh trên trôi khỏi màn hình, khung chat lệch tới khi đóng bàn phím).
// Các trường khác giữ như app/[lang]/layout.tsx. iOS bỏ qua interactive-widget.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1521",
  interactiveWidget: "resizes-content",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
