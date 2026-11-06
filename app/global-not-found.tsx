import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { SearchX, Home } from "lucide-react";
import "./globals.css";

// 404 cho URL KHÔNG khớp route nào (vd. /abc/xyz, /vi/khong-co). Layout gốc nằm dưới app/[lang] nên trang này
// tự dựng <html>/<body> và là HTML TĨNH dùng chung mọi ngôn ngữ. Chỉ hiện MỘT ngôn ngữ: tiếng Anh mặc định;
// script nhỏ đổi sang tiếng Việt trước khi vẽ khi người xem đã chọn tiếng Việt (cookie bitpaw_locale), hoặc
// chưa chọn mà ngôn ngữ ĐẦU TIÊN của trình duyệt là tiếng Việt / URL dưới /vi — cùng quy tắc với
// lib/i18n/config.ts. Trang gọi notFound() bên trong app VÀ mọi URL trang không khớp (app/[lang]/[...missing])
// dùng app/[lang]/not-found.tsx — đúng ngôn ngữ, có dock. Trang này chỉ còn cho URL nằm ngoài cây ngôn ngữ
// (vd. đường dẫn có đuôi tệp không tồn tại) — vẫn cùng diện mạo 404 trong app (font, nền mận, biểu tượng).
// Bật bằng experimental.globalNotFound trong next.config.ts.
export const metadata: Metadata = {
  title: "Page not found · PawNail",
  robots: { index: false },
};

// Cùng font chữ app với app/[lang]/layout.tsx (--font-pn, áp qua html:not([data-ui-classic]) body trong globals.css).
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-pn",
  weight: ["400", "600"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const VI = {
  title: "Không tìm thấy trang",
  body: "Trang này không tồn tại hoặc tin đã bị gỡ.", // cùng câu với 404 trong app (components/NotFoundView.tsx)
  home: "Về trang chủ",
};

const SWAP = `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)bitpaw_locale=(en|vi)(?:;|$)/);var l=c?c[1]:(/^\\/vi(\\/|$)/.test(location.pathname)||/^vi\\b/i.test((navigator.languages&&navigator.languages[0])||navigator.language||""))?"vi":"en";if(l!=="vi")return;document.documentElement.lang="vi";document.title="Không tìm thấy trang · PawNail";var n=document.querySelectorAll("[data-vi]");for(var i=0;i<n.length;i++)n[i].textContent=n[i].getAttribute("data-vi");var h=document.getElementById("pn-404-home");if(h)h.setAttribute("href","/vi");}catch(e){}})();`;

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning className={`${beVietnam.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-50 antialiased">
        {/* Nền chung toàn app (gradient mận + ánh sáng tĩnh) — xem .app-backdrop trong globals.css */}
        <div aria-hidden className="app-backdrop">
          <span className="aurora aurora-1" />
          <span className="aurora aurora-2" />
          <span className="aurora aurora-3" />
          <span className="aurora aurora-4" />
          <span className="glitter" />
          <span className="beam" />
          <span className="grain" />
        </div>
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div className="relative z-10 flex max-w-sm flex-col items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10">
              <SearchX aria-hidden className="h-6 w-6 text-pink-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-white" data-vi={VI.title} suppressHydrationWarning>Page not found</h1>
              <p className="text-sm text-slate-400" data-vi={VI.body} suppressHydrationWarning>This page doesn&apos;t exist or the post was removed.</p>
            </div>
            {/* <a> thay vì <Link>: trang này nằm ngoài cây layout của app. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              id="pn-404-home"
              href="/"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              <Home aria-hidden className="h-4 w-4" />
              <span data-vi={VI.home} suppressHydrationWarning>Back to home</span>
            </a>
          </div>
        </main>
        <script dangerouslySetInnerHTML={{ __html: SWAP }} />
      </body>
    </html>
  );
}
