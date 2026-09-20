"use client";

import { useEffect, useState } from "react";
import { getPusherClient } from "@/lib/pusherClient";

// Global banner for the ONE shared Pusher connection (singleton client — see
// lib/pusherClient.ts). CallManager and MessagesContent each bind their own
// channel, but connection state itself is shared across the whole app, so a
// single listener here covers both: real-time messages and incoming calls
// used to go silent the exact same way when this dropped, with zero visible
// feedback. "connecting" is deliberately NOT treated as a drop — pusher-js
// starts every session in that state before its first-ever connect, so
// showing the banner there would falsely read as a reconnect on every page
// load.
export default function PusherStatusBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const handleStateChange = ({ current }: { previous: string; current: string }) => {
      if (current === "unavailable" || current === "disconnected") {
        setShow(true);
      } else if (current === "connected") {
        setShow(false);
      }
    };

    pusher.connection.bind("state_change", handleStateChange);
    return () => {
      pusher.connection.unbind("state_change", handleStateChange);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow-lg animate-fadeIn pt-[max(0.5rem,env(safe-area-inset-top))]">
      <span className="h-2 w-2 rounded-full bg-amber-900 animate-pulse flex-shrink-0" />
      Đang kết nối lại máy chủ tin nhắn...
    </div>
  );
}
