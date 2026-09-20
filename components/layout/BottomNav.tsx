"use client";

import React, { useEffect, useState } from "react";
import { Home, Users, MessageSquare, User as UserIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useUnreadMessages } from "@/lib/UnreadMessagesContext";

const PRESS = "active:scale-95 transition-transform duration-100";

// Mounted once in the root layout so it's present on every route — unlike
// the old mobile nav that lived inside Sidebar.tsx (only rendered on the
// homepage, and only had the 2 homepage tabs, not an app-wide destination
// set). Dân Nail dùng mobile 90% nên đây là điều hướng chính trên điện
// thoại, luôn ở tầm ngón tay cái (đáy màn hình, min-h-[48px] mỗi nút).
export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: sessionUser, loading } = useSessionUser();
  const { unreadCount } = useUnreadMessages();

  // Đọc ?tab= thủ công qua window.location (không dùng useSearchParams —
  // cùng lý do đã ghi ở app/page.tsx: buộc bọc Suspense và từng gây
  // double-render/kẹt loading trên Next 16 dev mode). Chỉ đồng bộ lại khi
  // pathname đổi (chuyển trang thật); khi bấm ngay trong component này thì
  // set optimistic luôn bên dưới, không cần đợi vòng lặp này.
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get("tab"));
  }, [pathname]);

  // Ẩn khi chưa đăng nhập (chưa có gì để "Tin nhắn"/"Tài khoản"), trên các
  // trang /auth/* (đang trong luồng đăng ký/đăng nhập riêng), và trên
  // /messages (màn hình chat full-screen có ô soạn tin sát đáy — thêm 1
  // thanh nav cố định ở dưới sẽ chồng lên bàn phím/ô nhập liệu).
  const hidden =
    loading || !sessionUser || pathname?.startsWith("/auth") || pathname?.startsWith("/messages");
  if (hidden) return null;

  const isHome = pathname === "/";
  const isTechsTabActive = isHome && tab === "portfolio";

  const goToTab = (nextTab: "feed" | "jobs" | "portfolio") => {
    setTab(nextTab); // optimistic — không cần đợi navigation round-trip
    if (isHome) {
      // Cùng route "/" — Next không remount app/page.tsx nên effect đọc
      // ?tab= lúc mount của nó sẽ không tự chạy lại; bắn event để nó cập
      // nhật state ngay, router.push chỉ để đồng bộ URL (share link/refresh).
      window.dispatchEvent(new CustomEvent("hometab-change", { detail: nextTab }));
    }
    router.push(`/?tab=${nextTab}`, { scroll: false });
  };

  const items = [
    {
      id: "home",
      label: "Trang chủ",
      icon: Home,
      onClick: () => goToTab("feed"),
      active: isHome && !isTechsTabActive,
    },
    {
      id: "techs",
      label: "Thợ",
      icon: Users,
      onClick: () => goToTab("portfolio"),
      active: isTechsTabActive,
    },
    {
      id: "messages",
      label: "Tin nhắn",
      icon: MessageSquare,
      onClick: () => router.push("/messages"),
      active: pathname?.startsWith("/messages") ?? false,
      badge: unreadCount,
    },
    {
      id: "account",
      label: sessionUser.role === "OWNER" ? "Tiệm của tôi" : "Tài khoản",
      icon: UserIcon,
      onClick: () => router.push("/profile"),
      active: pathname?.startsWith("/profile") ?? false,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center justify-around border-t border-slate-850 bg-slate-950/95 px-2 pt-1.5 shadow-2xl backdrop-blur-lg"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`relative flex min-h-[48px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 ${PRESS} ${
              item.active ? "text-pink-400" : "text-slate-500"
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {!!item.badge && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-slate-950 bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
