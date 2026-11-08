"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Newspaper, Briefcase, Users, MessageCircle, Plus, Home, Sparkles, Store, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import { useAppPathname } from "@/lib/i18n/useAppPathname";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

type HomeTab = "feed" | "jobs" | "portfolio";

interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  active: boolean;
  badge?: number;
}

// Thanh điều hướng chính trên điện thoại (dân nail dùng mobile ~90%).
// Dạng "thanh nổi" bọc khung kính, 4 mục + nút ＋ nổi ở giữa cho hành động
// quan trọng nhất của từng vai trò (thợ: đăng bài khoe tay nghề · chủ tiệm:
// đăng tin tuyển). Viên sáng trượt theo mục đang chọn; tự ẩn khi cuộn xuống
// để nhường chỗ cho nội dung, hiện lại ngay khi cuộn lên.
export default function BottomNav() {
  useTr(); // render lại khi đổi VI/EN
  const pathname = useAppPathname();
  const router = useRouter();
  const { user: sessionUser, loading } = useSessionUser();
  const { unreadCount } = useUnreadMessages();

  // Đọc ?tab= thủ công qua window.location (không dùng useSearchParams —
  // cùng lý do đã ghi ở app/page.tsx). Trang chủ cũng phát "hometab-change"
  // khi người dùng vuốt/bấm tab, để thanh này luôn sáng đúng mục.
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get("tab"));
  }, [pathname]);
  useEffect(() => {
    const onTab = (e: Event) => setTab((e as CustomEvent<string>).detail);
    window.addEventListener("hometab-change", onTab);
    return () => window.removeEventListener("hometab-change", onTab);
  }, []);

  // Ẩn khi cuộn xuống, hiện khi cuộn lên (ngưỡng nhỏ để không giật).
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 8) return;
      setHiddenByScroll(dy > 0 && y > 160);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setHiddenByScroll(false), [pathname, tab]);

  // Icon "nảy" khi vừa đổi mục.
  const [popId, setPopId] = useState<string | null>(null);

  // Bề mặt marketing: html[data-surface="landing"] (trang chủ khách "/") / "auth" (/auth/*) — nền sân khấu + hero
  // (globals.css). Script đầu trang (app/[lang]/layout.tsx) đặt trước khi vẽ; ở đây đồng bộ khi đổi trang / đăng
  // nhập / đăng xuất (component này luôn được mount, hook vẫn chạy khi trả về null).
  useLayoutEffect(() => {
    const h = document.documentElement;
    if (pathname?.startsWith("/auth")) h.setAttribute("data-surface", "auth");
    else if (pathname === "/" && loading) return;
    else if (pathname === "/" && !sessionUser) h.setAttribute("data-surface", "landing");
    else h.removeAttribute("data-surface");
  }, [pathname, loading, sessionUser]);

  // Ẩn khi chưa đăng nhập và trong luồng /auth/*. /messages: danh sách chat GIỮ thanh dưới (như mọi app nhắn tin);
  // chỉ ẩn khi đang mở 1 cuộc trò chuyện (html[data-chat-open] — CSS .pn-bnav) để không đè ô soạn tin/bàn phím.
  const hidden = loading || !sessionUser || pathname?.startsWith("/auth");
  if (hidden) return null;

  const isOwner = sessionUser.role === "OWNER";
  // Khách đi làm nail: thế giới riêng — không có Việc làm / Đăng tin / Bảng tin nghề.
  const isClient = sessionUser.role === "CLIENT";
  const isHome = pathname === "/";
  const currentTab = (tab as HomeTab) || "feed";

  const goToTab = (nextTab: HomeTab) => {
    setTab(nextTab);
    if (isHome) window.dispatchEvent(new CustomEvent("hometab-change", { detail: nextTab }));
    router.push(localeHref(`/?tab=${nextTab}`), { scroll: false });
  };

  // Mục thứ 2 theo vai trò: thợ cần VIỆC, chủ tiệm cần THỢ.
  const secondTab: HomeTab = isOwner ? "portfolio" : "jobs";

  const clientItems: NavItem[] = [
    { id: "feed", label: tr("Trang chủ", "Home"), icon: Home, onClick: () => router.push(localeHref("/")), active: isHome },
    { id: "second", label: tr("Mẫu nail", "Designs"), icon: Sparkles, onClick: () => router.push(localeHref("/designs")), active: pathname?.startsWith("/designs") ?? false },
  ];
  const items: NavItem[] = [
    ...(isClient ? clientItems : []),
    {
      id: "feed",
      label: tr("Bảng tin", "Feed"),
      icon: Newspaper,
      onClick: () => goToTab("feed"),
      // Tab thứ 3 (không có nút riêng ở đây) thì không sáng mục nào — tránh
      // báo sai "đang ở Bảng tin".
      active: isHome && currentTab === "feed",
    },
    {
      id: "second",
      label: isOwner ? tr("Tuyển thợ", "Hire") : tr("Việc làm", "Jobs"),
      icon: isOwner ? Users : Briefcase,
      onClick: () => goToTab(secondTab),
      active: isHome && currentTab === secondTab,
    },
    {
      id: "messages",
      label: tr("Tin nhắn", "Messages"),
      icon: MessageCircle,
      onClick: () => router.push(localeHref("/messages")),
      active: pathname?.startsWith("/messages") ?? false,
      badge: unreadCount,
    },
    {
      id: "profile",
      label: isClient ? tr("Tài khoản", "Account") : tr("Hồ sơ", "Profile"),
      onClick: () => router.push(localeHref("/profile")),
      active: pathname?.startsWith("/profile") ?? false,
    },
  ];

  if (isClient) items.splice(2, 2); // bỏ "Bảng tin" + "Việc làm" của thợ
  const createAction = () => {
    if (isClient) {
      router.push(localeHref("/salons"));
      return;
    }
    if (isOwner) {
      router.push(localeHref("/jobs/create"));
      return;
    }
    // Đặt cờ trước: nếu ô soạn bài chưa có trên màn hình (đang ở tab khác /
    // trang khác) thì nó đọc cờ lúc mount; nếu đã có thì bắt sự kiện ngay.
    try {
      sessionStorage.setItem("pn_compose", "1");
    } catch {}
    if (isHome) {
      goToTab("feed");
      window.dispatchEvent(new Event("compose-post"));
    } else {
      router.push(localeHref("/?tab=feed"));
    }
  };

  // Thứ tự hiển thị: 2 mục · ＋ · 2 mục. Viên sáng trượt theo cột (5 cột).
  const slots = [items[0], items[1], null, items[2], items[3]];
  const activeIndex = slots.findIndex((it) => it?.active);

  return (
    <>
    {/* Lớp nền dưới thanh nổi: che khe 10px + vùng an toàn phía dưới để nội dung không lộ dưới thanh */}
    <div
      aria-hidden
      className={`pn-bnav pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-pn-canvas-deep from-55% to-transparent transition-opacity duration-300 md:hidden ${hiddenByScroll ? "opacity-0" : "opacity-100"}`}
      style={{ height: "calc(max(10px, env(safe-area-inset-bottom)) + 84px)" }}
    />
    <nav
      aria-label={tr("Điều hướng chính", "Main navigation")}
      className={`pn-bnav fixed inset-x-3 z-50 transition-transform duration-300 ease-out md:hidden ${hiddenByScroll ? "translate-y-[calc(100%+24px)]" : "translate-y-0"}`}
      style={{ bottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="pn-dock relative grid grid-cols-5 items-center rounded-[24px] px-1 py-1.5">
        {/* Viên sáng trượt theo mục đang chọn */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1 w-[calc((100%-0.5rem)/5)] transition-transform duration-[240ms] ease-[cubic-bezier(.77,0,.175,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="absolute inset-x-1.5 inset-y-0.5 rounded-[16px] bg-[rgb(255_240_246/0.08)]" />
          </span>
        )}

        {slots.map((item, i) =>
          item === null ? (
            <div key="create" className="flex justify-center [&>button]:mt-0 [&>button]:h-12 [&>button]:w-12 [&>button]:rounded-full [&>button]:bg-none [&>button]:bg-pn-brand [&>button]:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_16px_-4px_rgb(8_4_10/0.6)] [&>button]:ring-0 [&>button]:transition-[transform,background-color] [&>button]:duration-[120ms] [&>button:active]:scale-[.94] [&>button:active]:bg-pn-brand-press">
              <button
                type="button"
                onClick={createAction}
                aria-label={isClient ? tr("Tìm tiệm", "Find a salon") : isOwner ? tr("Đăng tin tuyển thợ", "Post a job") : tr("Đăng bài mới", "New post")}
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 text-white shadow-[0_10px_24px_-6px_rgba(219,39,119,0.75)] ring-4 ring-slate-950 transition-transform duration-150 active:scale-90"
              >
                {isClient ? <Store className="h-[22px] w-[22px]" strokeWidth={2.25} /> : <Plus className="h-[22px] w-[22px]" strokeWidth={2.25} />}
              </button>
            </div>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.active) setPopId(item.id);
                item.onClick();
              }}
              aria-current={item.active ? "page" : undefined}
              className={`relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-200 active:scale-95 ${
                item.active ? "text-pn-text" : "text-pn-text-2"
              }`}
            >
              <span key={popId === item.id ? `pop-${i}` : `still-${i}`} className={`relative ${popId === item.id ? "nav-pop" : ""}`}>
                {item.icon ? (
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={item.active ? 2.25 : 1.75} />
                ) : (
                  <span aria-hidden>
                  <Avatar
                    src={sessionUser.avatarUrl}
                    name={sessionUser.name}
                    seed={sessionUser.id}
                    loading="eager"
                    className={`h-[24px] w-[24px] ${item.active ? "ring-2 ring-pn-text" : "ring-1 ring-pn-line-strong"}`}
                  />
                  </span>
                )}
                {!!item.badge && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#241c27] bg-pn-brand px-1 text-[11px] font-semibold leading-none text-white tabular-nums">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className={`text-[12px] leading-4 ${item.active ? "font-semibold" : "font-normal"}`}>{item.label}</span>
            </button>
          )
        )}
      </div>
    </nav>
    </>
  );
}
