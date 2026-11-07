"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Clock, Search, Star, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { marketSpelling } from "@/lib/i18n/spelling";
import { ANIM_PACKS, THREE_D_PACKS, type StickerId, type StickerPack } from "@/lib/stickers/packs";
import { activeSeasonPacks, type StickerMarket } from "@/lib/stickers/seasons";
import { animUrl, isFluent, stickerGlyph, thumbUrl } from "@/lib/stickers/urls";
import { pushRecentSticker, readStickerStore, toggleFavoriteSticker, type StickerStore } from "@/lib/stickers/store";
import { searchStickers } from "@/lib/stickers/search";
import type { StickerMeta } from "@/lib/stickers/manifest.generated";
import StickerPeek from "./StickerPeek";
import { CS } from "@/lib/i18n/chatStrings";

// Tab "Nhãn dán": ô tìm · thanh bộ (Gần đây ⭐ Yêu thích · bộ theo mùa · 6 bộ hoạt hình Noto | 6 bộ 3D Fluent) ·
// MỘT vùng cuộn liền chia mục (tiêu đề dính) · dòng ghi công ở cuối. Bấm = gửi ngay, bảng VẪN MỞ (như Telegram);
// nhấn giữ 350ms / chuột phải / Shift+Enter = xem trước + Yêu thích. Manifest từ khoá chỉ tải (import động) khi mở bảng.
// Ảnh: <img> thường + width/height cố định (không nhảy bố cục). Chỉ gắn src khi ô sắp hiện trong VÙNG CUỘN của bảng
// (IntersectionObserver, lề nửa hàng) — loading=lazy của trình duyệt tính theo cửa sổ với lề ~1250px nên tải cả trăm ảnh;
// lần mở đầu ≤ 30 ảnh nhỏ. Bản động chỉ tải khi rê chuột / xem trước.

type Manifest = Record<StickerId, StickerMeta>;
let manifestPromise: Promise<Manifest> | null = null;
export function loadStickerManifest(): Promise<Manifest> {
  if (!manifestPromise) manifestPromise = import("@/lib/stickers/manifest.generated").then((m) => m.STICKERS).catch((e) => {
    manifestPromise = null;
    throw e;
  });
  return manifestPromise;
}

const CELL = 76; // chiều cao ô ~ (rộng bảng / 5 cột) — dùng cho contain-intrinsic-size
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Gắn src cho ảnh khi phần tử vào gần khung nhìn của 1 vùng cuộn (1 IntersectionObserver dùng chung cho mọi ô).
type Observe = (el: Element, onNear: () => void) => () => void;
const NearContext = React.createContext<{ grid: Observe | null; bar: Observe | null }>({ grid: null, bar: null });
function useNearObserver(rootRef: React.RefObject<HTMLElement | null>, rootMargin: string): Observe {
  const io = useRef<IntersectionObserver | null>(null);
  const cbs = useRef(new Map<Element, () => void>());
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          cbs.current.get(e.target)?.();
          cbs.current.delete(e.target);
          obs.unobserve(e.target);
        }
      },
      { root: rootRef.current, rootMargin }
    );
    io.current = obs;
    cbs.current.forEach((_, el) => obs.observe(el));
    return () => {
      obs.disconnect();
      io.current = null;
    };
  }, [rootRef, rootMargin]);
  return useCallback((el: Element, onNear: () => void) => {
    cbs.current.set(el, onNear);
    io.current?.observe(el);
    return () => {
      cbs.current.delete(el);
      io.current?.unobserve(el);
    };
  }, []);
}
function useNear(kind: "grid" | "bar") {
  const observe = React.useContext(NearContext)[kind];
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(!observe);
  useEffect(() => {
    if (!observe || !ref.current || near) return;
    return observe(ref.current, () => setNear(true));
  }, [observe, near]);
  return [ref, near] as const;
}

interface Section {
  key: string;
  label: string;
  items: StickerId[];
  icon: "recent" | "fav" | StickerId;
  divider?: boolean;
}

export default function StickerTab({
  userId,
  market,
  onSend,
  onSearchGif,
}: {
  userId: string;
  market: StickerMarket;
  onSend: (id: StickerId) => void;
  onSearchGif: (q: string) => void;
}) {
  useTr();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [store, setStore] = useState<StickerStore>(() => (typeof window === "undefined" ? { r: [], f: [] } : readStickerStore(userId)));
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("");
  const [peek, setPeek] = useState<StickerId | null>(null);
  const [favHint, setFavHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const gridNear = useNearObserver(scrollRef, "0px 0px 40px 0px");
  const barNear = useNearObserver(barRef, "0px 40px 0px 0px");
  const near = useMemo(() => ({ grid: gridNear, bar: barNear }), [gridNear, barNear]);

  useEffect(() => {
    let alive = true;
    loadStickerManifest().then((m) => alive && setManifest(m)).catch(() => {});
    try {
      preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
      preconnect("https://cdn.jsdelivr.net", { crossOrigin: "anonymous" });
    } catch {}
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 120);
    return () => clearTimeout(t);
  }, [input]);

  const seasonal = useMemo(() => activeSeasonPacks(new Date(), market), [market]);
  const label = useCallback((p: StickerPack) => tr(p.label[0], p.label[1]), []);
  const favLabel = tr("Yêu thích", marketSpelling("Favorites", market));
  const sections: Section[] = useMemo(() => {
    const out: Section[] = [];
    if (store.r.length) out.push({ key: "recent", label: tr("Gần đây", "Recent"), items: store.r, icon: "recent" });
    if (store.f.length) out.push({ key: "fav", label: favLabel, items: store.f, icon: "fav" });
    for (const p of seasonal) out.push({ key: p.id, label: label(p), items: p.items, icon: p.icon });
    for (const p of ANIM_PACKS) out.push({ key: p.id, label: label(p), items: p.items, icon: p.icon });
    THREE_D_PACKS.forEach((p, i) => out.push({ key: p.id, label: label(p), items: p.items, icon: p.icon, divider: i === 0 }));
    return out;
  }, [store, seasonal, favLabel, label]);

  // Thanh bộ: 🕘 chỉ khi có "Gần đây"; ⭐ luôn có (rỗng → gợi ý cách thêm)
  const barItems = useMemo(() => {
    const out: Section[] = sections.filter((s) => s.key !== "fav");
    const fav: Section = { key: "fav", label: favLabel, items: store.f, icon: "fav" };
    out.splice(store.r.length ? 1 : 0, 0, fav);
    return out;
  }, [sections, store.f, store.r.length, favLabel]);

  const nameOf = useCallback(
    (id: StickerId) => {
      const n = manifest?.[id]?.en[0];
      return n ? n.charAt(0).toUpperCase() + n.slice(1) : tr("Nhãn dán", "Sticker");
    },
    [manifest]
  );

  const results = useMemo(() => (query && manifest ? searchStickers(query, manifest) : null), [query, manifest]);

  // Theo dõi mục đang xem (IntersectionObserver trong vùng cuộn) → gạch chân icon bộ
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || results) return;
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set((e.target as HTMLElement).dataset.section!, e.isIntersecting);
        const first = sections.find((s) => visible.get(s.key));
        if (first) setActive(first.key);
      },
      { root, rootMargin: "0px 0px -80% 0px", threshold: 0 }
    );
    root.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, results]);
  useEffect(() => {
    if (!active) return;
    barRef.current?.querySelector<HTMLElement>(`[data-pack="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  // "Gần đây" đổi kích thước khi gửi (thêm hàng) → giữ nguyên chỗ đang xem bên dưới
  const recentRef = useRef<HTMLElement | null>(null);
  const recentH = useRef(0);
  useLayoutEffect(() => {
    const el = recentRef.current;
    const root = scrollRef.current;
    const h = el?.offsetHeight ?? 0;
    if (root && recentH.current && h !== recentH.current && root.scrollTop > 0) root.scrollTop += h - recentH.current;
    recentH.current = h;
  }, [store.r]);

  const jumpTo = (key: string) => {
    setInput("");
    setQuery("");
    if (key === "fav" && !store.f.length) {
      setFavHint(true);
      scrollRef.current?.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      return;
    }
    setFavHint(false);
    requestAnimationFrame(() => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-section="${key}"]`);
      if (root && el) root.scrollTo({ top: el.offsetTop, behavior: reducedMotion() ? "auto" : "smooth" });
      setActive(key);
    });
  };

  const send = useCallback(
    (id: StickerId) => {
      onSend(id);
      setStore(pushRecentSticker(userId, id));
    },
    [onSend, userId]
  );
  const toggleFav = (id: StickerId) => {
    setStore(toggleFavoriteSticker(userId, id));
    setFavHint(false);
  };

  const grid = (items: StickerId[], keyPrefix: string) => (
    <div className="pn-stk-grid">
      {items.map((id) => (
        <StickerCell key={`${keyPrefix}-${id}`} id={id} name={nameOf(id)} onSend={send} onPeek={setPeek} />
      ))}
    </div>
  );

  return (
    <NearContext.Provider value={near}>
    <div className="pn-stk flex min-h-0 flex-1 flex-col">
      {/* (1) Ô tìm */}
      <div className="px-3 pt-2">
        <label className="pn-stk-search">
          <Search className="h-4 w-4 flex-shrink-0 text-[#a69ba4]" aria-hidden />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr("Tìm nhãn dán", "Search stickers")}
            aria-label={tr("Tìm nhãn dán", "Search stickers")}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base text-[#f7eef3] placeholder-[#a69ba4] focus:outline-none sm:text-sm"
          />
          {input && (
            <button type="button" onClick={() => setInput("")} aria-label={tr("Xoá", "Clear")} className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#c0b2bc] hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </div>

      {/* (2) Thanh bộ — icon, cuộn ngang */}
      {!results && (
        <div ref={barRef} role="tablist" aria-label={tr("Bộ nhãn dán", "Sticker packs")} className="pn-stk-bar no-scrollbar">
          {barItems.map((s) => (
            <React.Fragment key={s.key}>
              {s.divider && <span aria-hidden className="pn-stk-divider" />}
              <button
                type="button"
                role="tab"
                data-pack={s.key}
                aria-selected={active === s.key || (s.key === "fav" && favHint)}
                aria-label={s.label}
                title={s.label}
                onClick={() => jumpTo(s.key)}
                className="pn-stk-packbtn"
              >
                {s.icon === "recent" ? (
                  <Clock className="h-5 w-5" aria-hidden />
                ) : s.icon === "fav" ? (
                  <Star className="h-5 w-5" aria-hidden />
                ) : (
                  <PackIcon id={s.icon} />
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* (3) Vùng cuộn */}
      <div ref={scrollRef} className="pn-stk-scroll custom-scrollbar" data-testid="sticker-scroll">
        {results ? (
          results.length ? (
            <section className="pn-stk-sec" data-section="results">
              <h3 className="pn-stk-head">{tr("Kết quả", "Results")}</h3>
              {grid(results, "q")}
            </section>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-[14px] text-[#c0b2bc]">{tr(`Không có nhãn dán cho “${query}”`, `No stickers for “${query}”`)}</p>
              <button type="button" onClick={() => onSearchGif(query)} className="pn-stk-ghost">
                {tr(`Tìm GIF “${query}”`, `Search GIFs for “${query}”`)}
              </button>
            </div>
          )
        ) : (
          <>
            {favHint && !store.f.length && (
              <p className="mx-3 mt-2 rounded-2xl bg-white/[0.05] px-3 py-2.5 text-[13px] leading-5 text-[#c0b2bc]" role="status">
                <Star className="mr-1.5 inline h-4 w-4 -translate-y-px text-[#e3c48a]" aria-hidden />
                {tr("Nhấn giữ nhãn dán để thêm vào Yêu thích", marketSpelling("Long-press a sticker to add it to Favorites", market))}
              </p>
            )}
            {sections.map((s) => (
              <section
                key={s.key}
                ref={s.key === "recent" ? (el) => { recentRef.current = el; } : undefined}
                data-section={s.key}
                aria-label={s.label}
                className={`pn-stk-sec ${s.divider ? "pn-stk-sec-3d" : ""}`}
                style={{ containIntrinsicSize: `auto ${Math.ceil(s.items.length / 5) * CELL + 28}px` }}
              >
                <h3 className="pn-stk-head">{s.label}</h3>
                {grid(s.items, s.key)}
              </section>
            ))}
          </>
        )}
        {/* (4) Ghi công (CC BY 4.0 · MIT) — dòng cuối vùng cuộn */}
        <p className="pn-stk-credit" title={CS.stickerCredit()}>
          {tr("Emoji động: ", "Animated emoji: ")}
          <a href="https://googlefonts.github.io/noto-emoji-animation/" target="_blank" rel="noopener noreferrer">Noto Emoji Animation</a>
          {" (Google) · CC BY 4.0 · "}
          {tr("Emoji 3D: ", "3D emoji: ")}
          <a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noopener noreferrer">Microsoft Fluent Emoji</a>
          {" · MIT"}
        </p>
      </div>

      {peek && (
        <StickerPeek
          id={peek}
          name={nameOf(peek)}
          market={market}
          favorite={store.f.includes(peek)}
          onSend={() => {
            send(peek);
            setPeek(null);
          }}
          onToggleFavorite={() => toggleFav(peek)}
          onClose={() => setPeek(null)}
        />
      )}
    </div>
    </NearContext.Provider>
  );
}

function PackIcon({ id }: { id: StickerId }) {
  const [ref, near] = useNear("bar");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref as React.RefObject<HTMLImageElement>}
      src={near ? thumbUrl(id) ?? undefined : undefined}
      alt=""
      width={26}
      height={26}
      decoding="async"
      crossOrigin="anonymous"
      draggable={false}
      className="h-[26px] w-[26px]"
    />
  );
}

// Một ô sticker. Chạm = gửi. Nhấn giữ 350ms (lệch > 8px thì huỷ) / chuột phải / Shift+Enter = xem trước.
// Rê chuột 250ms (máy tính) → ảnh Noto chuyển sang bản động.
const StickerCell = React.memo(function StickerCell({ id, name, onSend, onPeek }: { id: StickerId; name: string; onSend: (id: StickerId) => void; onPeek: (id: StickerId) => void }) {
  const [hover, setHover] = useState(false);
  const [nearRef, near] = useNear("grid");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const thumb = thumbUrl(id);
  const anim = !isFluent(id) ? animUrl(id) : null;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clear();
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    []
  );
  const open = () => {
    longPressed.current = true;
    onPeek(id);
    try {
      navigator.vibrate?.(8);
    } catch {}
  };
  return (
    <button
      type="button"
      aria-label={name}
      title={name}
      data-sticker={id}
      className="pn-stk-cell"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        longPressed.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(open, 350);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && timer.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
      }}
      onPointerUp={(e) => {
        clear();
        start.current = null;
        if (!longPressed.current) return;
        // nhấn giữ → trượt tới nút trong bảng xem trước → thả = chọn nút đó
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const action = el?.closest<HTMLButtonElement>("[data-peek-action]");
        if (action) action.click();
      }}
      onPointerCancel={() => {
        clear();
        start.current = null;
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !anim || reducedMotion()) return;
        hoverTimer.current = setTimeout(() => setHover(true), 250);
      }}
      onPointerLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHover(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!longPressed.current) open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          onPeek(id);
        }
      }}
      onClick={(e) => {
        if (longPressed.current) {
          e.preventDefault();
          longPressed.current = false;
          return;
        }
        onSend(id);
      }}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={nearRef as React.RefObject<HTMLImageElement>}
          src={near ? (hover && anim ? anim : thumb) : undefined}
          alt=""
          width={60}
          height={60}
          decoding="async"
          crossOrigin="anonymous"
          draggable={false}
          onLoad={(e) => e.currentTarget.setAttribute("data-ok", "")}
          className="pn-stk-img"
        />
      ) : (
        <span className="text-[40px] leading-none">{stickerGlyph(id) ?? ""}</span>
      )}
    </button>
  );
});
