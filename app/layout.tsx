import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: 'PawNail Jobs — Việc Làm & Tay Nghề Nail US/AU',
  description: 'Nền tảng tuyển dụng & sàn tay nghề ngành Nail cho thị trường Mỹ (US) và Úc (AU).',
  manifest: '/manifest.json',
};

import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { SessionUserProvider } from "@/lib/SessionUserContext";
import { UnreadMessagesProvider } from "@/lib/UnreadMessagesContext";
import { CallManagerProvider } from "@/lib/CallManagerContext";
import FomoToast from "@/components/FomoToast";
import BottomNav from "@/components/layout/BottomNav";
import ScrollToTop from "@/components/layout/ScrollToTop";
import PusherStatusBanner from "@/components/PusherStatusBanner";
import NativeAppBridge from "@/components/NativeAppBridge";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full bg-slate-950 text-slate-50 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
        {/* Nền chung toàn app — xem .app-backdrop trong globals.css */}
        <div aria-hidden className="app-backdrop">
          <span className="aurora aurora-1" />
          <span className="aurora aurora-2" />
          <span className="aurora aurora-3" />
          <span className="beam" />
          <span className="grain" />
        </div>
        <LanguageProvider>
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
                {children}
                <FomoToast />
                <ScrollToTop />
                <BottomNav />
              </UnreadMessagesProvider>
            </CallManagerProvider>
          </SessionUserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
