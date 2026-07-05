import React from "react";
import Link from "next/link";
import { Sparkles, MessageSquareCode, ShieldCheck } from "lucide-react";

export default function CustomAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="grid w-full grid-cols-1 lg:grid-cols-12">
        {/* Left column: Branding & Visuals */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 lg:col-span-5 lg:flex border-r border-slate-850">
          {/* Glowing blobs */}
          <div className="absolute top-0 left-0 -translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-blue-655/10 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 translate-x-12 translate-y-12 h-80 w-80 rounded-full bg-indigo-655/15 blur-3xl"></div>

          {/* Abstract geometric background lines using SVG */}
          <div className="absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="custom-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#custom-grid)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col justify-center h-full space-y-8 my-auto">
            {/* Thành phần 1: Thương hiệu */}
            <div className="flex items-center gap-3.5">
              <Link href="/" className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-blue-500/40 bg-blue-500/10 p-0.5 shadow-xl shadow-blue-500/20">
                  <img
                    src="/cho1.jpg"
                    alt="PawBook Logo"
                    className="h-full w-full object-cover rounded-lg"
                  />
                </div>
                <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-3xl font-black tracking-widest text-transparent uppercase select-none">
                  PawBook
                </span>
              </Link>
            </div>

            {/* Thành phần 2: Slogan Tối thượng */}
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Nền Tảng Đa Dịch Vụ <br />Thế Hệ Mới
            </h1>

            {/* Thành phần 3: Mô tả ngắn gọn */}
            <p className="text-lg text-slate-400 font-medium max-w-md">
              Trải nghiệm hệ sinh thái kết nối không giới hạn. An toàn, tức thì và hoàn toàn không chiết khấu.
            </p>
          </div>

          <div className="absolute bottom-12 left-12 z-10 text-xs text-slate-500">
            © 2026 PawBook Platform. All rights reserved.
          </div>
        </div>

        {/* Right column: Auth Forms */}
        <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-7 lg:px-12 xl:col-span-7 bg-[#050814]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>
          {children}
        </div>
      </div>
    </div>
  );
}
