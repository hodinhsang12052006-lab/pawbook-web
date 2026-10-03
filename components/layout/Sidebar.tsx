"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, Store, Newspaper, MessageCircle } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import { stateName } from "@/lib/stateNames";
import { getProfileCompleteness } from "@/lib/profileCompleteness";
import ProfileCompletenessCard from "@/components/profile/ProfileCompletenessCard";

import Image from "next/image";

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: effectiveUser } = useSessionUser();
  const { unreadCount } = useUnreadMessages();

  const userName = effectiveUser?.name || "Thành viên";
  const userRole = effectiveUser?.role || "TECHNICIAN";
  const userAvatar = effectiveUser?.avatarUrl || effectiveUser?.image || "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=100&auto=format&fit=crop&q=80";
  const userLocation = [effectiveUser?.city, stateName(effectiveUser?.market, effectiveUser?.state)].filter(Boolean).join(", ") || "Chưa cập nhật khu vực";
  const roleLabel = userRole === "OWNER" ? "Chủ tiệm" : userRole === "ADMIN" ? "Quản trị" : "Thợ Nail";
  const completeness = getProfileCompleteness(effectiveUser);

  const menuItems = [
    { id: "feed", label: "Bảng Tin", icon: Newspaper, route: "/?tab=feed" },
    { id: "jobs", label: "Cần Thợ Gấp", icon: Briefcase, route: "/?tab=jobs" },
    { id: "portfolio", label: "Thợ Đang Rảnh", icon: Store, route: "/?tab=portfolio" },
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
            {/* Profile Card Summary */}
            <Link href="/profile" className="mb-4 flex items-center gap-3 rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-pink-500/40">
                <Image src={userAvatar} alt={userName} fill priority sizes="48px" className="object-cover" />
              </div>
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

            {/* Navigation Menu */}
            <nav className="space-y-1" aria-label="Khám phá">
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
              {/* Tin nhắn là lối tắt duy nhất ở đây — các công cụ khác (Radar,
                  thu nhập, kho hàng, đăng tin) đã có lối vào riêng ở Navbar,
                  trang Tài khoản và bảng tin, không lặp lại cho đỡ rối. */}
              <Link
                href="/messages"
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-all duration-200 active:scale-95"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
                <span className="flex-1">Tin nhắn</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-pink-600 px-1.5 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </Link>
            </nav>
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
