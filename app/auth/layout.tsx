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
          <div className="absolute top-0 left-0 -translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-blue-650/10 blur-3xl"></div>
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

          <div className="relative z-10 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 overflow-hidden rounded-lg border border-blue-500/30 bg-blue-500/10 p-0.5 shadow-lg shadow-blue-500/10">
                <img
                  src="/cho1.jpg"
                  alt="PawBook Logo"
                  className="h-full w-full object-cover rounded-md"
                />
              </div>
              <span className="bg-gradient-to-r from-blue-450 to-indigo-450 bg-clip-text text-lg font-bold tracking-wider text-transparent">
                PawBook
              </span>
            </Link>
          </div>

          <div className="relative z-10 my-auto max-w-sm space-y-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Nơi kết nối <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Cộng đồng IT & MMO
              </span>
            </h1>
            <p className="text-xs leading-relaxed text-slate-400">
              PawBook là mạng xã hội kết hợp tuyển dụng chuyên biệt đầu tiên dành cho giới lập trình viên và MMO Master. Tìm kiếm việc làm, chia sẻ bí quyết, và quản lý nhân sự hiệu quả.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Chia sẻ kiến thức & FOMO</h4>
                  <p className="text-3xs text-slate-500">Cập nhật tin tức thị trường và xu hướng MMO/IT hot nhất.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
                  <MessageSquareCode className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Tìm việc làm chất lượng cao</h4>
                  <p className="text-3xs text-slate-500">Tiếp cận trực tiếp với các nhà tuyển dụng và dự án outsourcing MMO xịn.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Bảo mật thông tin</h4>
                  <p className="text-3xs text-slate-500">Được bảo vệ bởi hệ thống bảo mật cấp cao của NextAuth.js.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-500">
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
