"use client";

import React from "react";
import { Plus, MessageSquare, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import LanguageToggle from "@/components/layout/LanguageToggle";

export default function Navbar() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user: sessionUser, loading: loadingSession } = useSessionUser();
  const { unreadCount, resetUnread } = useUnreadMessages();

  const userAvatar = sessionUser?.avatarUrl || "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=100&auto=format&fit=crop&q=80";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo & Brand */}
        <div onClick={() => router.push("/")} className="flex items-center gap-2.5 cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-lg font-extrabold tracking-wide text-transparent hidden sm:inline">
            PawNail Jobs
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4">
          {loadingSession ? (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-800 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-slate-800"></div>
              <div className="h-3 w-16 bg-slate-800 rounded hidden md:block"></div>
            </div>
          ) : sessionUser ? (
            <>
              {sessionUser.role === "OWNER" ? (
                <button
                  onClick={() => router.push("/jobs/create")}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-pink-600/25 hover:from-pink-500 hover:to-fuchsia-500 transition-all duration-200 cursor-pointer"
                  title="Đăng tin tuyển thợ"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline">Đăng tin</span>
                </button>
              ) : (
                <button
                  onClick={() => router.push("/profile")}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-pink-600/25 hover:from-pink-500 hover:to-fuchsia-500 transition-all duration-200 cursor-pointer"
                  title="Đăng ảnh portfolio"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline">Đăng ảnh</span>
                </button>
              )}

              <div className="flex items-center gap-1 sm:gap-2 border-l border-slate-850 pl-2 sm:pl-4">
                <Link
                  href="/messages"
                  prefetch={true}
                  onClick={resetUnread}
                  className="rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors relative"
                  title={t("menu.messages")}
                >
                  <div className="relative">
                    <MessageSquare className="h-4.5 w-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-slate-950 bg-red-500 px-1 text-[9px] font-bold leading-none text-white animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 border-l border-slate-850 pl-2 sm:pl-4">
                <div
                  onClick={() => router.push("/profile")}
                  className="h-8 w-8 overflow-hidden rounded-full border border-slate-700 cursor-pointer hover:border-pink-500 transition-colors"
                >
                  <img src={userAvatar} alt={sessionUser.name || "User Avatar"} className="h-full w-full object-cover" />
                </div>
                <span
                  onClick={() => router.push("/profile")}
                  className="hidden lg:inline text-xs font-semibold text-slate-200 cursor-pointer hover:text-white transition-colors"
                >
                  {sessionUser.name}
                </span>
              </div>
              <LanguageToggle className="ml-1" />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <button
                onClick={() => router.push("/auth/login")}
                className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                {t("menu.login")}
              </button>
              <button
                onClick={() => router.push("/auth/register")}
                className="rounded-full bg-pink-600 hover:bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-pink-600/25 transition-all duration-200 cursor-pointer"
              >
                {t("menu.register")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
