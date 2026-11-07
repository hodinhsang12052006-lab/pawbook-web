"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { Clock, Search, Star, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { marketSpelling } from "@/lib/i18n/spelling";
import { ANIM_PACKS, THREE_D_PACKS, type StickerId, type StickerPack } from "@/lib/stickers/catalog";
import { activeSeasonPacks, type StickerMarket } from "@/lib/stickers/seasons";
import { isFluent, lottieUrl, stickerGlyph, thumbUrl } from "@/lib/stickers/urls";
import { clearRecentStickers, pushRecentSticker, readStickerStore, removeRecentSticker, toggleFavoriteSticker, type StickerStore } from "@/lib/stickers/store";
import { searchStickers } from "@/lib/stickers/search";
import { isExtFluentId, loadFullStickerManifest, loadStickerManifest, type Manifest, type StickerMeta } from "@/lib/stickers/manifest";
import { canAnimate, loadLottie, makeSlots, type Slots } from "@/lib/stickers/lottie";
import StickerPeek from "./StickerPeek";
import LottieLayer from "./LottieLayer";
import { CS } from "@/lib/i18n/chatStrings";

// Tab "Nhãn dán": ô tìm · thanh bộ (Gần đây ⭐ Yêu thích · bộ theo mùa · 10 bộ hoạt hình Noto | 6 bộ 3D Fluent) ·
// MỘT vùng cuộn liền chia mục (tiêu đề dính) · dòng ghi công ở cuối. Bấm = gửi ngay, bảng VẪN MỞ (như Telegram);
// nhấn giữ 350ms / chuột phải / Shift+Enter = xem trước + Yêu thích (+ Bỏ khỏi Gần đây).
// Ảnh tĩnh: <img> thường + kích thước cố định; chỉ gắn src khi ô sắp hiện trong VÙNG CUỘN của bảng (lần mở đầu ≤ 30 ảnh).
// Hình động (Noto lottie.json + lottie-web light, tải động): ô trong "Gần đây" + mục đang xem tự chạy 2 lượt rồi đứng,
// tối đa 12 ô cùng lúc, chỉ khi ô nằm trong khung cuộn; tắt khi giảm chuyển động / tiết kiệm dữ liệu / 2G (canAnimate).
// Manifest (tên + từ khoá EN/VI) tải động khi mở tab; phần mở rộng (mọi Fluent 3D) khi bắt đầu tìm.
// ~770 sticker trong ~18 mục, mỗi mục chia khối 30 ô (bội số của 5 và 6 cột → các khối nối liền, không hở hàng): chỉ ~30 ô
// đầu dựng thật ngay; khối khác là lưới ô rỗng CÙNG KÍCH THƯỚC cho tới khi tới gần khung cuộn (400px) → mở tab / đổi bộ nhanh,
// 2 IntersectionObserver của ô chỉ theo dõi ô đã dựng.

const CELL = 76; // chiều cao ô ~ (rộng bảng / 5 cột) — dùng cho contain-intrinsic-size
const MAX_PLAYING = 12;
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "");

// Gắn src cho ảnh khi phần tử vào gần khung nhìn của 1 vùng cuộn (1 IntersectionObserver dùng chung cho mọi ô).
type Observe = (el: Element, onNear: () => void) => () => void;
const NearContext = React.createContext<{ grid: Observe | null; bar: Observe | null; sec: Observe | null }>({ grid: null, bar: null, sec: null });
const CHUNK = 30; // ô / khối lưới dựng một lần
const EAGER_ITEMS = 30; // khối đầu dựng ngay (không chớp khung giữ chỗ lúc mở)
const chunksOf = (items: StickerId[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));
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
function useNear(kind: "grid" | "bar" | "sec") {
  const observe = React.useContext(NearContext)[kind];
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(!observe);
  useEffect(() => {
    if (!observe || !ref.current || near) return;
    return observe(ref.current, () => setNear(true));
  }, [observe, near]);
  return [ref, near] as const;
}

// Hình động: ô có đang nằm trong khung cuộn (≥ 60%) không — theo dõi CẢ 2 chiều (ra khỏi khung → dừng phát).
type Watch = (el: Element, cb: (visible: boolean) => void) => () => void;
interface Anim {
  enabled: boolean;
  slots: Slots;
  watch: Watch | null;
}
const AnimContext = React.createContext<Anim>({ enabled: false, slots: makeSlots(0), watch: null });
function useVisibleWatcher(rootRef: React.RefObject<HTMLElement | null>, on: boolean): Watch | null {
  const [watch, setWatch] = useState<Watch | null>(null);
  useEffect(() => {
    if (!on || typeof IntersectionObserver === "undefined") return;
    const cbs = new Map<Element, (v: boolean) => void>();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => cbs.get(e.target)?.(e.isIntersecting)), { root: rootRef.current, threshold: 0.6 });
    setWatch(() => (el: Element, cb: (v: boolean) => void) => {
      cbs.set(el, cb);
      io.observe(el);
      return () => {
        cbs.delete(el);
        io.unobserve(el);
      };
    });
    return () => {
      io.disconnect();
      setWatch(null);
    };
  }, [rootRef, on]);
  return watch;
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
  /** Chỉ truyền khi GIF dùng được (có khoá GIPHY / Tenor) — không thì không có nút "Tìm GIF …" */
  onSearchGif?: (q: string) => void;
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
  const secNear = useNearObserver(scrollRef, "400px 0px 400px 0px");
  const near = useMemo(() => ({ grid: gridNear, bar: barNear, sec: secNear }), [gridNear, barNear, secNear]);
  const [animOn] = useState(() => canAnimate());
  const slots = useMemo(() => makeSlots(MAX_PLAYING), []);
  const watch = useVisibleWatcher(scrollRef, animOn);
  const anim = useMemo<Anim>(() => ({ enabled: animOn, slots, watch }), [animOn, slots, watch]);

  // Cần manifest mở rộng (mọi Fluent 3D): đang tìm, hoặc Gần đây / Yêu thích có sticker Fluent ngoài bộ
  const needFull = !!query || store.r.some(isExtFluentId) || store.f.some(isExtFluentId);
  useEffect(() => {
    let alive = true;
    (needFull ? loadFullStickerManifest() : loadStickerManifest()).then((m) => alive && setManifest(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [needFull]);
  useEffect(() => {
    try {
      preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
      preconnect("https://cdn.jsdelivr.net", { crossOrigin: "anonymous" });
    } catch {}
    if (animOn) loadLottie().catch(() => {});
  }, [animOn]);
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

  // Tên hiển thị: tiếng Việt = tên CLDR tiếng Việt (không có thì để trống, KHÔNG hiện tiếng Anh); tiếng Anh = tên CLDR.
  const nameOf = useCallback(
    (id: StickerId) => {
      const m = manifest?.[id];
      return m ? tr(cap(m.vi[0] ?? ""), cap(m.en[0] ?? "")) : "";
    },
    [manifest]
  );

  const results = useMemo(() => (query && manifest ? searchStickers(query, manifest) : null), [query, manifest]);
  // Khối dựng ngay ("<mục>:<khối>"): Gần đây / Yêu thích luôn dựng; các bộ thì tới khi đủ EAGER_ITEMS ô
  const eager = useMemo(() => {
    const out = new Set<string>();
    let n = 0;
    for (const s of sections) {
      if (s.key === "recent" || s.key === "fav") continue;
      for (const [ci, part] of chunksOf(s.items).entries()) {
        if (n >= EAGER_ITEMS) return out;
        out.add(`${s.key}:${ci}`);
        n += part.length;
      }
    }
    return out;
  }, [sections]);

  // Theo dõi mục đang xem (IntersectionObserver trong vùng cuộn) → gạch chân icon bộ + mục được tự chạy hình động
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
      // xa (> 3 khung) → nhảy thẳng: cuộn mượt qua cả chục bộ sẽ dựng hết các bộ giữa đường (giật trên máy yếu)
      const far = !!root && !!el && Math.abs(el.offsetTop - root.scrollTop) > root.clientHeight * 3;
      if (root && el) root.scrollTo({ top: el.offsetTop, behavior: reducedMotion() || far ? "auto" : "smooth" });
      // nhảy thẳng: các mục quanh đích vừa dựng / vừa được vẽ (content-visibility) có thể đổi chiều cao ước lượng → căn lại
      if (root && el && (far || reducedMotion()))
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (Math.abs(root.scrollTop - el.offsetTop) > 1) root.scrollTop = el.offsetTop;
        }));
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

  const grid = (items: StickerId[], keyPrefix: string, eligible: boolean) => (
    <div className="pn-stk-grid">
      {items.map((id) => (
        <StickerCell key={`${keyPrefix}-${id}`} slotKey={`${keyPrefix}-${id}`} id={id} name={nameOf(id)} meta={manifest?.[id] ?? null} eligible={eligible} onSend={send} onPeek={setPeek} />
      ))}
    </div>
  );

  return (
    <NearContext.Provider value={near}>
      <AnimContext.Provider value={anim}>
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

          {/* (2) Thanh bộ — icon, cuộn ngang; luôn gắn (ẩn khi đang tìm) để IntersectionObserver của icon giữ khung gốc */}
          <div ref={barRef} hidden={!!results} role="tablist" aria-label={tr("Bộ nhãn dán", "Sticker packs")} className="pn-stk-bar no-scrollbar">
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
                  {s.icon === "recent" ? <Clock className="h-5 w-5" aria-hidden /> : s.icon === "fav" ? <Star className="h-5 w-5" aria-hidden /> : <PackIcon id={s.icon} />}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* (3) Vùng cuộn */}
          <div ref={scrollRef} className="pn-stk-scroll custom-scrollbar" data-testid="sticker-scroll">
            {results ? (
              results.length ? (
                <section className="pn-stk-sec" data-section="results">
                  <h3 className="pn-stk-head">{tr("Kết quả", "Results")}</h3>
                  {grid(results, "q", true)}
                </section>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <p className="text-[14px] text-[#c0b2bc]">{tr(`Không có nhãn dán cho “${query}”`, `No stickers for “${query}”`)}</p>
                  {onSearchGif && (
                    <button type="button" onClick={() => onSearchGif(query)} className="pn-stk-ghost">
                      {tr(`Tìm GIF “${query}”`, `Search GIFs for “${query}”`)}
                    </button>
                  )}
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
                    ref={
                      s.key === "recent"
                        ? (el) => {
                            recentRef.current = el;
                          }
                        : undefined
                    }
                    data-section={s.key}
                    aria-label={s.label}
                    className={`pn-stk-sec ${s.divider ? "pn-stk-sec-3d" : ""}`}
                    style={{ containIntrinsicSize: `auto ${Math.ceil(s.items.length / 5) * CELL + 28}px` }}
                  >
                    <h3 className="pn-stk-head">
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      {s.key === "recent" && (
                        <button type="button" onClick={() => setStore(clearRecentStickers(userId))} className="pn-stk-headbtn" data-testid="sticker-clear-recent">
                          {tr("Xoá", "Clear")}
                        </button>
                      )}
                    </h3>
                    {s.key === "recent" || s.key === "fav"
                      ? grid(s.items, s.key, s.key === "recent" || s.key === active)
                      : chunksOf(s.items).map((part, ci) =>
                          eager.has(`${s.key}:${ci}`) ? (
                            <React.Fragment key={ci}>{grid(part, s.key, s.key === active)}</React.Fragment>
                          ) : (
                            <LazyGrid key={ci} n={part.length} render={() => grid(part, s.key, s.key === active)} />
                          )
                        )}
                  </section>
                ))}
              </>
            )}
            {/* (4) Ghi công (CC BY 4.0 · MIT) — dòng cuối vùng cuộn */}
            <p className="pn-stk-credit" title={CS.stickerCredit()}>
              {tr("Emoji động: ", "Animated emoji: ")}
              <a href="https://googlefonts.github.io/noto-emoji-animation/" target="_blank" rel="noopener noreferrer">
                Noto Emoji Animation
              </a>
              {" (Google) · "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
                CC BY 4.0
              </a>
              {" · "}
              {tr("Emoji 3D: ", "3D emoji: ")}
              <a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noopener noreferrer">
                Microsoft Fluent Emoji
              </a>
              {" · "}
              <a href="https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                MIT
              </a>
            </p>
          </div>

          {peek && (
            <StickerPeek
              id={peek}
              name={nameOf(peek)}
              meta={manifest?.[peek] ?? null}
              market={market}
              favorite={store.f.includes(peek)}
              recent={store.r.includes(peek)}
              onSend={() => {
                send(peek);
                setPeek(null);
              }}
              onToggleFavorite={() => toggleFav(peek)}
              onRemoveRecent={() => {
                setStore(removeRecentSticker(userId, peek));
                setPeek(null);
              }}
              onClose={() => setPeek(null)}
            />
          )}
        </div>
      </AnimContext.Provider>
    </NearContext.Provider>
  );
}

// Mục chưa tới gần khung cuộn: lưới ô rỗng cùng kích thước (vị trí các mục bên dưới + nhảy tới bộ vẫn đúng).
function LazyGrid({ n, render }: { n: number; render: () => React.ReactNode }) {
  const [ref, near] = useNear("sec");
  if (near) return <>{render()}</>;
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="pn-stk-grid" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="pn-stk-cell pn-stk-ph" />
      ))}
    </div>
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
// Hình động: ô được phép (Gần đây / mục đang xem / kết quả tìm) + đang trong khung → xin 1 chỗ (tối đa 12) → chạy 2 lượt
// rồi đứng. Rê chuột (máy tính) → chạy 1 lượt.
const StickerCell = React.memo(function StickerCell({
  id,
  slotKey,
  name,
  meta,
  eligible,
  onSend,
  onPeek,
}: {
  id: StickerId;
  slotKey: string;
  name: string;
  meta: StickerMeta | null;
  eligible: boolean;
  onSend: (id: StickerId) => void;
  onPeek: (id: StickerId) => void;
}) {
  useTr();
  const anim = React.useContext(AnimContext);
  const [hover, setHover] = useState(false);
  const [nearRef, near] = useNear("grid");
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [slot, setSlot] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const thumb = thumbUrl(id, meta);
  const lottie = anim.enabled && !isFluent(id) ? lottieUrl(id, meta) : null;
  const { watch, slots } = anim;

  useEffect(() => {
    if (!lottie || !watch || !nearRef.current) return;
    return watch(nearRef.current, setVisible);
  }, [lottie, watch, nearRef]);
  const want = !!lottie && near && (hover || (eligible && visible && !done));
  useEffect(() => {
    if (!want) return;
    const cancel = slots.request(slotKey, () => setSlot(true));
    return () => {
      cancel();
      setSlot(false);
    };
  }, [want, slots, slotKey]);

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
  const label = name || tr("Nhãn dán", "Sticker");
  return (
    <button
      type="button"
      aria-label={label}
      title={name || undefined}
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
        if (e.pointerType !== "mouse" || !lottie) return;
        hoverTimer.current = setTimeout(() => setHover(true), 200);
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
        <span className="pn-stk-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={nearRef as React.RefObject<HTMLImageElement>}
            src={near ? thumb : undefined}
            alt=""
            width={60}
            height={60}
            decoding="async"
            crossOrigin="anonymous"
            draggable={false}
            onLoad={(e) => e.currentTarget.setAttribute("data-ok", "")}
            className="pn-stk-img"
            style={ready ? { opacity: 0 } : undefined}
          />
          {lottie && (
            <LottieLayer
              url={lottie}
              play={want && slot}
              loops={hover ? 1 : 2}
              onReadyChange={setReady}
              onDone={() => {
                setDone(true);
                slots.release(slotKey);
              }}
            />
          )}
        </span>
      ) : (
        <span className="text-[40px] leading-none">{stickerGlyph(id) ?? meta?.glyph ?? ""}</span>
      )}
    </button>
  );
});
