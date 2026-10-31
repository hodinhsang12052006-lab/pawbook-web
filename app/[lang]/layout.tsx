import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "../globals.css";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { alternates, langFrom, openGraph } from "@/lib/i18n/server";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
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
    alternates: alternates("/", lang),
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <head>
        {/* Chrome có thể bắn "beforeinstallprompt" trước khi React chạy — bắt sớm cho nút Cài app (components/InstallPrompt.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;if(localStorage.getItem("pn_authed"))d.setAttribute("data-authed","");if(localStorage.getItem("pn_onb"))d.setAttribute("data-onb","");if(localStorage.getItem("pn_mn"))d.setAttribute("data-mn","");var pv=localStorage.getItem("pn_pv_h");if(pv){d.setAttribute("data-pv","");d.style.setProperty("--pv-h",pv+"px")}if(localStorage.getItem("pn_cmp"))d.setAttribute("data-cmp","");var th=localStorage.getItem("pn_th_h");if(th){d.setAttribute("data-th","");d.style.setProperty("--th-h",th+"px")}}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pnBIP=e;window.dispatchEvent(new Event("pn-bip"))});`,
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
                      background: "rgba(15, 23, 42, 0.92)",
                      color: "#f1f5f9",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      borderRadius: "14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      boxShadow: "0 10px 30px -12px rgba(0,0,0,0.7)",
                      backdropFilter: "blur(12px)",
                      maxWidth: "92vw",
                    },
                    success: { iconTheme: { primary: "#34d399", secondary: "#0f172a" } },
                    error: { iconTheme: { primary: "#fb7185", secondary: "#0f172a" } },
                    loading: { iconTheme: { primary: "#f472b6", secondary: "#0f172a" } },
                  }}
                />
                <PusherStatusBanner />
                <NativeAppBridge />
                <ServiceWorkerRegister />
                {children}
                <FomoToast />
                <RefCapture />
                <InstallPrompt />
                <PushPrompt />
                <ScrollToTop />
                <BottomNav />
                <LanguageHints />
              </UnreadMessagesProvider>
            </CallManagerProvider>
          </SessionUserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
