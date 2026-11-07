"use client";

import React, { createContext, useContext, useRef } from "react";
import { useSessionUser } from "@/lib/SessionUserContext";
import CallManager, { CallManagerHandle, CallPartner } from "@/components/chat/CallManager";
import { isBubbleMode } from "@/lib/bubbleMode";

interface CallManagerContextValue {
  startCall: (partner: CallPartner, type: "audio" | "video") => void;
}

const CallManagerContext = createContext<CallManagerContextValue>({
  startCall: () => {},
});

// Mounted once at the root layout — not inside any single page — so the
// incoming-call Pusher subscription (and the full-screen ringing/call
// overlay it owns) stays alive everywhere in the app, not just while
// /messages happens to be open. Any page that wants to start an outgoing
// call reaches this one instance via useCallManager() instead of rendering
// its own <CallManager>.
export function CallManagerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSessionUser();
  const callManagerRef = useRef<CallManagerHandle>(null);

  const startCall = (partner: CallPartner, type: "audio" | "video") => {
    callManagerRef.current?.startCall(partner, type);
  };

  return (
    <CallManagerContext.Provider value={{ startCall }}>
      {children}
      <CallManager
        ref={callManagerRef}
        // Bong bóng chat Android là WebView THỨ HAI cùng tài khoản: không nghe cuộc gọi đến ở đó (app chính đổ
        // chuông) — tránh chuông kêu 2 nơi. CallManager không vẽ gì khi rảnh nên không lệch hydrate.
        currentUserId={isBubbleMode() ? undefined : user?.id}
        currentUserName={user?.name}
        currentUserAvatar={user?.avatarUrl || null}
      />
    </CallManagerContext.Provider>
  );
}

export function useCallManager() {
  return useContext(CallManagerContext);
}
