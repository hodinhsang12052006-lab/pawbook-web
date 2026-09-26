"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sun, Moon, Globe } from "lucide-react";
import { SPARKLE_DOTS } from "@/lib/sparkleDots";
import { AuthSettingsContext } from "@/lib/AuthSettingsContext";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { TOTAL_DEMAND_COUNT } from "@/lib/nailRadarData";

// Trang đăng nhập/đăng ký này chính là "trang chủ" thật sự với khách vãng
// lai — mọi lượt vào "/" khi chưa đăng nhập đều redirect thẳng về đây, nên
// con số FOMO đầu tiên khách thấy PHẢI là số thật (không còn "2.500+ Thợ &
// Chủ" bịa) để nhất quán với Nail Radar/JobBoard/FomoToast đã dùng data thật.
const TOTAL_DEMAND_ALL_MARKETS = TOTAL_DEMAND_COUNT.US + TOTAL_DEMAND_COUNT.AU;

export default function CustomAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const { locale, setLocale, t } = useLanguage();

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <AuthSettingsContext.Provider value={{ theme, toggleTheme }}>
      <div className={`flex min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-slate-900"
      }`}>

        {/* Floating controls in the upper right */}
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3 pt-[env(safe-area-inset-top)]">
          {/* Language Selector Dropdown — dùng chung useLanguage() với toàn app
              (persist localStorage sẵn), không còn state lang riêng cục bộ. */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-slate-200/20 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <Globe className={`h-4 w-4 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`} />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as "vi" | "en")}
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
              theme === "dark" ? "text-amber-400" : "text-indigo-600"
            }`}
            title={theme === "dark" ? t("auth.switchToLight") : t("auth.switchToDark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid w-full grid-cols-1 lg:grid-cols-12">
          {/* Left column: Branding & Visuals — layered "aurora" background:
              deep slate base + slow-drifting blurred color blobs (fuchsia/
              purple quartz + royal indigo/violet + a soft champagne gold
              accent) + a faint drifting grid + a scatter of twinkling
              sparkle dots. Everything animates via transform/opacity only
              (see globals.css) so it stays smooth without a JS render loop.

              `lg:self-start` opts this grid item out of the default
              `align-items: stretch` — without it, this column's box would
              stretch to match the right column's full content height (a
              long form can run well past 100vh), so `justify-center`
              centered against that oversized box instead of the actual
              viewport. `lg:sticky lg:top-0 lg:h-screen` then pins it to
              exactly one screen's height for the scroll duration, so it
              stays put and correctly centered while the form scrolls past
              on the right. */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:col-span-5 lg:flex lg:sticky lg:top-0 lg:h-screen lg:self-start">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

            <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-[100px] animate-aurora-a" />
            <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-purple-600/25 blur-[110px] animate-aurora-b" />
            <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-indigo-600/25 blur-[100px] animate-aurora-c" />
            <div className="absolute bottom-1/4 -left-12 h-64 w-64 rounded-full bg-violet-600/20 blur-[90px] animate-aurora-b" style={{ animationDelay: "-9s" }} />
            <div className="absolute top-1/2 right-1/4 h-56 w-56 rounded-full bg-amber-200/10 blur-[90px] animate-aurora-c" style={{ animationDelay: "-4s" }} />

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

            <div className="relative z-10 flex flex-col justify-center items-start h-full space-y-6">
              {/* Khối thương hiệu — bọc glassmorphism để tách khỏi nền aurora,
                  đọc rõ hơn và trông premium hơn thay vì chữ nổi trần trên nền. */}
              <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-2xl p-8 rounded-3xl space-y-6 animate-fadeIn">
                <Link href="/" className="flex items-center gap-3.5">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-0.5 shadow-xl shadow-pink-950/30">
                    <img
                      src="/cho1.jpg"
                      alt="PawNail Jobs Logo"
                      className="h-full w-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-white text-3xl font-black tracking-widest uppercase select-none">
                    PawNail Jobs
                  </span>
                </Link>

                <h1 className="text-4xl lg:text-5xl leading-tight tracking-tight">
                  <span className="block font-extrabold text-white">{t("auth.brand.tagline1")}</span>
                  <span className="block font-black bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
                    {t("auth.brand.tagline2")}
                  </span>
                </h1>

                <p className="text-lg text-slate-300 font-medium max-w-md">
                  {t("auth.brand.description")}
                </p>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-2.5 animate-fadeIn" style={{ animationDelay: "0.15s" }}>
                {[t("auth.brand.trustBadge1", { count: TOTAL_DEMAND_ALL_MARKETS }), t("auth.brand.trustBadge2"), t("auth.brand.trustBadge3")].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute bottom-12 left-12 z-10 text-xs text-slate-500">
              {t("auth.brand.copyright")}
            </div>
          </div>

          {/* Right column: Auth Forms */}
          <div className={`relative flex flex-col pt-6 pb-12 lg:py-12 lg:justify-center px-4 sm:px-6 lg:col-span-7 lg:px-12 xl:col-span-7 transition-colors duration-300 overflow-hidden pb-[calc(env(safe-area-inset-bottom)+3rem)] ${
            theme === "dark" ? "bg-slate-950" : "bg-gray-50"
          }`}>
            {/* Ambient glow — echoes the left panel's aurora at low opacity
                so the split feels like one continuous background, not two
                unrelated panels bolted together. */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className={`absolute -top-20 -right-20 h-96 w-96 rounded-full blur-[120px] animate-breathe ${theme === "dark" ? "bg-purple-600/10" : "bg-pink-400/10"}`} />
              <div className={`absolute -bottom-24 -left-16 h-80 w-80 rounded-full blur-[120px] animate-breathe ${theme === "dark" ? "bg-indigo-600/10" : "bg-indigo-300/10"}`} style={{ animationDelay: "-3.5s" }} />
            </div>

            {/* Mobile-only branding banner — compact "native app" header: logo
                (iOS-standard squircle rounding), flag/market badge with a
                glowing glass border, wordmark, and a short slogan. The left
                aurora panel above is `hidden lg:flex`, so on mobile (now the
                true front door for every anonymous visitor since proxy.ts
                redirects "/" here) this is the only branding visible. */}
            <div className="lg:hidden relative z-10 -mx-4 sm:-mx-6 mb-8 overflow-hidden border-b border-slate-800/60 bg-slate-950 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 sm:px-6">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
              <div className="absolute -top-10 -right-6 h-40 w-40 rounded-full bg-fuchsia-600/25 blur-[70px] animate-aurora-a" />
              <div className="absolute -bottom-14 -left-6 h-36 w-36 rounded-full bg-indigo-600/20 blur-[70px] animate-aurora-b" />
              <div className="absolute inset-0 pointer-events-none">
                {SPARKLE_DOTS.slice(0, 5).map((dot, i) => (
                  <span key={i} className="absolute h-1 w-1 rounded-full bg-white animate-twinkle" style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }} />
                ))}
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link href="/" className="flex items-center gap-2.5">
                  <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[22%] border border-white/20 bg-white/10 p-0.5 shadow-lg shadow-pink-950/30">
                    <img src="/cho1.jpg" alt="PawNail Jobs" className="h-full w-full object-cover rounded-[20%]" />
                  </div>
                  <span className="text-white text-base font-black tracking-widest uppercase leading-none whitespace-nowrap">PawNail Jobs</span>
                </Link>
                <span className="rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-3 py-1.5 text-[10px] font-bold text-slate-200 shadow-[0_0_12px_rgba(217,70,239,0.35)] whitespace-nowrap">
                  🇺🇸 US &amp; 🇦🇺 AU Nail Network
                </span>
              </div>
              <p className="relative z-10 mt-2.5 text-[11px] text-slate-400">
                {t("auth.brand.mobileTagline")}
              </p>
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
