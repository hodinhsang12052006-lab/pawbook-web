"use client";

import React, { createContext, useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon, Globe } from "lucide-react";

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
          {/* Left column: Branding & Visuals */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-800 p-12 lg:col-span-5 lg:flex">
            {/* Glowing blobs */}
            <div className="absolute top-0 left-0 -translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 translate-x-12 translate-y-12 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>

            {/* Abstract geometric background lines using SVG */}
            <div className="absolute inset-0 opacity-10 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
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
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#custom-grid)" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col justify-center h-full space-y-8 my-auto">
              {/* Thương hiệu */}
              <div className="flex items-center gap-3.5">
                <Link href="/" className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-0.5 shadow-xl shadow-black/10">
                    <img
                      src="/cho1.jpg"
                      alt="PawBook Logo"
                      className="h-full w-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-white text-3xl font-black tracking-widest uppercase select-none">
                    PawBook
                  </span>
                </Link>
              </div>

              {/* Slogan Tối thượng */}
              <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Nền Tảng Đa Dịch Vụ <br />Thế Hệ Mới
              </h1>

              {/* Mô tả ngắn gọn */}
              <p className="text-lg text-blue-100 font-medium max-w-md">
                Trải nghiệm hệ sinh thái kết nối không giới hạn. An toàn, tức thì và hoàn toàn không chiết khấu.
              </p>
            </div>

            <div className="absolute bottom-12 left-12 z-10 text-xs text-blue-200/60">
              © 2026 PawBook Platform. All rights reserved.
            </div>
          </div>

          {/* Right column: Auth Forms */}
          <div className={`relative flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-7 lg:px-12 xl:col-span-7 transition-colors duration-300 ${
            theme === "dark" ? "bg-slate-950" : "bg-gray-50"
          }`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>
            <div className="relative z-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </AuthSettingsContext.Provider>
  );
}
