import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { SearchX, Home } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import "./globals.css";
import "@/components/marketing/marketing.css";

// 404 cho URL KHÔNG khớp route nào (vd. /abc/xyz, /vi/khong-co). Layout gốc nằm dưới app/[lang] nên trang này
// tự dựng <html>/<body> và là HTML TĨNH dùng chung mọi ngôn ngữ. Chỉ hiện MỘT ngôn ngữ: tiếng Anh mặc định;
// script nhỏ đổi sang tiếng Việt trước khi vẽ khi người xem đã chọn tiếng Việt (cookie bitpaw_locale), hoặc
// chưa chọn mà ngôn ngữ ĐẦU TIÊN của trình duyệt là tiếng Việt / URL dưới /vi — cùng quy tắc với
// lib/i18n/config.ts. Trang gọi notFound() bên trong app VÀ mọi URL trang không khớp (app/[lang]/[...missing])
// dùng app/[lang]/not-found.tsx — đúng ngôn ngữ, có dock. Trang này chỉ còn cho URL nằm ngoài cây ngôn ngữ
// (vd. đường dẫn có đuôi tệp không tồn tại) — vẫn cùng diện mạo V2 của app: thanh trên có logo B + chữ PawNail
// (về trang chủ, như Navbar), nền mận, nút hồng đặc (.pn-cta), lối đi tiếp tới Việc làm / Mẫu nail.
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
  jobs: "Việc làm nail",
  designs: "Mẫu nail",
  nav: "Đi tới",
};

// Tiếng Việt: chữ trong [data-vi]; link nội bộ [data-vi-href] chuyển sang bản /vi (trang này nằm ngoài cây [lang]).
// Tiêu đề tab: Next đặt lại <title> theo metadata (EN) lúc hydrate → giữ tiêu đề tiếng Việt bằng MutationObserver.
const SWAP = `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)bitpaw_locale=(en|vi)(?:;|$)/);var l=c?c[1]:(/^\\/vi(\\/|$)/.test(location.pathname)||/^vi\\b/i.test((navigator.languages&&navigator.languages[0])||navigator.language||""))?"vi":"en";if(l!=="vi")return;document.documentElement.lang="vi";var T="Không tìm thấy trang · PawNail";document.title=T;new MutationObserver(function(){if(document.title!==T)document.title=T}).observe(document.head,{childList:true,subtree:true,characterData:true});var n=document.querySelectorAll("[data-vi]");for(var i=0;i<n.length;i++)n[i].textContent=n[i].getAttribute("data-vi");var a=document.querySelectorAll("[data-vi-label]");for(i=0;i<a.length;i++)a[i].setAttribute("aria-label",a[i].getAttribute("data-vi-label"));var h=document.querySelectorAll("[data-vi-href]");for(i=0;i<h.length;i++)h[i].setAttribute("href",h[i].getAttribute("data-vi-href"));}catch(e){}})();`;

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning className={`${beVietnam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-50 antialiased">
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
        {/* Thanh trên như Navbar: logo B + chữ PawNail, là link về trang chủ (<a>: trang nằm ngoài cây layout của app). */}
        <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-pn-canvas">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-3 min-[400px]:px-4 sm:px-6 lg:px-8">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" data-vi-href="/vi" className="flex shrink-0 items-center gap-2 rounded-xl min-[400px]:gap-2.5" aria-label="PawNail">
              <span className="pn-nav-logo">
                <BrandLogo size={36} />
              </span>
              <span className="pn-wordmark">PawNail</span>
            </a>
          </div>
        </header>
        <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10">
              <SearchX aria-hidden className="h-6 w-6 text-pink-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-white" data-vi={VI.title} suppressHydrationWarning>Page not found</h1>
              <p className="text-sm text-slate-400" data-vi={VI.body} suppressHydrationWarning>This page doesn&apos;t exist or the post was removed.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a id="pn-404-home" href="/" data-vi-href="/vi" className="pn-btn pn-cta pn-cta--block">
              <Home aria-hidden className="h-4 w-4" />
              <span data-vi={VI.home} suppressHydrationWarning>Back to home</span>
            </a>
            <nav aria-label="Go to" data-vi-label={VI.nav} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/?tab=jobs" data-vi-href="/vi?tab=jobs" className="pn-link" data-vi={VI.jobs} suppressHydrationWarning>Nail jobs</a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/designs" data-vi-href="/vi/designs" className="pn-link" data-vi={VI.designs} suppressHydrationWarning>Nail designs</a>
            </nav>
          </div>
        </main>
        <script dangerouslySetInnerHTML={{ __html: SWAP }} />
      </body>
    </html>
  );
}
