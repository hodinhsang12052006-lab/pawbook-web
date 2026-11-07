import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { Be_Vietnam_Pro, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "../globals.css";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { langFrom, openGraph } from "@/lib/i18n/server";
import { BUBBLE_HEAD_JS } from "@/lib/bubbleMode";

// Layout GỐC nằm dưới segment [lang]: mỗi trang được prerender 1 lần cho mỗi ngôn
// ngữ (/en/…, /vi/…) và edge rewrite trong next.config.ts chọn bản đúng theo
// cookie / Accept-Language — HTML tĩnh, không gọi function, không nháy tiếng Việt.
// Xem lib/i18n/config.ts.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}
export const dynamicParams = false;

// "vietnamese" + "latin-ext": dấu ạ, ế, ở… dùng đúng font Geist thay vì rơi về
// font hệ thống. unicode-range → khách EN không tải các tệp này.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

// Chữ trong app (V2): Be Vietnam Pro — SIL OFL 1.1, đủ dấu tiếng Việt, tự host qua next/font (không gọi Google lúc chạy).
// Chỉ áp cho html:not([data-ui-classic]) trong globals.css; trang khách "/" + /auth/* giữ font cũ.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-pn",
  weight: ["400", "600"],
  subsets: ["latin", "vietnamese"], // latin-ext không cần (EN + VI) — bớt file tải trước trên mọi trang
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Cho phép phóng to chữ (WCAG 1.4.4). Chống iOS tự zoom khi chạm ô nhập: globals.css ép mọi ô nhập trong app ≥ 16px
  // trên điện thoại, và trên iOS cả trang classic (khách "/", /auth/*) — không cần maximum-scale nữa.
  themeColor: "#1c1521",
};

const SITE_TITLE = {
  en: "PawNail — Nail Try-On, Salons & Nail Tech Jobs",
  vi: "PawNail — Thử mẫu nail, tìm tiệm & việc làm nail",
};
const SITE_DESCRIPTION = {
  en: "Try on nail looks on your own hand, find a salon and request a booking. Nail techs showcase their work and find jobs; salons hire. US & Australia.",
  vi: "Thử mẫu nail trên chính tay bạn, tìm tiệm và gửi yêu cầu đặt lịch. Thợ nail giới thiệu tay nghề và tìm việc; tiệm tuyển thợ. Tại Mỹ và Úc.",
};

// Mặc định tiếng Anh (URL không tiền tố, x-default); bản tiếng Việt cho /vi/….
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langFrom(params);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_TITLE[lang], template: "%s · PawNail" },
    description: SITE_DESCRIPTION[lang],
    manifest: "/manifest.json",
    applicationName: "PawNail",
    openGraph: openGraph(lang, { title: SITE_TITLE[lang], description: SITE_DESCRIPTION[lang] }),
  };
}

// Cho Google biết TÊN thương hiệu + LOGO (hiện ở kết quả tìm kiếm thay cho tên miền / ảnh cũ).
function siteLd(lang: Locale) {
  return JSON.stringify([
    { "@context": "https://schema.org", "@type": "WebSite", name: "PawNail", alternateName: ["PawNail Jobs", "BitPawOS"], url: `${SITE_URL}/`, inLanguage: lang === "vi" ? "vi-VN" : "en-US" },
    { "@context": "https://schema.org", "@type": "Organization", name: "PawNail", url: `${SITE_URL}/`, logo: `${SITE_URL}/icon.jpg` },
  ]);
}

import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import LanguageHints from "@/components/i18n/LanguageHints";
import { SessionUserProvider } from "@/lib/SessionUserContext";
import { UnreadMessagesProvider } from "@/lib/UnreadMessagesContext";
import { CallManagerProvider } from "@/lib/CallManagerContext";
import FomoToast from "@/components/FomoToast";
import RefCapture from "@/components/RefCapture";
import InstallPrompt from "@/components/InstallPrompt";
import BottomNav from "@/components/layout/BottomNav";
import ScrollToTop from "@/components/layout/ScrollToTop";
import PusherStatusBanner from "@/components/PusherStatusBanner";
import NativeAppBridge from "@/components/NativeAppBridge";
import PushPrompt from "@/components/PushPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import NotInBubble from "@/components/NotInBubble";

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const lang = await langFrom(params);
  return (
    <html
      lang={lang}
      suppressHydrationWarning // data-authed do script đầu trang đặt trước khi React chạy
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${beVietnam.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        {/* Chrome có thể bắn "beforeinstallprompt" trước khi React chạy — bắt sớm cho nút Cài app (components/InstallPrompt.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,p=location.pathname;${BUBBLE_HEAD_JS}if(p==="/vi"||p==="/en")p="/";else if(p.indexOf("/vi/")===0||p.indexOf("/en/")===0)p=p.slice(3);if(p.indexOf("/auth")===0)d.setAttribute("data-ui-classic","");if(p==="/"&&!localStorage.getItem("pn_authed"))d.setAttribute("data-ui-classic","");if(localStorage.getItem("pn_authed"))d.setAttribute("data-authed","");if(localStorage.getItem("pn_onb"))d.setAttribute("data-onb","");if(localStorage.getItem("pn_mn"))d.setAttribute("data-mn","");var pv=localStorage.getItem("pn_pv_h");if(pv){d.setAttribute("data-pv","");d.style.setProperty("--pv-h",pv+"px")}if(localStorage.getItem("pn_cmp"))d.setAttribute("data-cmp","");var th=localStorage.getItem("pn_th_h");if(th){d.setAttribute("data-th","");d.style.setProperty("--th-h",th+"px")}}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pnBIP=e;window.dispatchEvent(new Event("pn-bip"))});`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteLd(lang) }} />
      </head>
      <body className="min-h-full bg-slate-950 text-slate-50 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
        {/* Nền chung toàn app — xem .app-backdrop trong globals.css */}
        <div aria-hidden className="app-backdrop">
          <span className="aurora aurora-1" />
          <span className="aurora aurora-2" />
          <span className="aurora aurora-3" />
          <span className="aurora aurora-4" />
          <span className="glitter" />
          <span className="beam" />
          <span className="grain" />
        </div>
        <LanguageProvider initialLocale={lang}>
          <SessionUserProvider>
            <CallManagerProvider>
              <UnreadMessagesProvider>
                {/* Toast mặc định của react-hot-toast là nền TRẮNG — chọi
                    hẳn với giao diện nền tối, trông như lỗi. Đặt theme tối +
                    viền kính dùng chung cho toàn bộ 80+ chỗ gọi toast, khỏi
                    sửa từng nơi. */}
                <Toaster
                  position="top-center"
                  // Hiện NGAY DƯỚI Navbar (64px) — trước đây toast đè lên thanh
                  // trên cùng, che mất chuông 🔔 / nút tin nhắn trên điện thoại.
                  containerStyle={{ top: 76 }}
                  toastOptions={{
                    style: {
                      background: "#2e2433",
                      color: "#f6f0f5",
                      border: "1px solid rgba(255,240,246,0.09)",
                      borderRadius: "14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      boxShadow: "0 2px 6px rgba(8,4,10,0.4), 0 16px 40px -12px rgba(8,4,10,0.75)",
                      maxWidth: "92vw",
                    },
                    success: { iconTheme: { primary: "#34d399", secondary: "#2e2433" } },
                    error: { iconTheme: { primary: "#fb7185", secondary: "#2e2433" } },
                    loading: { iconTheme: { primary: "#f59bbe", secondary: "#2e2433" } },
                  }}
                />
                {/* Bong bóng chat Android (html[data-bubble], lib/bubbleMode.ts): ẩn mọi lớp phủ toàn app — chỉ còn khung chat */}
                <div data-bubble-hide className="contents">
                  <NotInBubble>
                    <PusherStatusBanner />
                  </NotInBubble>
                </div>
                <NativeAppBridge />
                <ServiceWorkerRegister />
                {children}
                <RefCapture />
                <div data-bubble-hide className="contents">
                  <NotInBubble>
                    <FomoToast />
                    <InstallPrompt />
                    <PushPrompt />
                    <ScrollToTop />
                    <BottomNav />
                    <LanguageHints />
                  </NotInBubble>
                </div>
              </UnreadMessagesProvider>
            </CallManagerProvider>
          </SessionUserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
