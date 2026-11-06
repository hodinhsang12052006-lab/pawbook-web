import type { Metadata } from "next";
import "./globals.css";

// 404 cho URL KHÔNG khớp route nào (vd. /abc/xyz, /vi/khong-co). Layout gốc nằm dưới app/[lang] nên trang này
// tự dựng <html>/<body> và là HTML TĨNH dùng chung mọi ngôn ngữ. Chỉ hiện MỘT ngôn ngữ: tiếng Anh mặc định;
// script nhỏ đổi sang tiếng Việt trước khi vẽ khi người xem đã chọn tiếng Việt (cookie bitpaw_locale), hoặc
// chưa chọn mà ngôn ngữ ĐẦU TIÊN của trình duyệt là tiếng Việt / URL dưới /vi — cùng quy tắc với
// lib/i18n/config.ts. Trang gọi notFound() bên trong app dùng app/[lang]/not-found.tsx — đúng ngôn ngữ.
// Bật bằng experimental.globalNotFound trong next.config.ts.
export const metadata: Metadata = {
  title: "Page not found · PawNail",
  robots: { index: false },
};

const VI = {
  title: "Không tìm thấy trang",
  body: "Trang không tồn tại hoặc tin đã bị gỡ.",
  home: "Về trang chủ",
};

const SWAP = `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)bitpaw_locale=(en|vi)(?:;|$)/);var l=c?c[1]:(/^\\/vi(\\/|$)/.test(location.pathname)||/^vi\\b/i.test((navigator.languages&&navigator.languages[0])||navigator.language||""))?"vi":"en";if(l!=="vi")return;document.documentElement.lang="vi";document.title="Không tìm thấy trang · PawNail";var n=document.querySelectorAll("[data-vi]");for(var i=0;i<n.length;i++)n[i].textContent=n[i].getAttribute("data-vi");var h=document.getElementById("pn-404-home");if(h)h.setAttribute("href","/vi");}catch(e){}})();`;

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div aria-hidden className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[100px]" />
          <div aria-hidden className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="relative z-10 flex max-w-sm flex-col items-center gap-5">
            <p className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400">404</p>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-white" data-vi={VI.title} suppressHydrationWarning>Page not found</h1>
              <p className="text-sm text-slate-400" data-vi={VI.body} suppressHydrationWarning>This page doesn&apos;t exist or the post was removed.</p>
            </div>
            {/* <a> thay vì <Link>: trang này nằm ngoài cây layout của app. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              id="pn-404-home"
              href="/"
              data-vi={VI.home}
              suppressHydrationWarning
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              Back to home
            </a>
          </div>
        </main>
        <script dangerouslySetInnerHTML={{ __html: SWAP }} />
      </body>
    </html>
  );
}
