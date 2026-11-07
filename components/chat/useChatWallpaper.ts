"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DIM_DEFAULT, WP_EVENT, parseWpState, photoIdOf, photoRender, presetRender, readWpRaw, type WpRender, type WpState } from "@/lib/chatWallpapers";
import { getLocalImage } from "@/lib/localImageStore";

// Đọc lựa chọn hình nền ĐỒNG BỘ (useSyncExternalStore) → mở chat là đúng nền ngay khung hình đầu (không còn
// nháy nền mặc định rồi mới đổi). Máy chủ: "default". Đổi ở tab khác (sự kiện storage) hoặc trong app (pn-wp-change)
// → tự cập nhật.
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(WP_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(WP_EVENT, cb);
  };
}

export function useWpState(uid: string | null | undefined): WpState {
  const raw = useSyncExternalStore(
    subscribe,
    () => (uid ? readWpRaw(uid) : null),
    () => null
  );
  return useMemo(() => parseWpState(raw), [raw]);
}

// objectURL của ảnh nền trong IndexedDB — nhớ trong phiên (mở lại chat không phải đọc lại đĩa).
const urlCache = new Map<string, string>();
export function cachePhotoUrl(uid: string, id: string, blob: Blob): string {
  const k = `${uid}:${id}`;
  const old = urlCache.get(k);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(blob);
  urlCache.set(k, url);
  return url;
}
export const cachedPhotoUrl = (uid: string, id: string) => urlCache.get(`${uid}:${id}`) ?? null;

export function usePhotoUrl(uid: string | null | undefined, id: string | null): string | null {
  const [, bump] = useState(0);
  const cached = uid && id ? cachedPhotoUrl(uid, id) : null;
  useEffect(() => {
    if (!uid || !id || cachedPhotoUrl(uid, id)) return;
    let alive = true;
    getLocalImage(uid, id).then((b) => {
      if (!alive || !b) return;
      cachePhotoUrl(uid, id, b);
      bump((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [uid, id]);
  return cached;
}

/** Nền cần vẽ cho 1 lựa chọn (nền có sẵn, hoặc ảnh của bạn + độ tối). */
export function useWallpaperRender(uid: string | null | undefined, state: WpState, choice: string): WpRender {
  const pid = photoIdOf(choice);
  const url = usePhotoUrl(uid, pid);
  return useMemo(() => (pid ? photoRender(url, state.photos?.[pid]?.dim ?? DIM_DEFAULT) : presetRender(choice)), [pid, url, state.photos, choice]);
}
