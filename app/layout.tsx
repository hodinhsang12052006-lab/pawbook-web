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

export const metadata: Metadata = {
  title: "PawBook - Mạng Xã Hội Tuyển Dụng & HR cho IT/MMO",
  description: "Nền tảng mạng xã hội kết hợp tuyển dụng, chia sẻ kiến thức và quản lý nhân sự cho giới IT & MMO chuyên nghiệp.",
};

import FomoPopup from "@/components/FomoPopup";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full bg-slate-950 text-slate-50 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
        <Toaster position="top-center" />
        <FomoPopup />
        {children}
      </body>
    </html>
  );
}
