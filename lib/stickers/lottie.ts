// Phát hình động sticker Noto (lottie.json, CC BY 4.0) bằng lottie-web bản "light" (chỉ SVG, không eval biểu thức).
// Thư viện (~47 KB gzip) chỉ tải ĐỘNG khi lần đầu cần phát (mở tab Nhãn dán / sticker trong tin hiện ra) — không vào
// bundle chung. JSON tải qua fetch CORS (gstatic gửi Access-Control-Allow-Origin: *) → service worker cache được
// (quy tắc pn-stickers, next.config.ts) và nằm trong connect-src của CSP.
import type { AnimationItem, LottiePlayer } from "lottie-web";

/** Có nên chạy hình động: tắt khi giảm chuyển động, tiết kiệm dữ liệu, mạng 2G. */
export function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || c?.effectiveType === "2g" || c?.effectiveType === "slow-2g") return false;
  return true;
}

let libPromise: Promise<LottiePlayer> | null = null;
export function loadLottie(): Promise<LottiePlayer> {
  if (!libPromise)
    libPromise = import("lottie-web/build/player/lottie_light")
      .then((m) => ((m as unknown as { default?: LottiePlayer }).default ?? (m as unknown as LottiePlayer)))
      .catch((e) => {
        libPromise = null;
        throw e;
      });
  return libPromise;
}

// JSON dạng chữ (mỗi lần phát JSON.parse lại: lottie-web sửa trực tiếp object dữ liệu). Giữ tối đa 60 file gần nhất.
const texts = new Map<string, Promise<string>>();
const MAX_TEXTS = 60;
export function fetchLottieText(url: string): Promise<string> {
  const hit = texts.get(url);
  if (hit) {
    texts.delete(url);
    texts.set(url, hit);
    return hit;
  }
  const p = fetch(url, { mode: "cors", credentials: "omit" }).then((r) => {
    if (!r.ok) throw new Error(`lottie ${r.status}`);
    return r.text();
  });
  p.catch(() => texts.delete(url));
  texts.set(url, p);
  while (texts.size > MAX_TEXTS) texts.delete(texts.keys().next().value as string);
  return p;
}

/**
 * Phát 1 hình động vào `container` (SVG). loops: số lượt rồi tự huỷ (gọi onDone) — "infinite" = lặp tới khi huỷ.
 * Trả về hàm huỷ. onReady: khung đầu đã vẽ (ẩn ảnh tĩnh lúc này để không nháy trắng).
 */
export function playLottie(
  container: HTMLElement,
  url: string,
  opts: { loops: number | "infinite"; onReady?: () => void; onDone?: () => void; onError?: () => void }
): () => void {
  let anim: AnimationItem | null = null;
  let cancelled = false;
  let played = 0;
  Promise.all([loadLottie(), fetchLottieText(url)])
    .then(([lottie, text]) => {
      if (cancelled) return;
      anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: opts.loops === "infinite",
        autoplay: true,
        animationData: JSON.parse(text),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: false },
      });
      anim.addEventListener("DOMLoaded", () => !cancelled && opts.onReady?.());
      anim.addEventListener("complete", () => {
        if (cancelled || !anim) return;
        played++;
        if (opts.loops !== "infinite" && played < opts.loops) anim.goToAndPlay(0, true);
        else {
          stop();
          opts.onDone?.();
        }
      });
    })
    .catch(() => {
      if (!cancelled) opts.onError?.();
    });
  function stop() {
    cancelled = true;
    try {
      anim?.destroy();
    } catch {}
    anim = null;
    container.replaceChildren();
  }
  return stop;
}

/** Giới hạn số hình động chạy cùng lúc: xin chỗ (start được gọi khi có chỗ), trả lại chỗ khi xong / huỷ. */
export function makeSlots(max: number) {
  const active = new Set<string>();
  const queue = new Map<string, () => void>();
  const release = (key: string) => {
    queue.delete(key);
    if (!active.delete(key)) return;
    for (const [k, start] of queue) {
      if (active.size >= max) break;
      queue.delete(k);
      active.add(k);
      start();
    }
  };
  return {
    request(key: string, start: () => void): () => void {
      if (!active.has(key)) {
        if (active.size < max) {
          active.add(key);
          start();
        } else queue.set(key, start);
      }
      return () => release(key);
    },
    release,
    get size() {
      return active.size;
    },
  };
}
export type Slots = ReturnType<typeof makeSlots>;
