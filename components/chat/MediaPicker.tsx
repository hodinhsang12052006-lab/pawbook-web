"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { EMOJI_GROUPS } from "@/lib/chatStickers";
import { pushEmojiRecent, readEmojiRecent, writeMediaTab } from "@/lib/stickers/store";
import type { StickerMarket } from "@/lib/stickers/seasons";
import StickerTab from "./StickerTab";
import GifTab, { type GifItem } from "./GifTab";

// Bảng chèn biểu tượng (như Messenger / Telegram): Emoji (chia nhóm + "Gần đây") · Nhãn dán · GIF.
// Bảng nằm trên ô nhập; gửi nhãn dán / GIF xong bảng VẪN MỞ. Đóng: X, Esc, chạm ra ngoài, nút Back (MessagesContent).
// Tab đang dùng nhớ theo người (pn_media_tab:<userId>); emoji gần đây theo người (pn_emoji_recent:v1:<userId>).
export type MediaTab = "emoji" | "sticker" | "gif";

export default function MediaPicker({
  userId,
  market,
  lang,
  tab,
  gifQuery,
  onTab,
  onEmoji,
  onSticker,
  onGif,
  onClose,
}: {
  userId: string;
  market: StickerMarket;
  lang: "vi" | "en";
  tab: MediaTab;
  /** Từ khoá chuyển từ tab Nhãn dán ("Tìm GIF …") */
  gifQuery?: string;
  onTab: (t: MediaTab, gifQuery?: string) => void;
  onEmoji: (e: string) => void;
  onSticker: (id: string) => void;
  onGif: (g: GifItem) => void;
  onClose: () => void;
}) {
  useTr();
  const panelRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [group, setGroup] = useState<string>("recent");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = readEmojiRecent(userId);
    setRecent(r);
    if (!r.length) setGroup(EMOJI_GROUPS[0].id);
  }, [userId]);
  useEffect(() => {
    writeMediaTab(userId, tab);
  }, [userId, tab]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[data-sticker-peek]")) return;
      onClose();
    };
    // chạm ra ngoài bảng (trừ nút mở bảng + lớp xem trước sticker gắn ở <body>) → đóng
    const outside = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || panelRef.current?.contains(t) || t.closest("[data-media-panel-child], [data-media-toggle]")) return;
      onClose();
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("pointerdown", outside);
    };
  }, [onClose]);

  const pickEmoji = (e: string) => {
    onEmoji(e);
    setRecent(pushEmojiRecent(userId, e));
  };

  const groups = useMemo(
    () => [...(recent.length ? [{ id: "recent", label: ["Gần đây", "Recent"] as [string, string], icon: "🕘", items: recent }] : []), ...EMOJI_GROUPS],
    [recent]
  );
  const shown = groups.find((g) => g.id === group) ?? groups[0];

  const tabBtn = (t: MediaTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => onTab(t)}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${tab === t ? "bg-[#f7eef3] text-[#1c1521]" : "text-[#c0b2bc] hover:bg-white/5 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div ref={panelRef} role="dialog" aria-label={tr("Chọn biểu tượng", "Pick emoji")} data-media-panel="" className="pn-media-panel animate-fadeIn">
      <div className="flex items-center justify-between px-3 pt-3">
        <div role="tablist" className="flex items-center gap-1">
          {tabBtn("emoji", tr("Emoji", "Emoji"))}
          {tabBtn("sticker", tr("Nhãn dán", "Stickers"))}
          {tabBtn("gif", "GIF")}
        </div>
        <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="flex h-9 w-9 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "emoji" && (
        <>
          <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[#a69ba4]">{tr(shown.label[0], shown.label[1])}</p>
          <div ref={scrollRef} className="custom-scrollbar grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto px-2 pb-2">
            {shown.items.map((e, i) => (
              <button key={`${e}-${i}`} type="button" onClick={() => pickEmoji(e)} aria-label={e} className="flex aspect-square items-center justify-center rounded-xl text-[26px] leading-none transition-transform hover:scale-110 hover:bg-white/10 active:scale-95">
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-0.5 border-t border-white/5 px-2 py-1.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGroup(g.id);
                  scrollRef.current?.scrollTo({ top: 0 });
                }}
                aria-label={tr(g.label[0], g.label[1])}
                title={tr(g.label[0], g.label[1])}
                className={`flex h-9 flex-1 items-center justify-center rounded-xl text-lg transition-colors ${shown.id === g.id ? "bg-white/10" : "opacity-60 hover:bg-white/5 hover:opacity-100"}`}
              >
                {g.id === "recent" ? <Clock className="h-4 w-4 text-slate-300" /> : g.icon}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "sticker" && <StickerTab userId={userId} market={market} onSend={onSticker} onSearchGif={(q) => onTab("gif", q)} />}

      {tab === "gif" && <GifTab key={gifQuery ?? ""} userId={userId} lang={lang} initialQuery={gifQuery} onSend={onGif} onStickers={() => onTab("sticker")} />}
    </div>
  );
}
