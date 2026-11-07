"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { corsSafeGif } from "@/lib/chat/gif";
import { pushGifRecent, readGifRecent, type StoredGif } from "@/lib/stickers/store";

// Tab GIF: chỉ GIF thật từ API hợp lệ (/api/gifs → GIPHY, hoặc Tenor). KHÔNG có bộ GIF dán cứng.
// Chưa có khoá / khoá sai → không hiện ô GIF nào, chỉ báo "chưa dùng được" + nút sang Nhãn dán.
// Lưới so le 2 cột (< 600px) / 3 cột, mỗi ô giữ đúng tỉ lệ w/h (không nhảy bố cục), cuộn tới gần cuối thì tải
// trang sau (tối đa 5 trang). Ghi công "Powered by GIPHY / Tenor" luôn hiện khi có kết quả.
export type GifItem = StoredGif;
type Provider = "giphy" | "tenor";
type State = (
  | { kind: "loading" }
  | { kind: "ready"; provider: Provider; items: GifItem[]; next: string | null; pages: number; more: boolean }
  | { kind: "disabled" }
  | { kind: "error" }
) & { key?: string };

const MAX_PAGES = 5;
// Chip: nhãn theo ngôn ngữ, nhưng TÌM bằng từ tiếng Anh (GIPHY gắn thẻ tiếng Anh là chính).
const CHIPS = (): [label: string, term: string][] => [
  [tr("Cảm ơn", "Thank you"), "thank you"],
  [tr("Yêu", "Love"), "love"],
  [tr("Chúc mừng", "Congrats"), "congratulations"],
  ["Haha", "lol"],
  ["OK", "ok"],
  ["Wow", "wow"],
  [tr("Buồn", "Sad"), "sad"],
  ["Nails", "nails"],
  [tr("Xin chào", "Hi"), "hello"],
  [tr("Ngủ ngon", "Good night"), "good night"],
];

export default function GifTab({
  userId,
  lang,
  initialQuery,
  onSend,
  onStickers,
}: {
  userId: string;
  lang: "vi" | "en";
  initialQuery?: string;
  onSend: (g: GifItem) => void;
  onStickers: () => void;
}) {
  useTr();
  const [input, setInput] = useState(initialQuery ?? "");
  const [req, setReq] = useState<{ q: string; lang: "vi" | "en" }>({ q: (initialQuery ?? "").trim(), lang });
  const [loaded, setState] = useState<State>({ kind: "loading" });
  const [recent, setRecent] = useState<GifItem[]>(() => (typeof window === "undefined" ? [] : readGifRecent(userId)));
  const [cols, setCols] = useState(2);
  const [retry, setRetry] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const typed = useRef(false);

  // gõ → chờ 350ms rồi tìm (theo ngôn ngữ đang dùng)
  useEffect(() => {
    if (!typed.current) return;
    const t = setTimeout(() => setReq({ q: input.trim(), lang }), 350);
    return () => clearTimeout(t);
  }, [input, lang]);

  const fetchPage = useCallback(async (q: string, l: "vi" | "en", next: string | null) => {
    const sp = new URLSearchParams({ lang: l });
    if (q) sp.set("q", q);
    if (next) sp.set("next", next);
    const r = await fetch(`/api/gifs?${sp}`);
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as { enabled: boolean; provider: Provider | null; results: GifItem[]; next: string | null };
  }, []);

  // Kết quả gắn với đúng lượt tìm (key) — đổi từ khoá thì tự về "đang tải" cho tới khi lượt mới về.
  const key = `${req.lang}|${req.q}|${retry}`;
  const state = useMemo<State>(() => (loaded.key === key ? loaded : { kind: "loading" }), [loaded, key]);
  useEffect(() => {
    let alive = true;
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(req.q, req.lang, null)
      .then((d) => {
        if (!alive) return;
        if (!d.enabled || !d.provider) setState({ kind: "disabled", key });
        else setState({ kind: "ready", provider: d.provider, items: d.results, next: d.next, pages: 1, more: false, key });
      })
      .catch(() => alive && setState({ kind: "error", key }));
    return () => {
      alive = false;
    };
  }, [req, key, fetchPage]);

  const loadMore = useCallback(async () => {
    if (state.kind !== "ready" || !state.next || state.pages >= MAX_PAGES || loadingMore.current) return;
    loadingMore.current = true;
    setState({ ...state, more: true });
    try {
      const d = await fetchPage(req.q, req.lang, state.next);
      setState((s) => {
        if (s.kind !== "ready") return s;
        if (!d.enabled) return { ...s, next: null, more: false };
        const seen = new Set(s.items.map((g) => g.id));
        return { ...s, items: [...s.items, ...d.results.filter((g) => !seen.has(g.id))], next: d.next, pages: s.pages + 1, more: false };
      });
    } catch {
      setState((s) => (s.kind === "ready" ? { ...s, next: null, more: false } : s));
    } finally {
      loadingMore.current = false;
    }
  }, [state, req, fetchPage]);

  // tải trang sau khi còn cách cuối ~600px
  useEffect(() => {
    const root = scrollRef.current;
    const el = sentinelRef.current;
    if (!root || !el || state.kind !== "ready" || !state.next) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && loadMore(), { root, rootMargin: "0px 0px 600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [state, loadMore]);

  // số cột theo độ rộng bảng
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCols(e.contentRect.width >= 600 ? 3 : 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    const out: { items: GifItem[]; h: number }[] = Array.from({ length: cols }, () => ({ items: [], h: 0 }));
    if (state.kind === "ready")
      for (const g of state.items) {
        const c = out.reduce((a, b) => (b.h < a.h ? b : a));
        c.items.push(g);
        c.h += g.h / g.w;
      }
    return out;
  }, [state, cols]);

  const send = (g: GifItem) => {
    onSend(g);
    setRecent(pushGifRecent(userId, g));
  };
  const providerName = state.kind === "ready" && state.provider === "tenor" ? "Tenor" : "GIPHY";
  const disabled = state.kind === "disabled";

  return (
    <div className="pn-gif flex min-h-0 flex-1 flex-col">
      {!disabled && (
        <div className="px-3 pt-2">
          <label className="pn-stk-search">
            <Search className="h-4 w-4 flex-shrink-0 text-[#a69ba4]" aria-hidden />
            <input
              value={input}
              onChange={(e) => {
                typed.current = true;
                setInput(e.target.value);
              }}
              placeholder={providerName === "Tenor" ? tr("Tìm trên Tenor", "Search Tenor") : tr("Tìm trên GIPHY", "Search GIPHY")}
              aria-label={providerName === "Tenor" ? tr("Tìm trên Tenor", "Search Tenor") : tr("Tìm trên GIPHY", "Search GIPHY")}
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-base text-[#f7eef3] placeholder-[#a69ba4] focus:outline-none sm:text-sm"
            />
            {state.kind === "loading" && <Loader2 className="h-4 w-4 animate-spin text-[#a69ba4]" aria-hidden />}
            {input && (
              <button
                type="button"
                onClick={() => {
                  typed.current = true;
                  setInput("");
                }}
                aria-label={tr("Xoá", "Clear")}
                className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          {/* Ghi công nhà cung cấp: góc phải, ngay dưới ô tìm, luôn hiện khi có kết quả */}
          <div className="flex h-4 items-center justify-end pr-1 pt-1">
            {state.kind === "ready" && state.items.length > 0 && (
              <span className="pn-gif-powered" data-testid="gif-attribution">Powered by {providerName}</span>
            )}
          </div>
          <div className="mt-1 flex items-center">
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {CHIPS().map(([labelText, term]) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    typed.current = false;
                    setInput(labelText);
                    setReq({ q: term, lang: "en" });
                  }}
                  aria-pressed={req.q === term}
                  className="pn-gif-chip"
                >
                  {labelText}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="pn-gif-scroll custom-scrollbar">
        {disabled ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center" data-testid="gif-disabled">
            <p className="text-[14px] text-[#c0b2bc]">{tr("Hiện chưa dùng được GIF.", "GIFs aren't available right now.")}</p>
            <button type="button" onClick={onStickers} className="pn-stk-ghost">
              {tr("Gửi nhãn dán", "Send a sticker")}
            </button>
          </div>
        ) : state.kind === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <p className="text-[14px] text-[#c0b2bc]">{tr("Không tải được GIF.", "Couldn't load GIFs.")}</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)} className="pn-stk-ghost">
              <RefreshCw className="h-4 w-4" aria-hidden />
              {tr("Thử lại", "Retry")}
            </button>
          </div>
        ) : state.kind === "loading" ? (
          <div className="pn-gif-cols" aria-hidden style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex flex-col gap-1.5">
                {[0.75, 1, 0.6, 0.9].map((r, i) => (
                  <div key={i} className="skeleton rounded-xl" style={{ aspectRatio: String(1 / r) }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            {!req.q && recent.length > 0 && (
              <div className="mb-2">
                <p className="pn-stk-head !static !bg-transparent">{tr("Gần đây", "Recent")}</p>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-0.5">
                  {recent.map((g) => (
                    <button key={g.id} type="button" onClick={() => send(g)} aria-label={g.title || "GIF"} className="pn-gif-tile h-20 flex-shrink-0" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.preview} alt="" loading="lazy" decoding="async" {...(corsSafeGif(g.preview) ? { crossOrigin: "anonymous" as const } : {})} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {state.items.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#c0b2bc]">{tr("Không tìm thấy GIF nào", "No GIFs found")}</p>
            ) : (
              <div className="pn-gif-cols" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {columns.map((c, ci) => (
                  <div key={ci} className="flex min-w-0 flex-col gap-1.5">
                    {c.items.map((g) => (
                      <button key={g.id} type="button" onClick={() => send(g)} aria-label={g.title || "GIF"} className="pn-gif-tile w-full" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.preview} alt="GIF" loading="lazy" decoding="async" {...(corsSafeGif(g.preview) ? { crossOrigin: "anonymous" as const } : {})} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div ref={sentinelRef} className="h-px" />
            {state.more && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#a69ba4]" aria-label={tr("Đang tải", "Loading")} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
