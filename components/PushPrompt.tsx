"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { enablePush, getPushState } from "@/lib/pushClient";

// Lời mời bật thông báo đẩy — KHÔNG bật hộp xin quyền của trình duyệt ngay
// khi vừa vào (người dùng bấm "Chặn" theo phản xạ là mất luôn). Chỉ mời sau
// khi họ đã dùng app một lúc, giải thích rõ lợi ích; "Để sau" thì 7 ngày nữa
// mới hỏi lại.
const DISMISS_KEY = "pn_push_dismissed_at";
const DELAY_MS = 25_000;
const SNOOZE_MS = 7 * 86_400_000;
const QUIET = [/^\/auth/, /^\/messages/, /^\/jobs\/create/, /^\/admin/];

export default function PushPrompt() {
  const { user } = useSessionUser();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        if (Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < SNOOZE_MS) return;
      } catch {}
      const state = await getPushState();
      if (alive && state === "off") setShow(true);
    }, DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [user?.id]);

  if (!show || QUIET.some((r) => r.test(pathname || ""))) return null;

  const later = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const isTech = user?.role === "TECHNICIAN";
  return (
    <div
      role="dialog"
      aria-label="Bật thông báo"
      className="fixed inset-x-3 bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-[45] animate-fadeIn sm:inset-x-auto sm:left-5 sm:w-[380px] md:bottom-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-pink-500/30 bg-slate-950/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <span aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-pink-600/20 blur-2xl" />
        <button onClick={later} aria-label="Đóng" className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
        <div className="relative flex gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-600/30">
            <BellRing className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0 pr-5">
            <p className="text-sm font-black text-white">Bật thông báo trên điện thoại</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {isTech
                ? "Biết ngay khi tiệm gần bạn cần thợ gấp, có tin nhắn hay cuộc gọi — kể cả khi đã tắt app."
                : "Biết ngay khi thợ nhắn tin, gọi điện hay lưu tin tuyển của bạn — kể cả khi đã tắt app."}
            </p>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <button onClick={later} className="min-h-[40px] rounded-xl bg-white/5 text-xs font-bold text-slate-300 ring-1 ring-white/10 hover:bg-white/10">
            Để sau
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await enablePush().catch(() => "off");
              setBusy(false);
              later();
            }}
            className="min-h-[40px] rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-xs font-black text-white shadow-lg shadow-pink-600/25 disabled:opacity-60"
          >
            {busy ? "Đang bật…" : "Bật thông báo"}
          </button>
        </div>
      </div>
    </div>
  );
}
