"use client";

import React, { createContext, useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon, Globe } from "lucide-react";

// Vị trí cố định (không random) — nếu random mỗi lần render, HTML server và
// client sẽ lệch nhau và React báo lỗi hydration mismatch.
const SPARKLE_DOTS = [
  { top: "12%", left: "18%", delay: "0s" },
  { top: "22%", left: "68%", delay: "-0.8s" },
  { top: "8%", left: "42%", delay: "-1.6s" },
  { top: "35%", left: "85%", delay: "-2.2s" },
  { top: "48%", left: "10%", delay: "-0.4s" },
  { top: "58%", left: "55%", delay: "-1.2s" },
  { top: "64%", left: "30%", delay: "-2.6s" },
  { top: "72%", left: "78%", delay: "-1.8s" },
  { top: "82%", left: "22%", delay: "-0.6s" },
  { top: "88%", left: "60%", delay: "-2.0s" },
  { top: "28%", left: "5%", delay: "-1.4s" },
  { top: "16%", left: "92%", delay: "-2.8s" },
  { top: "44%", left: "35%", delay: "-1.0s" },
  { top: "68%", left: "48%", delay: "-0.2s" },
];

export const AuthSettingsContext = createContext<{
  theme: "light" | "dark";
  toggleTheme: () => void;
  lang: "vi" | "en";
  setLang: (l: "vi" | "en") => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
  lang: "vi",
  setLang: () => {}
});

export default function CustomAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lang, setLang] = useState<"vi" | "en">("vi");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <AuthSettingsContext.Provider value={{ theme, toggleTheme, lang, setLang }}>
      <div className={`flex min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-slate-900"
      }`}>
        
        {/* Floating controls in the upper right */}
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
          {/* Language Selector Dropdown */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-slate-200/20 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <Globe className={`h-4 w-4 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`} />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "vi" | "en")}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer border-none p-0 ${
                theme === "dark" ? "text-slate-200 option:bg-slate-900" : "text-slate-800 option:bg-white"
              }`}
            >
              <option value="vi" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>VN</option>
              <option value="en" className={theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>EN</option>
            </select>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 ${
              theme === "dark" ? "text-amber-400" : "text-indigo-650"
            }`}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid w-full grid-cols-1 lg:grid-cols-12">
          {/* Left column: Branding & Visuals — layered "aurora" background:
              deep slate base + slow-drifting blurred color blobs + a faint
              drifting grid + a scatter of twinkling sparkle dots. Everything
              animates via transform/opacity only (see globals.css) so it
              stays smooth without a JS render loop. */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:col-span-5 lg:flex">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

            <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-pink-600/30 blur-[100px] animate-aurora-a" />
            <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/25 blur-[110px] animate-aurora-b" />
            <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-[100px] animate-aurora-c" />
            <div className="absolute bottom-1/4 -left-12 h-64 w-64 rounded-full bg-purple-600/20 blur-[90px] animate-aurora-b" style={{ animationDelay: "-9s" }} />

            {/* Faint drifting grid for a premium "tech platform" texture */}
            <div
              className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)] animate-grid-drift"
              style={{
                backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* Sparkle glitter — nod to the nail industry, fixed positions
                (never randomized) so server/client markup always matches. */}
            <div className="absolute inset-0 pointer-events-none">
              {SPARKLE_DOTS.map((dot, i) => (
                <span
                  key={i}
                  className="absolute h-1 w-1 rounded-full bg-white animate-twinkle"
                  style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }}
                />
              ))}
            </div>

            <div className="relative z-10 flex flex-col justify-center h-full space-y-8 my-auto">
              {/* Thương hiệu */}
              <div className="flex items-center gap-3.5 animate-fadeIn">
                <Link href="/" className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-0.5 shadow-xl shadow-pink-950/30">
                    <img
                      src="/cho1.jpg"
                      alt="PawBook Logo"
                      className="h-full w-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-white text-3xl font-black tracking-widest uppercase select-none">
                    PawNail Jobs
                  </span>
                </Link>
              </div>

              {/* Slogan Tối thượng */}
              <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight animate-fadeIn" style={{ animationDelay: "0.1s" }}>
                Việc Làm Nail <br />
                <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                  Mỹ 🇺🇸 &amp; Úc 🇦🇺
                </span>
              </h1>

              {/* Mô tả ngắn gọn */}
              <p className="text-lg text-slate-300 font-medium max-w-md animate-fadeIn" style={{ animationDelay: "0.2s" }}>
                Kết nối chủ tiệm cần thợ gấp và thợ nail đang tìm việc — chỉ trong vài phút.
              </p>
            </div>

            <div className="absolute bottom-12 left-12 z-10 text-xs text-slate-500">
              © 2026 PawNail Jobs. All rights reserved.
            </div>
          </div>

          {/* Right column: Auth Forms */}
          <div className={`relative flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-7 lg:px-12 xl:col-span-7 transition-colors duration-300 overflow-hidden ${
            theme === "dark" ? "bg-slate-950" : "bg-gray-50"
          }`}>
            {/* Ambient glow — echoes the left panel's aurora at low opacity
                so the split feels like one continuous background, not two
                unrelated panels bolted together. */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className={`absolute -top-20 -right-20 h-96 w-96 rounded-full blur-[120px] animate-breathe ${theme === "dark" ? "bg-pink-600/10" : "bg-pink-400/10"}`} />
              <div className={`absolute -bottom-24 -left-16 h-80 w-80 rounded-full blur-[120px] animate-breathe ${theme === "dark" ? "bg-fuchsia-600/10" : "bg-indigo-300/10"}`} style={{ animationDelay: "-3.5s" }} />
            </div>
            <div className="relative z-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </AuthSettingsContext.Provider>
  );
}
