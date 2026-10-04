"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import JobBoard from "@/components/jobs/JobBoard";
import TechnicianGrid from "@/components/technicians/TechnicianGrid";
import SocialFeed from "@/components/feed/SocialFeed";
import { useSessionUser } from "@/lib/SessionUserContext";
import { stateName } from "@/lib/stateNames";
import RightRail from "@/components/layout/RightRail";
import ToolsPanel from "@/components/layout/ToolsPanel";
import WelcomeBack from "@/components/layout/WelcomeBack";
import ProfileCompletenessCard from "@/components/profile/ProfileCompletenessCard";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import { Sparkles, Search, Flame, Newspaper, X } from "lucide-react";

// Lời chào theo giờ địa phương — chi tiết nhỏ giúp app có "hơi người".
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

const TAB_SUBTITLE: Record<"feed" | "jobs" | "portfolio", { owner: string; tech: string }> = {
  feed: { owner: "Cập nhật mới nhất từ cộng đồng nail quanh bạn.", tech: "Khoe tay nghề và xem tiệm nào đang tuyển quanh bạn." },
  jobs: { owner: "Xem các tiệm khác đang tuyển để đặt mức lương cạnh tranh.", tech: "Tin tuyển gấp mới nhất — gọi hoặc nhắn tin ngay cho tiệm." },
  portfolio: { owner: "Thợ đang sẵn sàng nhận việc — xem portfolio và nhắn tin trực tiếp.", tech: "Xem portfolio thợ khác để lấy cảm hứng mẫu mới." },
};

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

type HomeTab = "feed" | "jobs" | "portfolio";
const TAB_ORDER: HomeTab[] = ["feed", "jobs", "portfolio"];

// Vuốt ngang trên phần tử có thể cuộn ngang (hàng chip bang, hàng công cụ,
// ảnh nhiều tấm...) là để CUỘN chứ không phải đổi tab — bỏ qua những chỗ đó.
function insideHorizontalScroller(target: EventTarget | null, root: HTMLElement | null): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== root) {
    if (el.matches?.("input, textarea, video, [data-noswipe]")) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
    el = el.parentElement;
  }
  return false;
}

export default function HomePage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();

  // "feed" là mặc định mới — trang chủ giờ mở ra bằng newsfeed xã hội thay
  // vì bảng tin tuyển dụng thuần. Các luồng cũ (SalonDiagnosticModal, form
  // đăng ký) vẫn điều hướng thẳng bằng ?tab=jobs nên không bị ảnh hưởng.
  const [tab, setTab] = useState<HomeTab>("feed");
  // Hướng trượt của nội dung khi đổi tab (theo thứ tự tab).
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);

  // Đổi tab do người dùng (bấm / vuốt): tính hướng trượt, báo cho BottomNav
  // sáng đúng mục, cập nhật URL (không cuộn trang).
  const changeTab = (next: HomeTab) => {
    if (next === tab) return;
    setSlideDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? "right" : "left");
    setTab(next);
    window.dispatchEvent(new CustomEvent("hometab-change", { detail: next }));
    router.replace(`/?tab=${next}`, { scroll: false });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), skip: insideHorizontalScroller(e.target, contentRef.current) };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || start.skip) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Vuốt nhanh, rõ ràng theo chiều ngang (không nhầm với cuộn dọc).
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - start.t > 600) return;
    const i = TAB_ORDER.indexOf(tab);
    const next = TAB_ORDER[dx < 0 ? Math.min(i + 1, 2) : Math.max(i - 1, 0)];
    changeTab(next);
  };
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [showCitySearch, setShowCitySearch] = useState(false);

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
      if (nextTab === "jobs" || nextTab === "portfolio" || nextTab === "feed") {
        setTab((cur) => {
          if (cur !== nextTab) setSlideDir(TAB_ORDER.indexOf(nextTab) > TAB_ORDER.indexOf(cur) ? "right" : "left");
          return nextTab;
        });
      }
    };
    window.addEventListener("hometab-change", handler);
    return () => window.removeEventListener("hometab-change", handler);
  }, []);

  // Banner hoàn thiện hồ sơ trên mobile (Sidebar chỉ hiện ở desktop) — cho
  // phép ẩn trong 1 ngày để không làm phiền.
  const [hideCompleteness, setHideCompleteness] = useState(true);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem("pn_hide_completeness_until") || 0);
      setHideCompleteness(Date.now() < until);
    } catch {
      setHideCompleteness(false);
    }
  }, []);
  const dismissCompleteness = () => {
    setHideCompleteness(true);
    try {
      localStorage.setItem("pn_hide_completeness_until", String(Date.now() + 86_400_000));
    } catch {}
  };
  const completeness = getProfileCompleteness(sessionUser);
  // Tên đầy đủ — tên Việt (tên gọi ở cuối) và tên Anh (tên gọi ở đầu) không
  // tách chung 1 quy tắc được.
  const displayName = (sessionUser?.name || "").trim();

  const states = market === "US" ? US_STATES : AU_STATES;
  const showHero = !sessionLoading && !sessionUser;

  return (
    <div className="flex flex-col min-h-screen text-slate-100">
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

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-28 md:pb-8">
        <div className="flex flex-col md:flex-row gap-6">
          <Sidebar activeTab={tab} setActiveTab={(t) => changeTab(t as HomeTab)} />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Region Switcher — nổi bật, chữ to, tương phản cao */}
            {sessionUser && (
              <div className="px-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {greeting()}{displayName ? `, ${displayName}` : ""} 👋
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">{TAB_SUBTITLE[tab][sessionUser.role === "OWNER" ? "owner" : "tech"]}</p>
              </div>
            )}

            {sessionUser && <WelcomeBack onGoTab={changeTab} />}

            {sessionUser && <ToolsPanel variant="row" />}

            {completeness && completeness.percent < 100 && !hideCompleteness && (
              <div className="relative md:hidden">
                <ProfileCompletenessCard completeness={completeness} compact role={sessionUser?.role} />
                <button
                  onClick={dismissCompleteness}
                  aria-label="Ẩn gợi ý hoàn thiện hồ sơ"
                  className="absolute right-2 top-2 rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Bộ lọc — ĐIỆN THOẠI: gọn 1 hàng (Mỹ/Úc · chip bang vuốt ngang · 🔍),
                trước đây chiếm ~200px khiến nội dung bị đẩy xuống dưới màn hình đầu. */}
            <div className="glass-card space-y-2 rounded-2xl p-2 md:hidden">
              <div className="flex items-center gap-2">
                <div className="flex flex-shrink-0 rounded-full bg-slate-950/70 p-0.5 ring-1 ring-white/10" role="group" aria-label="Thị trường">
                  {(["US", "AU"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMarket(m); setState(""); }}
                      aria-pressed={market === m}
                      className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${market === m ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow" : "text-slate-400"}`}
                    >
                      {m === "US" ? "🇺🇸 Mỹ" : "🇦🇺 Úc"}
                    </button>
                  ))}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {["", ...states].map((s) => (
                    <button
                      key={s || "all"}
                      onClick={() => setState(s)}
                      className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold ring-1 transition-all active:scale-95 ${
                        state === s ? "bg-pink-600 text-white ring-pink-600" : "bg-slate-950/60 text-slate-400 ring-slate-800"
                      }`}
                    >
                      {s ? stateName(market, s) : "Tất cả bang"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCitySearch((v) => !v)}
                  aria-label="Tìm theo thành phố"
                  aria-expanded={showCitySearch || !!city}
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 transition-colors ${showCitySearch || city ? "bg-pink-500/15 text-pink-300 ring-pink-500/40" : "text-slate-400 ring-slate-800"}`}
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
              {(showCitySearch || city) && (
                <div className="relative animate-fadeIn">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    autoFocus={showCitySearch && !city}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Thành phố… (VD: Houston, Sydney)"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                  />
                  {city && (
                    <button onClick={() => { setCity(""); setShowCitySearch(false); }} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:text-slate-200">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bộ lọc — MÁY TÍNH: đầy đủ như cũ */}
            <div className="glass-card hidden space-y-3 rounded-2xl p-3 sm:p-4 md:block">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-1 border border-slate-800/80">
                <button
                  onClick={() => { setMarket("US"); setState(""); }}
                  aria-pressed={market === "US"}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-95 ${
                    market === "US"
                      ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-600/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="text-lg leading-none">🇺🇸</span> Mỹ · US
                </button>
                <button
                  onClick={() => { setMarket("AU"); setState(""); }}
                  aria-pressed={market === "AU"}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-95 ${
                    market === "AU"
                      ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-600/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="text-lg leading-none">🇦🇺</span> Úc · AU
                </button>
              </div>

              {/* Mobile: 1 hàng vuốt ngang thay vì 4 hàng chip chiếm nửa màn hình. */}
              <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  onClick={() => setState("")}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold border transition-all active:scale-95 ${
                    state === "" ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  Tất cả bang
                </button>
                {states.map((s) => (
                  <button
                    key={s}
                    onClick={() => setState(s)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold border transition-all active:scale-95 ${
                      state === s ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
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
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Tabs */}
            {/* Dính ngay dưới Navbar (64px + 1px viền). Trước đây top-[68px] để hở
                3px — bài viết cuộn qua lộ thành vệt phía trên thanh tab. Lớp nền
                mờ bọc ngoài che luôn phần nội dung cuộn phía sau. */}
            <div className="sticky top-[65px] z-30 -mx-1 px-1 pt-2 pb-1 bg-[#020617]/85 backdrop-blur-md">
              <div role="tablist" aria-label="Nội dung trang chủ" className="relative grid grid-cols-3 rounded-xl border border-slate-800/80 bg-slate-900/80 p-1 shadow-lg shadow-black/20">
                {/* Viên chọn trượt mượt sang tab đang mở */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-gradient-to-r from-pink-600 to-fuchsia-600 shadow-lg shadow-pink-600/25 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(${TAB_ORDER.indexOf(tab) * 100}%)` }}
                />
                {([
                  { id: "feed", icon: Newspaper, short: "Bảng tin", long: "Bảng tin" },
                  { id: "jobs", icon: Flame, short: "Việc gấp", long: "Cần thợ gấp" },
                  { id: "portfolio", icon: Sparkles, short: "Thợ rảnh", long: "Thợ đang rảnh" },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => changeTab(t.id)}
                    className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg py-3 text-xs font-bold transition-colors duration-200 active:scale-95 sm:text-sm ${
                      tab === t.id ? "text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    <span><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.long}</span></span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vuốt trái/phải trên điện thoại để chuyển tab; nội dung trượt vào theo hướng vuốt. */}
            <div ref={contentRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[50vh]">
              <div key={tab} className={slideDir === "right" ? "tab-in-right" : slideDir === "left" ? "tab-in-left" : ""}>
            {tab === "feed" ? (
              <SocialFeed market={market} state={state} city={city} />
            ) : tab === "jobs" ? (
              <JobBoard market={market} state={state} city={city} />
            ) : (
              <TechnicianGrid market={market} state={state} city={city} />
            )}
              </div>
            </div>
          </div>

          {sessionUser && <RightRail market={market} state={state} />}
        </div>
      </main>

      <footer className="hidden md:block border-t border-slate-900/80 bg-slate-950/40 py-6 text-center text-xs text-slate-600">
        <p>© 2026 PawNail Jobs. Nền tảng việc làm &amp; tay nghề Nail cho thị trường Mỹ &amp; Úc.</p>
      </footer>
    </div>
  );
}
