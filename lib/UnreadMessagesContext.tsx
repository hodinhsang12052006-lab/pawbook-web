"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { getPusherClient } from "@/lib/pusherClient";
import { chatChannelName } from "@/lib/pusherChannel";
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

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = chatChannelName(String(sessionUser.id).trim());
    const channel = pusher.subscribe(channelName);

    const handler = (data: any) => {
      const message = data?.message || data;
      if (!message || message.senderId === sessionUser.id) return;
      if (pathnameRef.current && pathnameRef.current.startsWith("/messages")) return;

      setUnreadCount((c) => c + 1);
      toast.success(
        `Tin nhắn mới từ ${message.sender?.name || "ai đó"}: ${(message.content || "").substring(0, 20)}...`,
        { icon: "💬", position: "top-right" }
      );
    };

    channel.bind("new-message", handler);

    return () => {
      channel.unbind("new-message", handler);
      pusher.unsubscribe(channelName);
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
