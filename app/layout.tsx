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
        <LanguageProvider>
          <SessionUserProvider>
            <CallManagerProvider>
              <UnreadMessagesProvider>
                <Toaster position="top-center" />
                <PusherStatusBanner />
                <NativeAppBridge />
                {children}
                <FomoToast />
                <BottomNav />
              </UnreadMessagesProvider>
            </CallManagerProvider>
          </SessionUserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
