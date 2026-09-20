"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { playNotifySound } from "@/lib/notifySound";
import { useSessionUser } from "@/lib/SessionUserContext";

interface UnreadMessagesContextValue {
  unreadCount: number;
  resetUnread: () => void;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
  unreadCount: 0,
  resetUnread: () => {},
});

// Single shared Pusher subscription for the whole app — Navbar's badge and
// the mobile BottomNav's badge both read from here instead of each
// independently subscribing to the same channel (which used to double up
// the "new message" toast and, since the old subscription's deps included
// `pathname`, resubscribed on every single route change for no reason).
export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { user: sessionUser } = useSessionUser();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (pathname && pathname.startsWith("/messages")) setUnreadCount(0);
  }, [pathname]);

  useEffect(() => {
    if (!sessionUser?.id) return;

    // Kênh DÙNG CHUNG với CallManager/MessagesContent (xem
    // lib/pusherUserChannel.ts) — trước đây provider này tự
    // pusher.subscribe()/unsubscribe() độc lập, và vì đây là provider mount
    // TOÀN CỤC (không unmount khi điều hướng), lúc trước nó vẫn sống sót,
    // nhưng NẾU MessagesContent (mount/unmount theo trang) từng gọi
    // unbind_all() trên cùng kênh thì handler ở đây cũng bị xóa theo — dùng
    // acquire/release để không còn phụ thuộc thứ tự mount/unmount giữa các
    // component nữa.
    const channel = acquireUserChannel(String(sessionUser.id).trim());
    if (!channel) return;

    const handler = (data: any) => {
      const message = data?.message || data;
      if (!message || message.senderId === sessionUser.id) return;

      const onMessagesPage = !!pathnameRef.current?.startsWith("/messages");
      const tabHidden = typeof document !== "undefined" && document.hidden;
      // Chỉ thật sự coi là "đang đọc" khi vừa ở trang /messages VÀ tab đang
      // active — nếu đang ở /messages nhưng đã chuyển sang tab/app khác
      // (tabHidden), vẫn phải báo như bình thường thay vì im lặng bỏ qua.
      if (onMessagesPage && !tabHidden) return;

      setUnreadCount((c) => c + 1);
      playNotifySound();
      toast.success(
        `Tin nhắn mới từ ${message.sender?.name || "ai đó"}: ${(message.content || "").substring(0, 20)}...`,
        { icon: "💬", position: "top-right" }
      );
    };

    channel.bind("new-message", handler);

    return () => {
      channel.unbind("new-message", handler);
      releaseUserChannel(String(sessionUser.id).trim());
    };
    // pathname deliberately omitted — read via pathnameRef so this doesn't
    // tear down and rebuild the subscription on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, resetUnread: () => setUnreadCount(0) }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
