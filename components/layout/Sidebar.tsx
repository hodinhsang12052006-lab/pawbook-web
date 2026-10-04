"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, Store, Newspaper } from "lucide-react";
import ToolsPanel from "@/components/layout/ToolsPanel";
import { useRouter, usePathname } from "next/navigation";
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
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const pathname = usePathname();
  const { user: effectiveUser, loading: sessionLoading } = useSessionUser();

  const userName = effectiveUser?.name || tr("Thành viên", "Member");
  const userRole = effectiveUser?.role || "TECHNICIAN";
  const userLocation = [effectiveUser?.city, stateName(effectiveUser?.market, effectiveUser?.state)].filter(Boolean).join(", ") || tr("Chưa cập nhật khu vực", "Location not set");
  const roleLabel = userRole === "OWNER" ? tr("Chủ tiệm", "Salon owner") : userRole === "ADMIN" ? tr("Quản trị", "Admin") : tr("Thợ Nail", "Nail tech");
  const completeness = getProfileCompleteness(effectiveUser);

  const menuItems = [
    { id: "feed", label: tr("Bảng Tin", "Feed"), icon: Newspaper, route: "/?tab=feed" },
    { id: "jobs", label: tr("Cần Thợ Gấp", "Urgent jobs"), icon: Briefcase, route: "/?tab=jobs" },
    { id: "portfolio", label: tr("Thợ Đang Rảnh", "Available techs"), icon: Store, route: "/?tab=portfolio" },
  ];

  const handleNavigation = (id: string, route: string) => {
    if (pathname === "/" && setActiveTab) {
      setActiveTab(id);
      router.push(route, { scroll: false });
    } else {
      router.push(route);
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
              <div className="mb-4 rounded-xl bg-gradient-to-br from-pink-600/15 to-fuchsia-600/5 p-3.5 ring-1 ring-pink-500/20">
                <p className="text-sm font-black text-white">Tham gia PawNail</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{tr("Miễn phí — tìm việc, tìm thợ và nhắn tin trực tiếp.", "Free — find jobs, find techs and message directly.")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/auth/register" className="rounded-lg bg-gradient-to-r from-pink-600 to-fuchsia-600 py-2 text-center text-xs font-bold text-white">{tr("Đăng ký", "Sign up")}</Link>
                  <Link href="/auth/login" className="rounded-lg bg-white/5 py-2 text-center text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10">{tr("Đăng nhập", "Sign in")}</Link>
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
                        ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-600/20"
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
            <ToolsPanel variant="list" />
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
