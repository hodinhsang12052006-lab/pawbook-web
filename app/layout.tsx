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
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: 'BitPawOS',
  description: 'Mạng xã hội MMO & Công nghệ',
  manifest: '/manifest.json',
  icons: {
    icon: '/cho1.jpg',
    shortcut: '/cho1.jpg',
    apple: '/cho1.jpg',
  },
};

import FomoPopup from "@/components/FomoPopup";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

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
        <LanguageProvider>
          <Toaster position="top-center" />
          <FomoPopup />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
