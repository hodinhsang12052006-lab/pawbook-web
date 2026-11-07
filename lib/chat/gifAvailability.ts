// GIF có dùng được không (máy chủ có GIPHY_API_KEY / TENOR_API_KEY hợp lệ). Hỏi /api/gifs?probe=1 MỘT lần mỗi phiên
// (không gọi nhà cung cấp), nhớ trong sessionStorage "pn_gif_on". Tab GIF trả về enabled:false (thiếu khoá / khoá sai)
// → tắt ngay cho cả phiên. Khi tắt: không có tab GIF, không có mục GIF ở menu "+", không có nút "Tìm GIF …".
import { useSyncExternalStore } from "react";

const KEY = "pn_gif_on";
type State = boolean | null; // null = chưa biết

let state: State = null;
let loaded = false;
let probing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const v = sessionStorage.getItem(KEY);
      state = v === "1" ? true : v === "0" ? false : null;
    } catch {}
  }
  return state;
}

export function setGifEnabled(v: boolean) {
  read();
  if (state === v) return;
  state = v;
  try {
    sessionStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

/** Hỏi máy chủ (1 lần / phiên). Lỗi mạng → coi như tắt cho lần này nhưng KHÔNG nhớ (lần mở bảng sau hỏi lại). */
export function probeGifs(): Promise<boolean> {
  const known = read();
  if (known !== null) return Promise.resolve(known);
  if (!probing)
    probing = fetch("/api/gifs?probe=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean } | null) => {
        if (d && typeof d.enabled === "boolean") setGifEnabled(d.enabled);
        return d?.enabled === true;
      })
      .catch(() => false)
      .finally(() => {
        probing = null;
      });
  return probing;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** true = dùng được · false = tắt · null = chưa biết (đang hỏi). */
export function useGifEnabled(): State {
  return useSyncExternalStore(subscribe, read, () => null);
}
