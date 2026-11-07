"use client";

import React from "react";
import Link from "next/link";
import IntentLink from "@/components/marketing/IntentLink";
import { Briefcase, Users, Newspaper, Compass } from "lucide-react";
import ToolsPanel from "@/components/layout/ToolsPanel";
import { useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import { useAppPathname } from "@/lib/i18n/useAppPathname";
import { useSessionUser } from "@/lib/SessionUserContext";
import { stateName } from "@/lib/stateNames";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import ProfileCompletenessCard from "@/components/profile/ProfileCompletenessCard";

import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  /** Khách chưa đăng nhập: tab đầu là "Khám phá" (mẫu, thử mẫu, tiệm) thay cho "Bảng tin". */
  guest?: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, guest = false }: SidebarProps) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const pathname = useAppPathname();
  const { user: effectiveUser, loading: sessionLoading } = useSessionUser();

  const userName = effectiveUser?.name || tr("Thành viên", "Member");
  const userRole = effectiveUser?.role || "TECHNICIAN";
  const userLocation = [effectiveUser?.city, stateName(effectiveUser?.market, effectiveUser?.state)].filter(Boolean).join(", ") || tr("Chưa cập nhật khu vực", "Location not set");
  const roleLabel = userRole === "OWNER" ? tr("Chủ tiệm", "Salon owner") : userRole === "ADMIN" ? tr("Quản trị", "Admin") : tr("Thợ nail", "Nail tech");
  const completeness = getProfileCompleteness(effectiveUser);

  const menuItems = [
    guest
      ? { id: "feed", label: tr("Khám phá", "Discover"), icon: Compass, route: "/?tab=feed" }
      : { id: "feed", label: tr("Bảng tin", "Feed"), icon: Newspaper, route: "/?tab=feed" },
    { id: "jobs", label: tr("Việc làm", "Jobs"), icon: Briefcase, route: "/?tab=jobs" },
    { id: "portfolio", label: tr("Thợ sẵn sàng", "Available techs"), icon: Users, route: "/?tab=portfolio" },
  ];

  const handleNavigation = (id: string, route: string) => {
    if (pathname === "/" && setActiveTab) {
      setActiveTab(id);
      router.push(localeHref(route), { scroll: false });
    } else {
      router.push(localeHref(route));
    }
  };

  const checkIsActive = (id: string) => {
    if (pathname !== "/") return false;
    return activeTab === id;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-4">
          <div className="glass-card rounded-2xl p-4">
            {/* Profile Card Summary — đang tải thì hiện khung chờ (trước đây lóe
                lên "Thành viên · Chưa cập nhật khu vực" như một tài khoản lạ);
                khách chưa đăng nhập thì mời tham gia thay vì hồ sơ rỗng. */}
            {sessionLoading ? (
              <div className="mb-4 flex items-center gap-3" aria-hidden>
                <div className="skeleton h-12 w-12 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-28 rounded-md" />
                  <div className="skeleton h-3 w-36 rounded-md" />
                </div>
              </div>
            ) : !effectiveUser ? (
              <div className="mb-4 rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-inset ring-pn-line">
                <p className="text-sm font-semibold text-white">{tr("Tham gia PawNail", "Join PawNail")}</p>
                <p className="mt-0.5 text-[13px] leading-[18px] text-slate-400">{tr("Thử mẫu, tìm tiệm, tìm việc hoặc tuyển thợ — nhắn tin trực tiếp trong app.", "Try on looks, find a salon, find work or hire — message directly in the app.")}</p>
                {/* stacked full width: "Create account" / "Tạo tài khoản" never wraps or touches the button edges */}
                <div className="mt-3 grid gap-2">
                  <IntentLink href="/auth/register" className="flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-white/[0.08] px-4 text-center text-[14px] font-semibold text-white ring-1 ring-inset ring-pn-line-strong hover:bg-white/[0.12]">{tr("Tạo tài khoản", "Create account")}</IntentLink>
                  <IntentLink href="/auth/login" className="flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-4 text-center text-[14px] font-semibold text-slate-200 ring-1 ring-inset ring-pn-line hover:bg-white/5">{tr("Đăng nhập", "Log in")}</IntentLink>
                </div>
              </div>
            ) : (
            <Link href="/profile" className="mb-4 flex items-center gap-3 rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors">
              <Avatar src={effectiveUser?.avatarUrl || effectiveUser?.image} name={userName} seed={effectiveUser?.id} className="h-12 w-12 ring-2 ring-pink-500/40" loading="eager" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-100">{userName}</p>
                <p className="truncate text-[11px] text-slate-400">📍 {userLocation}</p>
                {effectiveUser && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-2xs font-semibold text-pink-300 border border-pink-500/20 uppercase tracking-wider">
                    {roleLabel}
                  </span>
                )}
              </div>
            </Link>
            )}

            {/* Navigation Menu */}
            <nav className="space-y-1" aria-label={tr("Khám phá", "Explore")}>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = checkIsActive(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.id, item.route)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                      isActive
                        ? guest
                          ? "bg-pn-thumb text-white ring-1 ring-inset ring-white/[0.08]"
                          : "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-600/20"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <p className="mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{tr("Công cụ", "Tools")}</p>
            {/* guests: tool names only (the one-line subtitles truncated mid-word in a 256 px sidebar) */}
            <ToolsPanel variant="list" compact={guest} />
          </div>

          {completeness && <ProfileCompletenessCard completeness={completeness} compact role={userRole} />}
        </div>
      </aside>
      {/* Mobile bottom navigation now lives globally in
          components/layout/BottomNav.tsx (mounted once in app/layout.tsx) —
          this local one only ever covered the 2 homepage tabs and vanished
          on every other route (messages, profile, job detail...). */}
    </>
  );
}
