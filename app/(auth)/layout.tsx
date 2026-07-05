import React from "react";
import Link from "next/link";
import { Sparkles, MessageSquareCode, ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="grid w-full grid-cols-1 lg:grid-cols-12">
        {/* Left column: Branding & Visuals (Visible only on large screens) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 lg:col-span-5 lg:flex">
          {/* Glowing blobs */}
          <div className="absolute top-0 left-0 -translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 translate-x-12 translate-y-12 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl"></div>

          {/* Abstract geometric background lines using SVG */}
          <div className="absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="grid"
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
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="relative z-10 flex items-center gap-3.5">
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

          <div className="relative z-10 my-auto max-w-sm space-y-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Siêu Ứng Dụng <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Dịch Vụ & Việc Làm Bản Địa
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              PawBook kết nối khách hàng với hàng ngàn nhà xe tự do, thợ sửa chữa, giúp việc, spa làm đẹp địa phương trên khắp cả nước với 0% phí chiết khấu nền tảng.
            </p>

            <div className="space-y-6 pt-6">
              <div className="flex gap-4 items-start">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0 animate-pulse">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-200">🚕 Gọi xe & Giao nhận 0% chiết khấu</h4>
                  <p className="text-2xs text-slate-450 leading-relaxed">Kết nối trực tiếp tài xế và khách hàng, tăng 100% thu nhập.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
                  <MessageSquareCode className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-200">🛠️ Dịch vụ tận cửa</h4>
                  <p className="text-2xs text-slate-450 leading-relaxed">Tìm thợ sửa chữa điện nước, giúp việc, dọn sofa, spa làm đẹp... chỉ với 1 chạm.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-200">🌍 Cộng đồng chia sẻ</h4>
                  <p className="text-2xs text-slate-450 leading-relaxed">Tham gia mạng lưới kết nối đa ngành nghề lớn nhất Việt Nam.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-500">
            © 2026 PawBook Platform. All rights reserved.
          </div>
        </div>

        {/* Right column: Auth Forms */}
        <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-7 lg:px-12 xl:col-span-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>
          {children}
        </div>
      </div>
    </div>
  );
}
