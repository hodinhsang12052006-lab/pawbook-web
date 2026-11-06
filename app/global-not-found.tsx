import type { Metadata } from "next";
import "./globals.css";

// 404 cho URL KHÔNG khớp route nào (vd. /abc/xyz, /en/khong-co). Layout gốc nằm
// dưới app/[lang] nên trang này tự dựng <html>/<body> và là HTML tĩnh duy nhất cho
// mọi ngôn ngữ: tiếng Anh trước, 1 dòng tiếng Việt bên dưới. Trang gọi notFound()
// bên trong app (mẫu nail bị gỡ…) dùng app/[lang]/not-found.tsx — đúng ngôn ngữ.
// Bật bằng experimental.globalNotFound trong next.config.ts.
export const metadata: Metadata = {
  title: "Page not found · PawNail",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div aria-hidden className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[100px]" />
          <div aria-hidden className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="relative z-10 flex max-w-sm flex-col items-center gap-5">
            <p className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400">404</p>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-white">Page not found</h1>
              <p className="text-sm text-slate-400">This page doesn&apos;t exist or the post was removed.</p>
              <p lang="vi" className="text-xs text-slate-500">Không tìm thấy trang — trang không tồn tại hoặc tin đã bị gỡ.</p>
            </div>
            {/* <a> thay vì <Link>: trang này nằm ngoài cây layout của app. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              Back to home<span lang="vi" className="font-semibold text-white/70">&nbsp;· Về trang chủ</span>
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
