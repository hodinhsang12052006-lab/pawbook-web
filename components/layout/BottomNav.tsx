"use client";

import React, { useEffect, useRef, useState } from "react";
import { Newspaper, Briefcase, Users, MessageCircle, Plus, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
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

  // Ẩn khi chưa đăng nhập, trong luồng /auth/*, và trên /messages (ô soạn
  // tin sát đáy màn hình — thanh nav sẽ chồng lên bàn phím/ô nhập).
  const hidden = loading || !sessionUser || pathname?.startsWith("/auth") || pathname?.startsWith("/messages");
  if (hidden) return null;

  const isOwner = sessionUser.role === "OWNER";
  const isHome = pathname === "/";
  const currentTab = (tab as HomeTab) || "feed";

  const goToTab = (nextTab: HomeTab) => {
    setTab(nextTab);
    if (isHome) window.dispatchEvent(new CustomEvent("hometab-change", { detail: nextTab }));
    router.push(`/?tab=${nextTab}`, { scroll: false });
  };

  // Mục thứ 2 theo vai trò: thợ cần VIỆC, chủ tiệm cần THỢ.
  const secondTab: HomeTab = isOwner ? "portfolio" : "jobs";

  const items: NavItem[] = [
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
      label: isOwner ? tr("Tìm thợ", "Find techs") : tr("Việc làm", "Jobs"),
      icon: isOwner ? Users : Briefcase,
      onClick: () => goToTab(secondTab),
      active: isHome && currentTab === secondTab,
    },
    {
      id: "messages",
      label: tr("Tin nhắn", "Messages"),
      icon: MessageCircle,
      onClick: () => router.push("/messages"),
      active: pathname?.startsWith("/messages") ?? false,
      badge: unreadCount,
    },
    {
      id: "profile",
      label: tr("Hồ sơ", "Profile"),
      onClick: () => router.push("/profile"),
      active: pathname?.startsWith("/profile") ?? false,
    },
  ];

  const createAction = () => {
    if (isOwner) {
      router.push("/jobs/create");
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
      router.push("/?tab=feed");
    }
  };

  // Thứ tự hiển thị: 2 mục · ＋ · 2 mục. Viên sáng trượt theo cột (5 cột).
  const slots = [items[0], items[1], null, items[2], items[3]];
  const activeIndex = slots.findIndex((it) => it?.active);

  return (
    <nav
      aria-label="Điều hướng chính"
      className={`fixed inset-x-3 z-50 transition-transform duration-300 ease-out md:hidden ${hiddenByScroll ? "translate-y-[calc(100%+24px)]" : "translate-y-0"}`}
      style={{ bottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="relative grid grid-cols-5 items-center rounded-[22px] border border-white/10 bg-slate-950/85 px-1 py-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        {/* Viên sáng trượt theo mục đang chọn */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1 w-[calc((100%-0.5rem)/5)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="absolute inset-x-1 inset-y-0 rounded-2xl bg-gradient-to-b from-pink-500/20 to-fuchsia-500/5 ring-1 ring-pink-400/25" />
            <span className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]" />
          </span>
        )}

        {slots.map((item, i) =>
          item === null ? (
            <div key="create" className="flex justify-center">
              <button
                type="button"
                onClick={createAction}
                aria-label={isOwner ? tr("Đăng tin tuyển thợ", "Post a job") : tr("Đăng bài mới", "New post")}
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 text-white shadow-[0_10px_24px_-6px_rgba(219,39,119,0.75)] ring-4 ring-slate-950 transition-transform duration-150 active:scale-90"
              >
                <Plus className="h-6 w-6" strokeWidth={2.75} />
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
                item.active ? "text-white" : "text-slate-500"
              }`}
            >
              <span key={popId === item.id ? `pop-${i}` : `still-${i}`} className={`relative ${popId === item.id ? "nav-pop" : ""}`}>
                {item.icon ? (
                  <item.icon className={`h-[22px] w-[22px] ${item.active ? "text-pink-300" : ""}`} strokeWidth={item.active ? 2.4 : 2} />
                ) : (
                  <span aria-hidden>
                  <Avatar
                    src={sessionUser.avatarUrl}
                    name={sessionUser.name}
                    seed={sessionUser.id}
                    loading="eager"
                    className={`h-[24px] w-[24px] ${item.active ? "ring-2 ring-pink-400" : "ring-1 ring-white/20"}`}
                  />
                  </span>
                )}
                {!!item.badge && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-r from-red-500 to-pink-500 px-1 text-[9px] font-black leading-none text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className={`text-[10.5px] leading-none ${item.active ? "font-bold" : "font-semibold"}`}>{item.label}</span>
            </button>
          )
        )}
      </div>
    </nav>
  );
}
