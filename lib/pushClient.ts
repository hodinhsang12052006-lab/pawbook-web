"use client";

// Phía trình duyệt của thông báo đẩy (xem lib/push.ts + worker/index.js).
// Trong app native (Capacitor) tự chuyển sang Firebase — lib/nativePush.ts.
import { isNativeApp, nativeDisable, nativeEnable, nativeGetState } from "@/lib/nativePush";

export type PushState = "unsupported" | "ios-needs-install" | "denied" | "on" | "off";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isNativeApp()) return nativeGetState().catch(() => "unsupported" as PushState);
  if (!PUBLIC_KEY) return "unsupported";
  // iPhone chỉ nhận Web Push khi PawNail đã được "Thêm vào màn hình chính".
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Xin quyền + đăng ký + lưu lên máy chủ. Trả về trạng thái mới. */
export async function enablePush(): Promise<PushState> {
  if (isNativeApp()) return nativeEnable().catch(() => "off" as PushState);
  const state = await getPushState();
  if (state === "unsupported" || state === "ios-needs-install" || state === "denied") return state;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) });
  }
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok ? "on" : "off";
}

export async function disablePush(): Promise<PushState> {
  if (isNativeApp()) return nativeDisable();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
  } catch {}
  return getPushState();
}
