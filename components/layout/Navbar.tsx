"use client";

import React from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import { Plus, MessageSquare, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import Link from "next/link";
import IntentLink from "@/components/marketing/IntentLink";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import LanguageToggle from "@/components/layout/LanguageToggle";
import NotificationBell from "@/components/layout/NotificationBell";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import "@/components/marketing/marketing.css";
import { useTr } from "@/lib/i18n/useTr";

export default function Navbar() {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const { t } = useLanguage();
  const { user: sessionUser, loading: loadingSession } = useSessionUser();
  const { unreadCount, resetUnread } = useUnreadMessages();
  // ONE brand block for guests and members (same 36 px logo tile + ivory wordmark, a real link home): it no longer
  // flips from a guest lockup to a member lockup when /api/auth/session resolves (the first paint of every signed-in
  // full load used to show the guest variant, then shift 4 px). prefetch={false}: the logo link is on every page and
  // must not pull the "/" route bundle in the background.
  const registerLabel = (
    <>
      <span className="min-[400px]:hidden">{t("menu.registerShort")}</span>
      <span className="max-[399px]:hidden">{t("menu.register")}</span>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#05040f]/[0.97] backdrop-blur-2xl backdrop-saturate-150 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-pink-500/40 after:to-transparent refined:bg-pn-canvas refined:[backdrop-filter:none] refined:after:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 min-[400px]:px-4 sm:px-6 lg:px-8">
        {/* Left: logo + wordmark at every width (a bare "B" on a phone read as an anonymous app). */}
        <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2 rounded-xl min-[400px]:gap-2.5" aria-label="PawNail" data-brand>
          <span className="pn-nav-logo">
            <BrandLogo size={36} />
          </span>
          <span className="pn-wordmark">PawNail</span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4">
          {loadingSession ? (
            <>
            {/* Đang tải phiên: khách thấy ngay nút Đăng nhập/Đăng ký (không nhảy), máy từng đăng nhập thấy khung chờ */}
            <div className="flex items-center gap-1 min-[400px]:gap-1.5 sm:gap-2 [html[data-authed]_&]:hidden">
              <LanguageToggle className="max-[399px]:gap-0.5 max-[399px]:px-2" />
              <IntentLink href="/auth/login" className="pn-nav-login">{t("menu.login")}</IntentLink>
              <IntentLink href="/auth/register" className="pn-btn pn-cta pn-cta--sm">{registerLabel}</IntentLink>
            </div>
            <div className="hidden items-center gap-3 pl-4 border-l border-slate-800 animate-pulse [html[data-authed]_&]:flex">
              <div className="h-8 w-8 rounded-full bg-slate-800"></div>
              <div className="h-3 w-16 bg-slate-800 rounded hidden md:block"></div>
            </div>
            </>
          ) : sessionUser ? (
            <>
              {sessionUser.role === "ADMIN" ? (
                <button
                  onClick={() => router.push(localeHref("/admin/reports"))}
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all duration-200 cursor-pointer"
                  title={tr("Trang quản trị", "Admin dashboard")}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span className="hidden md:inline">{tr("Quản trị", "Admin")}</span>
                </button>
              ) : sessionUser.role === "OWNER" ? (
                <button
                  onClick={() => router.push(localeHref("/jobs/create"))}
                  className="hidden md:flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-pink-600/25 hover:from-pink-500 hover:to-fuchsia-500 transition-all duration-200 cursor-pointer"
                  title={tr("Đăng tin tuyển", "Post a job")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline">{tr("Đăng tin tuyển", "Post a job")}</span>
                </button>
              ) : (
                <button
                  onClick={() => router.push(localeHref(sessionUser.role === "CLIENT" ? "/salons" : "/profile"))}
                  className="hidden md:flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-pink-600/25 hover:from-pink-500 hover:to-fuchsia-500 transition-all duration-200 cursor-pointer"
                  title={sessionUser.role === "CLIENT" ? tr("Tìm tiệm", "Find a salon") : tr("Đăng tác phẩm", "Share your work")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline">{sessionUser.role === "CLIENT" ? tr("Tìm tiệm", "Find a salon") : tr("Đăng tác phẩm", "Share your work")}</span>
                </button>
              )}

              <div className="flex items-center gap-1 sm:gap-2 border-l border-slate-850 pl-2 sm:pl-4">
                <NotificationBell />
                <Link
                  href="/messages"
                  prefetch={true}
                  onClick={resetUnread}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
                  title={t("menu.messages")}
                >
                  <div className="relative">
                    <MessageSquare className="h-4.5 w-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-slate-950 bg-pink-600 px-1 text-[9px] font-bold leading-none text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 border-l border-slate-850 pl-2 sm:pl-4">
                <button
                  type="button"
                  onClick={() => router.push(localeHref("/profile"))}
                  aria-label={tr("Hồ sơ của tôi", "My profile")}
                  className="rounded-full ring-1 ring-slate-700 hover:ring-2 hover:ring-pink-500 transition-all"
                >
                  <Avatar src={sessionUser.avatarUrl} name={sessionUser.name} seed={sessionUser.id} className="h-8 w-8" loading="eager" />
                </button>
                <span
                  onClick={() => router.push(localeHref("/profile"))}
                  className="hidden lg:inline text-xs font-semibold text-slate-200 cursor-pointer hover:text-white transition-colors"
                >
                  {sessionUser.name}
                </span>
              </div>
              <LanguageToggle className="ml-1 max-[399px]:ml-0 max-[399px]:gap-0.5 max-[399px]:px-2" />
            </>
          ) : (
            <div className="flex items-center gap-1 min-[400px]:gap-1.5 sm:gap-2">
              <LanguageToggle className="max-[399px]:gap-0.5 max-[399px]:px-2" />
              <IntentLink href="/auth/login" className="pn-nav-login">{t("menu.login")}</IntentLink>
              <IntentLink href="/auth/register" className="pn-btn pn-cta pn-cta--sm">{registerLabel}</IntentLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
