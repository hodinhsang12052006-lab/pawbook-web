"use client";

// Phía trình duyệt của thông báo đẩy (xem lib/push.ts + worker/index.js).
// Trong app native (Capacitor) tự chuyển sang Firebase — lib/nativePush.ts.
import { isNativeApp, nativeDisable, nativeEnable, nativeGetState, releaseNativePush } from "@/lib/nativePush";

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
  try {
    localStorage.removeItem("pn_web_push_off");
  } catch {}
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
    localStorage.setItem("pn_web_push_off", "1"); // autoEnableWebPush (cuối file) không tự bật lại
  } catch {}
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

// ---------------------------------------------------------------------------
// Đăng xuất / đăng nhập lại
// ---------------------------------------------------------------------------
const WEB_RELOGIN_KEY = "pn_web_push_relogin";

/**
 * Gọi TRƯỚC signOut (máy chủ cần phiên để gỡ): thiết bị này thôi nhận thông báo của tài khoản đang đăng xuất. Trước
 * đây đăng xuất không gỡ gì → máy dùng chung (tiệm nail) vẫn nhận tin nhắn của người cũ. Web: chỉ gỡ bản ghi trên máy
 * chủ, GIỮ đăng ký của trình duyệt để lần đăng nhập sau tự gắn lại (resumePushAfterLogin) mà không phải bật lại.
 */
export async function releasePushOnSignOut(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isNativeApp()) return releaseNativePush();
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    try {
      localStorage.setItem(WEB_RELOGIN_KEY, "1");
    } catch {}
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  } catch {}
}

/** Mỗi lần tải trang (web): vừa đăng xuất → đăng nhập lại thì gắn đăng ký push sẵn có của trình duyệt cho tài khoản mới. */
export async function resumePushAfterLogin(): Promise<void> {
  if (typeof window === "undefined" || isNativeApp() || !PUBLIC_KEY) return;
  let pending = false;
  try {
    pending = localStorage.getItem(WEB_RELOGIN_KEY) === "1";
  } catch {}
  if (!pending || !("serviceWorker" in navigator) || !("Notification" in window)) return;
  const done = () => {
    try {
      localStorage.removeItem(WEB_RELOGIN_KEY);
    } catch {}
  };
  if (Notification.permission !== "granted") return done();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return done();
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    // 401 = chưa đăng nhập → giữ cờ, thử lại ở lần tải trang sau khi đã đăng nhập.
    if (res.ok) done();
  } catch {}
}

// ---------------------------------------------------------------------------
// Bật sẵn cho mọi người đã đăng nhập (chủ app, 11/2026: cuộc gọi phải đổ chuông kể cả khi đã đóng trang / app)
// ---------------------------------------------------------------------------
// Web: trình duyệt chỉ hiện hộp "Cho phép thông báo" khi người dùng CHẠM → hỏi ở lần chạm đầu tiên vào trang; đã cho
// phép từ trước (nhưng chưa đăng ký / đăng ký cũ mất) → đăng ký ngay, không cần chạm. Người dùng web tự tắt trong
// Cài đặt (disablePush) → không tự bật lại (web không có công tắc của hệ điều hành như app).
const WEB_OFF_KEY = "pn_web_push_off";
let armed = false;

export async function autoEnableWebPush(): Promise<void> {
  if (typeof window === "undefined" || isNativeApp() || armed) return;
  try {
    if (localStorage.getItem(WEB_OFF_KEY) === "1") return;
  } catch {
    return;
  }
  if ((await getPushState()) !== "off") return; // đã bật / bị chặn / iPhone chưa cài / không hỗ trợ
  armed = true;
  if (Notification.permission === "granted") {
    await enablePush().catch(() => "off");
    return;
  }
  const onTap = () => {
    window.removeEventListener("click", onTap, true);
    // Gọi requestPermission NGAY trong lượt chạm (Safari đòi đúng lượt chạm), rồi đăng ký.
    Notification.requestPermission()
      .then((p) => (p === "granted" ? enablePush() : null))
      .catch(() => {});
  };
  window.addEventListener("click", onTap, true);
}
