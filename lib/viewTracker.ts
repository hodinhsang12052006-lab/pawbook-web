"use client";

// Ghi nhận lượt xem THẬT cho bài đăng: chỉ tính khi bài hiện ≥60% trên màn
// hình liên tục ≥1 giây, mỗi bài 1 lần/ngày/thiết bị; gom thành 1 request mỗi
// vài giây (và gửi nốt khi rời trang) để không spam server.
const VISIBLE_RATIO = 0.6;
const DWELL_MS = 1000;
const FLUSH_MS = 4000;
const STORE_KEY = "pn_viewed_posts";

const today = () => new Date().toISOString().slice(0, 10);

function loadSeen(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as Record<string, string>;
    const t = today();
    // Chỉ giữ mục của hôm nay — tự dọn dẹp.
    return Object.fromEntries(Object.entries(raw).filter(([, d]) => d === t));
  } catch {
    return {};
  }
}

let observer: IntersectionObserver | null = null;
const timers = new Map<Element, ReturnType<typeof setTimeout>>();
const idOf = new WeakMap<Element, string>();
const queue = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let seen: Record<string, string> | null = null;

function flush(useBeacon = false) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (queue.size === 0) return;
  const ids = Array.from(queue);
  queue.clear();
  const body = JSON.stringify({ ids });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/posts/views", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/posts/views", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

function markViewed(id: string) {
  if (!seen) seen = loadSeen();
  if (seen[id]) return;
  seen[id] = today();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(seen));
  } catch {}
  queue.add(id);
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_MS);
}

function ensureObserver() {
  if (observer || typeof window === "undefined" || !("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = idOf.get(entry.target);
        if (!id) continue;
        if (entry.intersectionRatio >= VISIBLE_RATIO) {
          if (!timers.has(entry.target)) {
            timers.set(entry.target, setTimeout(() => {
              timers.delete(entry.target);
              markViewed(id);
            }, DWELL_MS));
          }
        } else {
          clearTimeout(timers.get(entry.target));
          timers.delete(entry.target);
        }
      }
    },
    { threshold: [0, VISIBLE_RATIO, 1] }
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

/** Ref callback: theo dõi 1 phần tử bài đăng. Trả về hàm huỷ theo dõi. */
export function trackPostView(el: Element | null, postId: string): () => void {
  if (!el) return () => {};
  ensureObserver();
  if (!observer) return () => {};
  idOf.set(el, postId);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    clearTimeout(timers.get(el));
    timers.delete(el);
  };
}
