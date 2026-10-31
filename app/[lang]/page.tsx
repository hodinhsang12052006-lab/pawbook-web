"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import HeroPulse from "@/components/home/HeroPulse";
import GuestDiscover from "@/components/home/GuestDiscover";
import ClientHome from "@/components/client/ClientHome";
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
import ProfileViewsCard from "@/components/profile/ProfileViewsCard";
import GettingStarted from "@/components/onboarding/GettingStarted";
import MenuNudge from "@/components/menu/MenuNudge";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import { Sparkles, Search, Newspaper, X, Briefcase, Store, Hand, ArrowRight, Compass, Users } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Lời chào theo giờ địa phương — chi tiết nhỏ giúp app có "hơi người".
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return tr("Chào buổi sáng", "Good morning");
  if (h < 14) return tr("Chào buổi trưa", "Good afternoon");
  if (h < 18) return tr("Chào buổi chiều", "Good afternoon");
  return tr("Chào buổi tối", "Good evening");
}

// Hàm (không phải hằng số) để đọc đúng ngôn ngữ hiện tại mỗi lần render.
const tabSubtitle = (): Record<"feed" | "jobs" | "portfolio", { owner: string; tech: string; admin?: string }> => ({
  feed: { admin: tr("Theo dõi bảng tin, duyệt nội dung và hỗ trợ thành viên.", "Keep an eye on the feed, review content and support members."), owner: tr("Cập nhật mới từ thợ và tiệm nail quanh bạn.", "Updates from nail techs and salons near you."), tech: tr("Chia sẻ tác phẩm và xem tiệm nào đang tuyển quanh bạn.", "Share your work and see which salons are hiring near you.") },
  jobs: { owner: tr("Xem các tiệm khác đang tuyển để đặt mức lương cạnh tranh.", "See what other salons offer to set a competitive rate."), tech: tr("Việc làm mới gần bạn — gọi hoặc nhắn tin trực tiếp cho tiệm.", "New jobs near you — call or message the salon directly.") },
  portfolio: { owner: tr("Thợ sẵn sàng nhận việc — xem tay nghề và nhắn tin trực tiếp.", "Techs open to work — view portfolios and message directly."), tech: tr("Xem tay nghề của thợ khác để lấy cảm hứng mẫu mới.", "Browse other techs’ portfolios for new design ideas.") },
});

const noopSubscribe = () => () => {};
const readAuthedHint = () => document.documentElement.hasAttribute("data-authed");

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
  useTr(); // render lại khi đổi VI/EN
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
  // Nhớ "thẻ hoàn thiện hồ sơ có hiện" cho lần tải sau (html[data-cmp]) — giữ chỗ 128px khi đang tải.
  const cmpShown = !!completeness && completeness.percent < 100 && !hideCompleteness;
  useEffect(() => {
    if (sessionLoading || tab !== "feed") return;
    try {
      if (cmpShown) localStorage.setItem("pn_cmp", "1");
      else localStorage.removeItem("pn_cmp");
      document.documentElement.toggleAttribute("data-cmp", cmpShown);
    } catch {}
  }, [sessionLoading, cmpShown, tab]);
  // Tên đầy đủ — tên Việt (tên gọi ở cuối) và tên Anh (tên gọi ở đầu) không
  // tách chung 1 quy tắc được.
  const displayName = (sessionUser?.name || "").trim();

  const states = market === "US" ? US_STATES : AU_STATES;
  // Khách: hero có sẵn ngay trong HTML đầu tiên (trước đây chờ tải phiên ~1s rồi mới chen vào,
  // đẩy cả trang xuống — CLS 0.8). Máy từng đăng nhập → CSS ẩn ngay từ đầu (html[data-authed]).
  const showHero = !sessionUser;
  // Trang chủ cho khách chưa đăng nhập = "Khám phá" (mẫu nail, thử mẫu, tìm tiệm) thay cho bảng tin.
  // HTML đầu tiên luôn là bản cho khách; máy từng đăng nhập (html[data-authed], script đầu trang) chuyển
  // sang bảng tin ngay sau khi hydrate — server snapshot = false nên không lệch hydrate.
  const authedHint = useSyncExternalStore(noopSubscribe, readAuthedHint, () => false);
  const guestView = !sessionUser && !(sessionLoading && authedHint);

  // Khách đi làm nail: trang chủ riêng (mẫu, tiệm quanh bạn, đặt lịch) — không lẫn việc làm / tuyển thợ.
  if (sessionUser?.role === "CLIENT") {
    return (
      <div className="flex min-h-screen flex-col text-slate-100">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28 md:pb-8">
          <ClientHome user={sessionUser} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-slate-100">
      <Navbar />

      {/* HERO — chỉ hiện cho khách chưa đăng nhập, đánh thẳng thị giác 3 giây đầu */}
      {showHero && (
        <section className={`relative overflow-hidden border-b border-slate-900 ${sessionLoading ? "[html[data-authed]_&]:hidden" : ""}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 via-fuchsia-600/10 to-slate-950" />
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div aria-hidden className="hero-spot pointer-events-none absolute inset-0" />
          <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />

          <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14 text-center space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 px-3 py-1 text-xs font-semibold text-pink-200">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />{tr("Dành cho khách, thợ nail và chủ tiệm · Mỹ & Úc", "For nail clients, technicians and salons · US & Australia")}
            </span>

            <h1 data-hero-title className="hero-title-glow text-3xl sm:text-5xl font-black leading-tight text-white tracking-tight [text-wrap:balance]">
              {tr("Nền tảng chuyên nghiệp", "The platform for")}<br />
              <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
                {tr("cho ngành nail", "the nail industry")}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {tr("Thử mẫu và đặt lịch. Tìm nơi làm phù hợp. Tuyển thợ cho tiệm. PawNail kết nối khách, thợ nail và chủ tiệm trên khắp nước Mỹ và Úc.", "Try on a look and book it. Find your next chair. Hire your next tech. PawNail brings nail clients, technicians and salons together across the US and Australia.")}
            </p>

            {/* Ba lối vào ngang hàng: khách · thợ · chủ tiệm (khách không còn là đường link phụ) */}
            <div className="grid gap-3 pt-2 text-left sm:grid-cols-3">
              {([
                { key: "client", icon: Hand, title: tr("Bạn là khách làm nail", "Getting your nails done"), desc: tr("Thử mẫu, tìm tiệm, gửi yêu cầu đặt lịch", "Try on looks, find a salon, request a booking"), cta: tr("Thử mẫu trên tay", "Try on nail looks"), href: "/tryon", tone: "from-pink-600 to-fuchsia-600 shadow-pink-600/30", ring: "ring-pink-500/30 hover:ring-pink-400/60" },
                { key: "tech", icon: Briefcase, title: tr("Thợ nail", "Nail technicians"), desc: tr("Giới thiệu tay nghề và tìm nơi làm phù hợp", "Showcase your work and find your next chair"), cta: tr("Xem việc làm nail", "Explore nail jobs"), href: "/?tab=jobs", tone: "from-fuchsia-600 to-violet-600 shadow-fuchsia-600/30", ring: "ring-fuchsia-500/30 hover:ring-fuchsia-400/60" },
                { key: "owner", icon: Store, title: tr("Chủ tiệm", "Salon owners"), desc: tr("Tuyển thợ, chia sẻ menu, nhận đặt lịch", "Hire techs, share your menu, take bookings"), cta: tr("Tuyển thợ nail", "Hire nail techs"), href: "/auth/register?role=owner", tone: "from-violet-600 to-purple-600 shadow-violet-600/30", ring: "ring-violet-500/30 hover:ring-violet-400/60" },
              ] as const).map((p) => (
                <a
                  key={p.key}
                  href={p.href}
                  onClick={(e) => {
                    e.preventDefault();
                    if (p.key === "tech") {
                      changeTab("jobs");
                      document.querySelector("[data-home-tabs]")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    } else router.push(p.href);
                  }}
                  className={`group flex flex-col rounded-2xl bg-slate-950/50 p-4 ring-1 backdrop-blur transition-all active:scale-[0.98] sm:p-5 ${p.ring}`}
                >
                  <span className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-3">
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${p.tone}`}>
                      <p.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-white">{p.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-400">{p.desc}</span>
                    </span>
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-pink-300 group-hover:text-pink-200 sm:mt-auto sm:pt-4">
                    {p.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              ))}
            </div>
            <p className="text-xs text-slate-400">{tr("Không thu phí thợ và tiệm · Có tiếng Anh và tiếng Việt", "No fees for techs or salons · Available in English and Tiếng Việt")}</p>
            <HeroPulse />
          </div>
        </section>
      )}

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-28 md:pb-8">
        <div className="flex flex-col md:flex-row gap-6">
          <Sidebar activeTab={tab} setActiveTab={(t) => changeTab(t as HomeTab)} guest={guestView} />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Đang tải phiên trên máy từng đăng nhập: giữ sẵn chỗ cho lời chào + lối tắt + thẻ "Bắt đầu"
                đúng kích thước thật → bảng tin không bị đẩy xuống khi tải xong (CLS). */}
            {sessionLoading && (
              <div aria-hidden className="hidden space-y-5 [html[data-authed]_&]:block">
                <div className="h-[50px] px-1 pt-1 md:h-[54px]"><div className="h-6 w-56 rounded-lg bg-white/[0.05]" /><div className="mt-2 h-3.5 w-40 rounded bg-white/[0.04]" /></div>
                {tab === "feed" && <div className="h-[98px] rounded-2xl bg-white/[0.03] md:hidden" />}
                <div className="hidden h-[246px] rounded-2xl bg-white/[0.03] ring-1 ring-white/5 [html[data-onb]_&]:block" />
              </div>
            )}

            {/* Region Switcher — nổi bật, chữ to, tương phản cao */}
            {sessionUser && (
              <div className="px-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {greeting()}{displayName ? `, ${displayName}` : ""}
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">{(sessionUser.role === "ADMIN" && tabSubtitle()[tab].admin) || tabSubtitle()[tab][sessionUser.role === "OWNER" ? "owner" : "tech"]}</p>
              </div>
            )}

            {/* Thẻ phụ (chào lại, ai xem hồ sơ, công cụ, hoàn thiện hồ sơ) CHỈ ở tab Bảng tin.
                Ở tab Việc gấp / Thợ rảnh người dùng đến để XEM TIN — trước đây
                ~1.400px thẻ phụ đẩy tin đầu tiên xuống tận cuối màn hình điện thoại. */}
            {/* Điện thoại: lối tắt kiểu app ngay dưới lời chào, rồi mới tới thẻ gợi ý. */}
            {sessionUser && tab === "feed" && <ToolsPanel variant="row" />}

            {sessionUser && <GettingStarted compact={tab !== "feed"} />}

            {/* Render cả khi phiên đang tải: thẻ tự giữ chỗ (html[data-mn]) để không giật bố cục */}
            {tab === "feed" && <MenuNudge />}

            {/* Giữ chỗ phần SAU thẻ menu (đúng thứ tự thật): "Ai đã xem hồ sơ" (cao bằng lần trước — --pv-h) +
                "Hoàn thiện hồ sơ". Thiếu chỗ cho thẻ "Ai xem hồ sơ" (thợ ~246px) từng đẩy bảng tin xuống khi phiên
                tải xong (CLS 0.17 — cls_test 25/10). */}
            {sessionLoading && tab === "feed" && (
              <div aria-hidden className="hidden space-y-5 [html[data-authed][data-pv]_&]:block [html[data-authed][data-cmp]_&]:block">
                <div className="hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/5 [html[data-pv]_&]:block" style={{ height: "var(--pv-h, 0px)" }} />
                <div className="hidden h-[128px] rounded-2xl bg-white/[0.03] ring-1 ring-white/5 md:!hidden [html[data-cmp]:not([data-onb])_&]:block" />
              </div>
            )}

            {sessionUser && tab === "feed" && <WelcomeBack onGoTab={changeTab} />}

            {sessionUser && tab === "feed" && sessionUser.role !== "ADMIN" && <ProfileViewsCard compact role={sessionUser.role} />}

            {/* Đang có thẻ "Bắt đầu" (đã gồm thêm ảnh, hoàn thiện hồ sơ) → ẩn thẻ này cho đỡ lặp. */}
            {tab === "feed" && completeness && completeness.percent < 100 && !hideCompleteness && (
              <div className="relative md:hidden [[data-nudge]~&]:hidden [html[data-onb]_[data-onb-slot]~&]:hidden">
                <ProfileCompletenessCard completeness={completeness} compact role={sessionUser?.role} />
                <button
                  onClick={dismissCompleteness}
                  aria-label={tr("Ẩn gợi ý hoàn thiện hồ sơ", "Hide profile tips")}
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
                <div className="flex flex-shrink-0 rounded-full bg-slate-950/70 p-0.5 ring-1 ring-white/10" role="group" aria-label={tr("Thị trường", "Market")}>
                  {(["US", "AU"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMarket(m); setState(""); }}
                      aria-pressed={market === m}
                      className={`min-h-[36px] rounded-full px-2.5 text-xs font-bold transition-all active:scale-95 ${market === m ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow" : "text-slate-400"}`}
                    >
                      <span className="inline-flex items-center gap-1"><Flag code={m} className="h-3 w-4" /> {m === "US" ? tr("Mỹ", "US") : tr("Úc", "AU")}</span>
                    </button>
                  ))}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {["", ...states].map((s) => (
                    <button
                      key={s || "all"}
                      onClick={() => setState(s)}
                      className={`min-h-[36px] flex-shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-bold ring-1 transition-all active:scale-95 ${
                        state === s ? "bg-pink-600 text-white ring-pink-600" : "bg-slate-950/60 text-slate-400 ring-slate-800"
                      }`}
                    >
                      {s ? stateName(market, s) : tr("Tất cả bang", "All states")}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCitySearch((v) => !v)}
                  aria-label={tr("Tìm theo thành phố", "Search by city")}
                  aria-expanded={showCitySearch || !!city}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-1 transition-colors ${showCitySearch || city ? "bg-pink-500/15 text-pink-300 ring-pink-500/40" : "text-slate-400 ring-slate-800"}`}
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
                    placeholder={tab === "jobs" ? tr("Tìm thành phố, tên tiệm, kỹ năng…", "Search city, salon, skill…") : tr("Thành phố… (VD: Houston, Sydney)", "City… (e.g. Houston, Sydney)")}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-9 text-sm text-slate-100 placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                  />
                  {city && (
                    <button onClick={() => { setCity(""); setShowCitySearch(false); }} aria-label={tr("Xoá tìm kiếm", "Clear search")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:text-slate-200">
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
                  <Flag code="US" />{tr(" Mỹ · US", " United States")}
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
                  <Flag code="AU" />{tr(" Úc · AU", " Australia")}
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
                  {tr("Tất cả bang", "All states")}
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
                  placeholder={tr("Tìm theo thành phố... (VD: Los Angeles, Sydney)", "Search by city... (e.g. Los Angeles, Sydney)")}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Tabs */}
            {/* Dính ngay dưới Navbar (64px + 1px viền). Trước đây top-[68px] để hở
                3px — bài viết cuộn qua lộ thành vệt phía trên thanh tab. Lớp nền
                mờ bọc ngoài che luôn phần nội dung cuộn phía sau. */}
            {/* Điện thoại: lớp nền phủ tràn hết chiều ngang (không còn tấm nền vuông thò ra 2 bên thanh tab) */}
            <div data-home-tabs className="sticky top-[65px] z-30 -mx-1 px-1 pt-2 pb-2 max-sm:-mx-4 max-sm:px-4 bg-[#05040f]/[0.97] backdrop-blur-2xl backdrop-saturate-150 [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
              <div role="tablist" aria-label={tr("Nội dung trang chủ", "Home sections")} className="relative grid grid-cols-3 rounded-xl border border-slate-800/80 bg-slate-900/80 p-1 shadow-lg shadow-black/20">
                {/* Viên chọn trượt mượt sang tab đang mở */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-gradient-to-r from-pink-600 to-fuchsia-600 shadow-lg shadow-pink-600/25 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(${TAB_ORDER.indexOf(tab) * 100}%)` }}
                />
                {([
                  guestView
                    ? { id: "feed", icon: Compass, short: tr("Khám phá", "Discover"), long: tr("Khám phá", "Discover") }
                    : { id: "feed", icon: Newspaper, short: tr("Bảng tin", "Feed"), long: tr("Bảng tin", "Feed") },
                  { id: "jobs", icon: Briefcase, short: tr("Việc làm", "Jobs"), long: tr("Việc làm", "Jobs") },
                  { id: "portfolio", icon: Users, short: tr("Thợ", "Techs"), long: tr("Thợ sẵn sàng", "Available techs") },
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
            {tab === "feed" && guestView ? (
              <>
                {/* Khách chưa đăng nhập: mẫu nail, thử mẫu, tìm tiệm — bảng tin cộng đồng chỉ cho thành viên.
                    Máy từng đăng nhập (html[data-authed]) không bao giờ thấy khối này: CSS ẩn ngay từ HTML đầu. */}
                <div className={sessionLoading ? "[html[data-authed]_&]:hidden" : ""}>
                  <GuestDiscover market={market} state={state} />
                </div>
                {sessionLoading && (
                  <div aria-hidden className="hidden space-y-4 [html[data-authed]_&]:block">
                    <div className="h-[132px] rounded-2xl bg-white/[0.03] ring-1 ring-white/5" />
                    <div className="h-[320px] rounded-2xl bg-white/[0.03] ring-1 ring-white/5" />
                  </div>
                )}
              </>
            ) : tab === "feed" ? (
              <SocialFeed market={market} state={state} city={city} />
            ) : tab === "jobs" ? (
              <JobBoard market={market} state={state} city={city} onShowAllStates={() => setState("")} />
            ) : (
              <TechnicianGrid market={market} state={state} city={city} />
            )}
              </div>
            </div>
          </div>

          {sessionUser && <RightRail market={market} state={state} />}
        </div>
      </main>

      <footer className="hidden md:block border-t border-slate-900/80 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
        <p>{tr("© 2026 PawNail. Nền tảng cho ngành nail tại Mỹ và Úc.", "© 2026 PawNail. The platform for the nail industry in the US and Australia.")}</p>
      </footer>
    </div>
  );
}
