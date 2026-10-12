"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, X, Loader2 } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { EMOJI_GROUPS, STICKER_PACKS } from "@/lib/chatStickers";

// Bảng chèn biểu tượng như Messenger/Zalo: 3 tab Emoji (chia nhóm + "Gần đây") · Sticker hoạt hình
// (theo bộ) · GIF (tìm kiếm). Bảng nằm trên ô nhập; bấm ngoài / Esc / X để đóng.
export type MediaTab = "emoji" | "sticker" | "gif";

const RECENT_KEY = "pn_recent_emoji";
const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 24); } catch { return []; }
};

interface Gif { url: string; preview: string }

export default function MediaPicker({ tab, onTab, onEmoji, onSticker, onGif, onClose }: {
  tab: MediaTab;
  onTab: (t: MediaTab) => void;
  onEmoji: (e: string) => void;
  onSticker: (e: string) => void;
  onGif: (url: string) => void;
  onClose: () => void;
}) {
  useTr();
  const [recent, setRecent] = useState<string[]>([]);
  const [group, setGroup] = useState<string>("recent");
  const [pack, setPack] = useState(STICKER_PACKS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = readRecent();
    setRecent(r);
    if (!r.length) setGroup(EMOJI_GROUPS[0].id);
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const pickEmoji = (e: string) => {
    onEmoji(e);
    const next = [e, ...recent.filter((x) => x !== e)].slice(0, 24);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  };

  const groups = useMemo(() => [
    ...(recent.length ? [{ id: "recent", label: [tr("Gần đây", "Recent"), "Recent"] as [string, string], icon: "🕘", items: recent }] : []),
    ...EMOJI_GROUPS,
  ], [recent]);
  const shown = groups.find((g) => g.id === group) ?? groups[0];
  const curPack = STICKER_PACKS.find((p) => p.id === pack) ?? STICKER_PACKS[0];

  const tabBtn = (t: MediaTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => onTab(t)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${tab === t ? "bg-white text-slate-900" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-label={tr("Chọn biểu tượng", "Pick emoji")} className="absolute bottom-[calc(100%+8px)] left-2 right-2 z-30 flex h-[22rem] max-h-[60vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fadeIn sm:left-4 sm:right-auto sm:w-[380px]">
      <div className="flex items-center justify-between px-3 pt-3">
        <div role="tablist" className="flex items-center gap-1">
          {tabBtn("emoji", "Emoji")}
          {tabBtn("sticker", "Sticker")}
          {tabBtn("gif", "GIF")}
        </div>
        <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "emoji" && (
        <>
          <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{tr(shown.label[0], shown.label[1])}</p>
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
                onClick={() => { setGroup(g.id); scrollRef.current?.scrollTo({ top: 0 }); }}
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

      {tab === "sticker" && (
        <>
          <div className="custom-scrollbar grid flex-1 grid-cols-4 content-start gap-1 overflow-y-auto p-2">
            {curPack.items.map((e) => (
              <button key={e} type="button" onClick={() => onSticker(e)} aria-label={e} className="group flex aspect-square items-center justify-center rounded-2xl transition-colors hover:bg-white/5 active:scale-95">
                {/* Bảng dùng emoji tĩnh (mở tức thì, không tải 20MB ảnh động); tin gửi đi mới là bản hoạt hình. */}
                <span className="text-[44px] leading-none transition-transform duration-200 group-hover:scale-110">{e}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-t border-white/5 px-2 py-1.5">
            {STICKER_PACKS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPack(p.id)} title={tr(p.label[0], p.label[1])} className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-colors ${pack === p.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>
                <span className="text-lg leading-none">{p.icon}</span>
                <span className="hidden sm:inline">{tr(p.label[0], p.label[1])}</span>
              </button>
            ))}
            <span className="ml-auto pr-1 text-[9px] text-slate-600" title="Noto Emoji Animation — Google, CC BY 4.0">Noto · CC BY 4.0</span>
          </div>
        </>
      )}

      {tab === "gif" && <GifTab onGif={onGif} />}
    </div>
  );
}

// Sẵn để chắc chắn trang dùng được dù chưa cấu hình khoá GIPHY.
const FALLBACK_GIFS = [
  "https://i.giphy.com/11ISwbgCxEzMyY.gif", "https://i.giphy.com/3o7TKSjRrfIPjei1IQ.gif", "https://i.giphy.com/26gR2f01UTX9R7VyU.gif",
  "https://i.giphy.com/3o7abKhOpu0NXS3WY0.gif", "https://i.giphy.com/26n6Gx9moCgs1pUuk.gif", "https://i.giphy.com/l3q2zVr6cu95nF6O4.gif",
  "https://i.giphy.com/2WxWfiavndgcM.gif", "https://i.giphy.com/11N0ycAEVs3dbO.gif", "https://i.giphy.com/XgBx22IJ2yHzG.gif",
  "https://i.giphy.com/7YBZCh1TIoC8U.gif", "https://i.giphy.com/t3s3uEQ5j181C.gif", "https://i.giphy.com/3oEjI6SIIHBdRxXI40.gif",
].map((url) => ({ url, preview: url }));

const GIF_TAGS = ["Cảm ơn", "Haha", "Yêu", "Chúc mừng", "Ok", "Buồn", "Wow", "Nails"];

function GifTab({ onGif }: { onGif: (url: string) => void }) {
  useTr();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Gif[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/gifs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        const d = await r.json();
        setEnabled(!!d.enabled);
        setItems(d.enabled ? d.results : FALLBACK_GIFS);
      } catch {
        setEnabled(false);
        setItems(FALLBACK_GIFS);
      } finally {
        setLoading(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className="px-3 pt-2">
        <label className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 ring-1 ring-white/10 focus-within:ring-pink-500/50">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!enabled} placeholder={enabled ? tr("Tìm GIF…", "Search GIFs…") : tr("Tìm GIF sắp có", "GIF search coming soon")} className="min-w-0 flex-1 bg-transparent text-base text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-60 sm:text-sm" />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-pink-400" />}
        </label>
        {enabled && (
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {GIF_TAGS.map((t) => (
              <button key={t} type="button" onClick={() => setQ(t)} className="flex-shrink-0 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10">{t}</button>
            ))}
          </div>
        )}
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
        {items === null ? (
          <div className="grid grid-cols-2 gap-1.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">{tr("Không tìm thấy GIF nào", "No GIFs found")}</p>
        ) : (
          <div className="columns-2 gap-1.5">
            {items.map((g) => (
              <button key={g.url} type="button" onClick={() => onGif(g.url)} className="mb-1.5 block w-full overflow-hidden rounded-xl bg-white/5 transition-opacity hover:opacity-85 active:scale-[0.98]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt="GIF" loading="lazy" decoding="async" className="block h-auto w-full" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
              </button>
            ))}
          </div>
        )}
        {enabled && <p className="pt-1 text-center text-[9px] text-slate-600">Powered by GIPHY</p>}
      </div>
    </>
  );
}
