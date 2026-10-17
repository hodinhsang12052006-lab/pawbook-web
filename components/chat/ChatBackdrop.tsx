"use client";

import React from "react";
import { NAIL_PATTERN, WALLPAPER_ORBS } from "@/lib/chatWallpapers";

// Lớp nền "sống" phía sau tin nhắn: 3 quầng sáng (gradient tròn, không filter) trôi rất chậm + hoạ tiết
// nail mờ + viền tối dịu. Nằm z-index -1 trong khung chat (khung có `isolate`), không bắt sự kiện chuột.
export default function ChatBackdrop({ theme }: { theme: string }) {
  const [a, b, c] = WALLPAPER_ORBS[theme] ?? WALLPAPER_ORBS.default;
  const orb = (color: string) => ({ background: `radial-gradient(circle at center, ${color} 0%, transparent 62%)` });
  return (
    <div aria-hidden className="pn-chat-backdrop">
      <div className="pn-orb pn-orb-a" style={orb(a)} />
      <div className="pn-orb pn-orb-b" style={orb(b)} />
      <div className="pn-orb pn-orb-c" style={orb(c)} />
      {theme === "default" && <div className="pn-grain" style={{ backgroundImage: NAIL_PATTERN }} />}
      <div className="pn-vignette" />
    </div>
  );
}
