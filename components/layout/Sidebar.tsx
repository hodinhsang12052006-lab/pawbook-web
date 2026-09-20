"use client";

import React from "react";
import { Briefcase, Store } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useSessionUser } from "@/lib/SessionUserContext";

import Image from "next/image";

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: effectiveUser } = useSessionUser();

  const userName = effectiveUser?.name || "Thành viên";
  const userRole = effectiveUser?.role || "TECHNICIAN";
  const userAvatar = effectiveUser?.avatarUrl || effectiveUser?.image || "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=100&auto=format&fit=crop&q=80";
  const userLocation = [effectiveUser?.city, effectiveUser?.state].filter(Boolean).join(", ") || "Chưa cập nhật khu vực";
  const roleLabel = userRole === "OWNER" ? "Chủ tiệm" : userRole === "ADMIN" ? "Quản trị" : "Thợ Nail";

  const menuItems = [
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
      {/* Desktop Sidebar: normal left-hand panel layout */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur-md">
          {/* Profile Card Summary */}
          <div className="mb-6 flex flex-col items-center border-b border-slate-800 pb-5 text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-blue-500/50 shadow-md cursor-pointer hover:opacity-85 transition-opacity" onClick={() => router.push("/profile")}>
              <Image
                src={userAvatar}
                alt="User Profile"
                fill
                priority
                sizes="(max-width: 768px) 64px, 64px"
                className="object-cover"
              />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-100 cursor-pointer hover:underline animate-pulse" onClick={() => router.push("/profile")}>
              {userName}
            </h2>
            <p className="text-xs text-slate-400 font-semibold">📍 {userLocation}</p>
            {effectiveUser && (
              <span className="mt-2 inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-2xs font-medium text-pink-400 border border-pink-500/20 uppercase tracking-wider">
                {roleLabel}
              </span>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = checkIsActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id, item.route)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "bg-pink-600 text-white shadow-lg shadow-pink-600/15"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
      {/* Mobile bottom navigation now lives globally in
          components/layout/BottomNav.tsx (mounted once in app/layout.tsx) —
          this local one only ever covered the 2 homepage tabs and vanished
          on every other route (messages, profile, job detail...). */}
    </>
  );
}
