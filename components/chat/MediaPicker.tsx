"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { EMOJI_GROUPS } from "@/lib/chatStickers";
import { pushEmojiRecent, readEmojiRecent, writeMediaTab } from "@/lib/stickers/store";
import { buildEmojiIndex, loadEmojiWords, searchEmoji, type EmojiWords } from "@/lib/stickers/emojiSearch";
import type { StickerMarket } from "@/lib/stickers/seasons";
import StickerTab from "./StickerTab";
import GifTab, { type GifItem } from "./GifTab";
import { probeGifs, useGifEnabled } from "@/lib/chat/gifAvailability";

// Bảng chèn biểu tượng (như Messenger / Telegram): Emoji (ô tìm EN + VI · chia nhóm + "Gần đây") · Nhãn dán · GIF.
// Bảng nằm trên ô nhập; gửi nhãn dán / GIF xong bảng VẪN MỞ. Đóng: X, Esc, chạm ra ngoài, nút Back (MessagesContent).
// Tab đang dùng nhớ theo người (pn_media_tab:<userId>); emoji gần đây theo người (pn_emoji_recent:v1:<userId>).
// GIF chỉ hiện khi máy chủ có khoá GIPHY / Tenor (lib/chat/gifAvailability.ts — hỏi 1 lần / phiên): chưa có → không có tab
// GIF, không có nút "Tìm GIF …", tab nhớ là GIF thì mở Nhãn dán.
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
  // Bảng chỉ dựng ở trình duyệt (sau khi bấm mở) → đọc thẳng localStorage lúc khởi tạo
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readEmojiRecent(userId)));
  const [group, setGroup] = useState<string>(() => (recent.length ? "recent" : EMOJI_GROUPS[0].id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const gifOn = useGifEnabled();
  useEffect(() => {
    if (gifOn === null) probeGifs();
  }, [gifOn]);
  // GIF tắt (hoặc vừa phát hiện khoá sai) mà đang ở tab GIF → sang Nhãn dán
  useEffect(() => {
    if (tab === "gif" && gifOn === false) onTab("sticker");
  }, [tab, gifOn, onTab]);
  useEffect(() => {
    if (tab !== "gif" || gifOn === true) writeMediaTab(userId, tab);
  }, [userId, tab, gifOn]);
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

  // Tìm emoji (EN + VI, không dấu — lib/stickers/emojiSearch.ts). Từ khoá CLDR tải động khi chạm / gõ vào ô tìm lần đầu.
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<EmojiWords | null>(null);
  const wordsReq = useRef(false);
  const loadWords = useCallback(() => {
    if (wordsReq.current) return;
    wordsReq.current = true;
    loadEmojiWords()
      .then(setWords)
      .catch(() => {
        wordsReq.current = false;
      });
  }, []);
  const index = useMemo(() => (words ? buildEmojiIndex(EMOJI_GROUPS.flatMap((g) => g.items), words) : null), [words]);
  const searching = !!query.trim();
  const found = useMemo(() => (searching && index ? searchEmoji(query, index, lang) : null), [searching, index, query, lang]);

  const tabBtn = (t: MediaTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => onTab(t)}
      className={`pn-hit rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${tab === t ? "bg-[#f7eef3] text-[#1c1521]" : "text-[#c0b2bc] hover:bg-white/5 hover:text-white"}`}
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
          {gifOn === true && tabBtn("gif", "GIF")}
        </div>
        <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="flex h-10 w-10 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "emoji" && (
        <>
          {/* Ô tìm luôn có sẵn (cao cố định) → gõ / xoá tìm không làm bảng nhảy; kết quả thay cho lưới nhóm, cùng chỗ */}
          <div className="px-3 pt-2">
            <label className="pn-stk-search">
              <Search className="h-4 w-4 flex-shrink-0 text-[#a69ba4]" aria-hidden />
              <input
                value={query}
                onChange={(e) => {
                  loadWords();
                  setQuery(e.target.value);
                }}
                onFocus={loadWords}
                onPointerDown={loadWords}
                onKeyDown={(e) => {
                  // Esc khi đang tìm: xoá ô tìm trước (Esc lần nữa mới đóng bảng)
                  if (e.key === "Escape" && query) {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setQuery("");
                  }
                }}
                placeholder={tr("Tìm emoji", "Search emoji")}
                aria-label={tr("Tìm emoji", "Search emoji")}
                enterKeyHint="search"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-base text-[#f7eef3] placeholder-[#a69ba4] focus:outline-none sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={tr("Xoá", "Clear")}
                  className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>
          <p className="h-7 truncate px-4 pb-1 pt-2 text-[11px] font-bold uppercase leading-[16px] tracking-wider text-[#a69ba4]" aria-live="polite">
            {searching ? (found === null ? tr("Đang tìm…", "Searching…") : found.length ? tr("Kết quả", "Results") : "") : tr(shown.label[0], shown.label[1])}
          </p>
          <div ref={scrollRef} data-emoji-grid={searching ? "results" : shown.id} className="custom-scrollbar grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto px-2 pb-2">
            {searching && found && !found.length ? (
              <p className="col-span-8 py-8 text-center text-[13px] text-[#c0b2bc]">{tr("Không tìm thấy emoji nào", "No emoji found")}</p>
            ) : (
              (searching ? found ?? [] : shown.items).map((e, i) => (
                <button key={`${e}-${i}`} type="button" onClick={() => pickEmoji(e)} aria-label={e} data-emoji={e} className="flex aspect-square items-center justify-center rounded-xl text-[26px] leading-none transition-transform hover:scale-110 hover:bg-white/10 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100">
                  {e}
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-0.5 border-t border-white/5 px-2 py-1.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGroup(g.id);
                  setQuery("");
                  scrollRef.current?.scrollTo({ top: 0 });
                }}
                aria-label={tr(g.label[0], g.label[1])}
                title={tr(g.label[0], g.label[1])}
                className={`pn-hit flex h-9 flex-1 items-center justify-center rounded-xl text-lg transition-colors ${!searching && shown.id === g.id ? "bg-white/10" : "opacity-60 hover:bg-white/5 hover:opacity-100"}`}
              >
                {g.id === "recent" ? <Clock className="h-4 w-4 text-slate-300" /> : g.icon}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "sticker" && <StickerTab userId={userId} market={market} onSend={onSticker} onSearchGif={gifOn === true ? (q) => onTab("gif", q) : undefined} />}

      {tab === "gif" && gifOn !== false && <GifTab key={gifQuery ?? ""} userId={userId} lang={lang} initialQuery={gifQuery} onSend={onGif} onStickers={() => onTab("sticker")} />}
    </div>
  );
}
