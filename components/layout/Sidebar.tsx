"use client";

import React from "react";
import { Home, Briefcase, Rocket, Settings, Store, Users, Zap, BookOpen, MapPin, CreditCard } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  currentUser?: any;
}

export default function Sidebar({ activeTab, setActiveTab, currentUser }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = React.useState<any>(null);

  React.useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSession();
  }, []);

  const userName = currentUser?.name || sessionUser?.name || "Khách ghé chơi";
  const userRole = currentUser?.role || sessionUser?.role || "GUEST";
  const userAvatar = currentUser?.avatarUrl || currentUser?.image || sessionUser?.avatarUrl || sessionUser?.image || "/images/placeholder.jpg";
  const userBio = currentUser ? (currentUser.role === "EMPLOYER" ? "Chủ cửa hàng dịch vụ" : "Thành viên PawBook") : (sessionUser ? (sessionUser.role === "EMPLOYER" ? "Chủ cửa hàng dịch vụ" : "Thành viên PawBook") : "Thành viên PawBook");

  const menuItems = [
    { id: "feed", label: "Bảng tin", icon: Home, route: "/?tab=feed" },
    { id: "jobs", label: "Tuyển dụng & Việc làm", icon: Briefcase, route: "/?tab=jobs" },
    { id: "hr", label: "Quản lý HR", icon: Settings, route: "/?tab=hr" },
    { id: "services", label: "Dịch vụ & Cửa hàng", icon: Store, route: "/services" },
    { id: "gigs", label: "⚡ Chợ Đấu Thầu", icon: Zap, route: "/gigs" },
    { id: "blogs", label: "📝 Blog & Chia sẻ", icon: BookOpen, route: "/blogs" },
  ];

  const handleNavigation = (id: string, route: string) => {
    if (pathname === "/" && setActiveTab && id !== "services" && id !== "gigs" && id !== "blogs") {
      setActiveTab(id);
      router.push(route, { scroll: false });
    } else {
      router.push(route);
    }
  };

  const checkIsActive = (id: string) => {
    if (id === "services") {
      return pathname === "/services";
    }
    if (id === "gigs") {
      return pathname === "/gigs";
    }
    if (id === "blogs") {
      return pathname === "/blogs";
    }
    if (pathname === "/services" || pathname === "/gigs" || pathname === "/blogs") {
      return false;
    }
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
              <img
                src={userAvatar}
                alt="User Profile"
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-100 cursor-pointer hover:underline animate-pulse" onClick={() => router.push("/profile")}>
              {userName}
            </h2>
            <p className="text-xs text-slate-400 font-semibold">{userBio}</p>
            {sessionUser && (
              <span className="mt-2 inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-2xs font-medium text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                {userRole}
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
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Stats or Footer */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">
            <div className="flex justify-between py-1">
              <span>Lượt xem trang cá nhân</span>
              <span className="font-semibold text-slate-300">1,248</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Lượt xem bài viết</span>
              <span className="font-semibold text-slate-300">12.5k</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar: fixed, space-saving icon-only panel */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0f1d]/95 border-t border-slate-850 py-1.5 px-2 flex items-center justify-around backdrop-blur-lg shadow-2xl">
        {menuItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = checkIsActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id, item.route)}
              title={item.label}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-blue-600/10 border border-blue-500/20 text-blue-400"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </nav>
    </>
  );
}
