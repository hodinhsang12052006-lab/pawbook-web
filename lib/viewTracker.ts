"use client";

// Ghi nhận lượt xem THẬT cho bài đăng và tin tuyển: chỉ tính khi phần tử hiện
// ≥60% trên màn hình liên tục ≥1 giây, mỗi mục 1 lần/ngày/thiết bị; gom thành
// 1 request mỗi vài giây (và gửi nốt khi rời trang) để không spam server.
const VISIBLE_RATIO = 0.6;
const DWELL_MS = 1000;
const FLUSH_MS = 4000;

type Kind = "post" | "job";
const CONFIG: Record<Kind, { endpoint: string; storeKey: string }> = {
  post: { endpoint: "/api/posts/views", storeKey: "pn_viewed_posts" },
  job: { endpoint: "/api/jobs/track", storeKey: "pn_viewed_jobs" },
};

const today = () => new Date().toISOString().slice(0, 10);

function loadSeen(storeKey: string): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey) || "{}") as Record<string, string>;
    const t = today();
    // Chỉ giữ mục của hôm nay — tự dọn dẹp.
    return Object.fromEntries(Object.entries(raw).filter(([, d]) => d === t));
  } catch {
    return {};
  }
}

let observer: IntersectionObserver | null = null;
const timers = new Map<Element, ReturnType<typeof setTimeout>>();
const targetOf = new WeakMap<Element, { id: string; kind: Kind }>();
const queues: Record<Kind, Set<string>> = { post: new Set(), job: new Set() };
const seen: Partial<Record<Kind, Record<string, string>>> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(useBeacon = false) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  for (const kind of Object.keys(queues) as Kind[]) {
    const queue = queues[kind];
    if (queue.size === 0) continue;
    const ids = Array.from(queue);
    queue.clear();
    const body = JSON.stringify({ ids });
    const { endpoint } = CONFIG[kind];
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    } else {
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }
}

function markViewed(kind: Kind, id: string) {
  const store = (seen[kind] ??= loadSeen(CONFIG[kind].storeKey));
  if (store[id]) return;
  store[id] = today();
  try {
    localStorage.setItem(CONFIG[kind].storeKey, JSON.stringify(store));
  } catch {}
  queues[kind].add(id);
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_MS);
}

function ensureObserver() {
  if (observer || typeof window === "undefined" || !("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = targetOf.get(entry.target);
        if (!target) continue;
        if (entry.intersectionRatio >= VISIBLE_RATIO) {
          if (!timers.has(entry.target)) {
            timers.set(entry.target, setTimeout(() => {
              timers.delete(entry.target);
              markViewed(target.kind, target.id);
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

function track(el: Element | null, id: string, kind: Kind): () => void {
  if (!el) return () => {};
  ensureObserver();
  if (!observer) return () => {};
  targetOf.set(el, { id, kind });
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    clearTimeout(timers.get(el));
    timers.delete(el);
  };
}

/** Theo dõi 1 phần tử bài đăng. Trả về hàm huỷ theo dõi. */
export const trackPostView = (el: Element | null, postId: string) => track(el, postId, "post");
/** Theo dõi 1 thẻ / trang tin tuyển. Trả về hàm huỷ theo dõi. */
export const trackJobView = (el: Element | null, jobId: string) => track(el, jobId, "job");

/** Người xem bấm Gọi / Nhắn tin trên 1 tin — tín hiệu "nhiều người đang liên hệ". */
export function trackJobContact(jobId: string) {
  const body = JSON.stringify({ contact: jobId });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/jobs/track", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {}
  fetch("/api/jobs/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
