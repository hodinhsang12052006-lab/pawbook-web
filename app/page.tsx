"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import JobBoard from "@/components/jobs/JobBoard";
import TechnicianGrid from "@/components/technicians/TechnicianGrid";
import SocialFeed from "@/components/feed/SocialFeed";
import { useSessionUser } from "@/lib/SessionUserContext";
import { stateName } from "@/lib/stateNames";
import { Sparkles, Search, Flame, Newspaper } from "lucide-react";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

type HomeTab = "feed" | "jobs" | "portfolio";

export default function HomePage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();

  // "feed" là mặc định mới — trang chủ giờ mở ra bằng newsfeed xã hội thay
  // vì bảng tin tuyển dụng thuần. Các luồng cũ (SalonDiagnosticModal, form
  // đăng ký) vẫn điều hướng thẳng bằng ?tab=jobs nên không bị ảnh hưởng.
  const [tab, setTab] = useState<HomeTab>("feed");
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  // Đọc ?tab=/?market=/?state= trên URL phía client (không dùng
  // useSearchParams để tránh buộc bọc Suspense — kết hợp với client
  // component gây double-render/kẹt loading trên Next 16 trong dev mode).
  // market/state đến từ SalonDiagnosticModal sau khi Chủ tiệm đăng ký xong,
  // để bộ lọc trang chủ tự khớp luôn với khu vực tiệm của họ.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    if (urlTab === "jobs" || urlTab === "portfolio" || urlTab === "feed") setTab(urlTab);
    const urlMarket = params.get("market");
    if (urlMarket === "US" || urlMarket === "AU") setMarket(urlMarket);
    const urlState = params.get("state");
    if (urlState) setState(urlState);
  }, []);

  // BottomNav (mounted globally in the root layout, outside this component's
  // tree — unlike Sidebar, which is a direct child here and gets setTab via
  // prop) can't reach this state directly. Tapping "Thợ"/"Trang chủ" there
  // while already on "/" is a same-route navigation, so the effect above
  // (mount-only) never re-runs to pick up the new ?tab= — this event is how
  // it gets through instead.
  useEffect(() => {
    const handler = (e: Event) => {
      const nextTab = (e as CustomEvent<string>).detail;
      if (nextTab === "jobs" || nextTab === "portfolio" || nextTab === "feed") setTab(nextTab);
    };
    window.addEventListener("hometab-change", handler);
    return () => window.removeEventListener("hometab-change", handler);
  }, []);

  const states = market === "US" ? US_STATES : AU_STATES;
  const showHero = !sessionLoading && !sessionUser;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      {/* HERO — chỉ hiện cho khách chưa đăng nhập, đánh thẳng thị giác 3 giây đầu */}
      {showHero && (
        <section className="relative overflow-hidden border-b border-slate-900">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 via-fuchsia-600/10 to-slate-950" />
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-14 text-center space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 px-3 py-1 text-xs font-bold text-pink-300 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> 100% miễn phí kết nối
            </span>

            <h1 className="text-3xl sm:text-5xl font-black leading-tight text-white tracking-tight">
              SÀN KẾT NỐI NGHỀ NAIL <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
                HẢI NGOẠI #1
              </span> TẠI MỸ &amp; ÚC
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
              #1 Nail Community Marketplace in the US &amp; Australia — nơi thợ tìm việc gấp, chủ tiệm tìm thợ giỏi, chỉ trong vài phút.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => router.push("/auth/register?role=technician")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 px-8 py-4 text-base font-extrabold text-white shadow-xl shadow-pink-600/30 transition-all active:scale-95"
              >
                💅 TÌM VIỆC LÀM NAIL
              </button>
              <button
                onClick={() => router.push("/auth/register?role=owner")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-8 py-4 text-base font-extrabold text-emerald-300 shadow-lg transition-all active:scale-95"
              >
                🏪 ĐĂNG TIN TUYỂN THỢ GẤP
              </button>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row gap-6">
          <Sidebar activeTab={tab} setActiveTab={(t) => setTab(t as any)} />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Region Switcher — nổi bật, chữ to, tương phản cao */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setMarket("US"); setState(""); }}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-extrabold transition-all active:scale-95 ${
                    market === "US"
                      ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-xl shadow-pink-600/25 scale-[1.02]"
                      : "bg-slate-950 text-slate-400 border-2 border-slate-800"
                  }`}
                >
                  <span className="text-2xl">🇺🇸</span> Mỹ <span className="text-xs font-semibold opacity-80">(US)</span>
                </button>
                <button
                  onClick={() => { setMarket("AU"); setState(""); }}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-extrabold transition-all active:scale-95 ${
                    market === "AU"
                      ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-xl shadow-pink-600/25 scale-[1.02]"
                      : "bg-slate-950 text-slate-400 border-2 border-slate-800"
                  }`}
                >
                  <span className="text-2xl">🇦🇺</span> Úc <span className="text-xs font-semibold opacity-80">(AU)</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setState("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-all active:scale-95 ${
                    state === "" ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  Tất cả bang
                </button>
                {states.map((s) => (
                  <button
                    key={s}
                    onClick={() => setState(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-all active:scale-95 ${
                      state === s ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {stateName(market, s)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Tìm theo thành phố... (VD: Los Angeles, Sydney)"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-900/40 border border-slate-850 sticky top-[68px] z-30 backdrop-blur-md">
              <button
                onClick={() => setTab("feed")}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  tab === "feed" ? "bg-pink-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Newspaper className="h-4 w-4" />
                <span className="hidden sm:inline">Bảng Tin</span>
              </button>
              <button
                onClick={() => setTab("jobs")}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  tab === "jobs" ? "bg-pink-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">Cần Thợ Gấp</span>
              </button>
              <button
                onClick={() => setTab("portfolio")}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  tab === "portfolio" ? "bg-pink-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Thợ Đang Rảnh</span>
              </button>
            </div>

            {tab === "feed" ? (
              <SocialFeed market={market} state={state} city={city} />
            ) : tab === "jobs" ? (
              <JobBoard market={market} state={state} city={city} />
            ) : (
              <TechnicianGrid market={market} state={state} city={city} />
            )}
          </div>
        </div>
      </main>

      <footer className="hidden md:block border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-600">
        <p>© 2026 PawNail Jobs. Nền tảng việc làm &amp; tay nghề Nail cho thị trường Mỹ &amp; Úc.</p>
      </footer>
    </div>
  );
}
