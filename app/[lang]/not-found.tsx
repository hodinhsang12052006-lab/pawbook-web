import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";
import { BRAND, langFrom, trL } from "@/lib/i18n/server";

// 404 TRONG app: notFound() của mọi trang dưới app/[lang] + mọi URL trang không khớp route nào
// (app/[lang]/[...missing]/page.tsx). Nằm trong layout [lang] → font app, nền mận, dock khi đã đăng nhập.
// Tiêu đề tab đúng ngôn ngữ thay cho tiêu đề mặc định của trang chủ.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langFrom(params);
  return {
    title: { absolute: `${trL(lang, "Không tìm thấy trang", "Page not found")} · ${BRAND}` },
    robots: { index: false },
  };
}

export default function NotFound() {
  return <NotFoundView />;
}
