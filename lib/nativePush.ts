"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { PushState } from "@/lib/pushClient";
import { isBubbleMode } from "@/lib/bubbleMode";

// Thông báo đẩy trong APP NATIVE (Android/iOS) qua Firebase — lib/pushClient.ts
// tự chuyển sang đây khi đang chạy trong app, nên lời mời bật thông báo, công
// tắc trong Cài đặt và "Báo việc" đều dùng chung một cách.
// Chỉ hoạt động khi: app build có plugin @capacitor/push-notifications
// (+ google-services.json / APNs) VÀ máy chủ đã bật FIREBASE_SERVICE_ACCOUNT
// (iOS: APNS_*) VÀ bản app đủ mới (shellSupportsPush bên dưới).
const TOKEN_KEY = "pn_native_push_token";

export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");

// Plugin native nhỏ trong MainActivity (android/.../PawNailNativePlugin.java). getInfo().firebase: bản Android này
// có google-services.json (Firebase) hay không. Từ versionCode 3 thêm: sdk, bong bóng chat, quyền thông báo, báo
// cuộc trò chuyện đang mở (app tự vẽ thông báo chat — không báo tin của cuộc trò chuyện người dùng đang xem).
// Bản app CŨ không có các hàm mới → Capacitor trả lỗi "not implemented" → mọi hàm bên dưới nuốt lỗi, không ném.
export type BubblePref = "all" | "selected" | "none" | null;
export interface NativeNotifInfo {
  firebase: boolean;
  /** Build.VERSION.SDK_INT */
  sdk: number;
  /** Máy hỗ trợ bong bóng chat (Android 11 / API 30+). */
  bubbles: boolean;
  /** Cài đặt bong bóng của app (API 31+): tất cả / chọn lọc / tắt; null = không đọc được (API 30). */
  bubblePref: BubblePref;
  /** NotificationManagerCompat.areNotificationsEnabled() */
  notificationsEnabled: boolean;
}
interface PawNailNativePlugin {
  getInfo(): Promise<Partial<NativeNotifInfo>>;
  setActiveConversation(o: { id: string | null }): Promise<void>;
  clearConversation(o: { id: string }): Promise<void>;
  openBubbleSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
}
const PawNailNative = registerPlugin<PawNailNativePlugin>("PawNailNative");

// Bản iOS đầu tiên có entitlement aps-environment (ios/App/App/App.entitlements).
// Máy chủ nâng được mốc này mà không cần build lại: NATIVE_PUSH_MIN_BUILD_IOS.
const DEFAULT_IOS_MIN_BUILD = 2;

type PushServerInfo = { nativeEnabled?: boolean; iosEnabled?: boolean; androidMinBuild?: number | null; iosMinBuild?: number | null };

// Bản app CŨ không được gọi register(): trên Android thiếu Firebase thì
// FirebaseMessaging.getInstance() ném lỗi và app CRASH ngay khi người dùng bấm
// "Bật thông báo" (xảy ra ngay khi máy chủ đặt FIREBASE_SERVICE_ACCOUNT). Bản cũ
// / thiếu cấu hình → "unsupported", không crash.
async function shellSupportsPush(d: PushServerInfo): Promise<boolean> {
  const build = Number((await App.getInfo()).build) || 0;
  if (Capacitor.getPlatform() === "ios") return build >= (Number(d.iosMinBuild) || DEFAULT_IOS_MIN_BUILD);
  if (!Capacitor.isPluginAvailable("PawNailNative")) return false; // bản Android trước versionCode 2
  if (build < (Number(d.androidMinBuild) || 0)) return false;
  return !!(await PawNailNative.getInfo()).firebase;
}

let serverOn: Promise<boolean> | null = null;
const nativeServerOn = () =>
  (serverOn ??= fetch("/api/push/subscribe")
    .then((r) => r.json())
    .then(async (d: PushServerInfo) => (Capacitor.getPlatform() === "ios" ? !!d.iosEnabled : !!d.nativeEnabled) && (await shellSupportsPush(d)))
    .catch(() => false));

const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;
const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export async function nativeGetState(): Promise<PushState> {
  if (!(await nativeServerOn())) return "unsupported";
  const p = await (await plugin()).checkPermissions();
  if (p.receive === "denied") return "denied";
  return p.receive === "granted" && savedToken() ? "on" : "off";
}

/** Đăng ký với Firebase → nhận token → gửi lên máy chủ. */
async function registerToken(): Promise<boolean> {
  const P = await plugin();
  const token = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 15_000);
    P.addListener("registration", (t) => {
      clearTimeout(timer);
      resolve(t.value);
    });
    P.addListener("registrationError", () => {
      clearTimeout(timer);
      resolve(null);
    });
    P.register().catch(() => resolve(null));
  });
  if (!token) return false;
  // build (versionCode Android / CFBundleVersion iOS): máy chủ chỉ gửi tin chat data-only (thông báo kiểu Messenger)
  // cho bản app có service tự vẽ (lib/fcm.ts richChatMinBuild) — bản cũ vẫn nhận dạng thông báo thường.
  const build = Number((await App.getInfo().catch(() => null))?.build);
  const res = await fetch("/api/push/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
      ...(Number.isInteger(build) && build >= 0 ? { build } : {}),
    }),
  });
  if (!res.ok) return false;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  return true;
}

export async function nativeEnable(): Promise<PushState> {
  if (!(await nativeServerOn())) return "unsupported";
  const P = await plugin();
  let perm = await P.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await P.requestPermissions();
  if (perm.receive !== "granted") return perm.receive === "denied" ? "denied" : "off";
  return (await registerToken()) ? "on" : "off";
}

export async function nativeDisable(): Promise<PushState> {
  const token = savedToken();
  if (token) {
    await fetch("/api/push/native", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
  return "off";
}

let initialized = false;
/** Gọi 1 lần khi app mở: bấm thông báo → mở đúng trang; đã cho phép → làm mới token. */
export async function initNativePush() {
  // Bong bóng chat (WebView phụ) không đăng ký thông báo / không nghe bấm thông báo — app chính lo.
  if (initialized || !isNativeApp() || isBubbleMode()) return;
  initialized = true;
  const P = await plugin();
  P.addListener("pushNotificationActionPerformed", (a) => {
    const url = (a.notification.data as { url?: string } | undefined)?.url;
    if (url && url.startsWith("/")) window.location.href = url;
  });
  if (!(await nativeServerOn())) return;
  const perm = await P.checkPermissions();
  if (perm.receive === "granted" && savedToken()) registerToken().catch(() => {});
}

// ---------------------------------------------------------------------------
// Thông báo chat do app Android tự vẽ (versionCode 3+) — mọi hàm là no-op trên web / iPhone / bản app cũ.
// ---------------------------------------------------------------------------

/** Đang chạy trong app Android có plugin PawNailNative (không phải bong bóng chat). */
export const isAndroidApp = () =>
  typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("PawNailNative");

let lastActive: string | null | undefined;
/**
 * Báo app biết cuộc trò chuyện đang mở trên màn hình (id hội thoại) — app không hiện thông báo cho tin của cuộc trò
 * chuyện đó khi đang ở foreground. null = không mở cuộc trò chuyện nào / app đã ẩn.
 */
export function setActiveConversation(id: string | null): void {
  if (!isAndroidApp() || lastActive === id) return;
  lastActive = id;
  PawNailNative.setActiveConversation({ id }).catch(() => {});
}

/** Gỡ thông báo của cuộc trò chuyện này (đã đọc trên màn hình) và quên lịch sử tin đã gom trong thông báo. */
export function clearConversation(id: string): void {
  if (!isAndroidApp() || !id) return;
  PawNailNative.clearConversation({ id }).catch(() => {});
}

/** Thông tin thông báo / bong bóng của máy; null trên web / iPhone / bản app chưa có (thiếu sdk). */
export async function getBubbleInfo(): Promise<NativeNotifInfo | null> {
  if (!isAndroidApp()) return null;
  try {
    const i = await PawNailNative.getInfo();
    if (typeof i.sdk !== "number") return null; // bản app cũ: getInfo chỉ có firebase
    const pref = i.bubblePref === "all" || i.bubblePref === "selected" || i.bubblePref === "none" ? i.bubblePref : null;
    return { firebase: !!i.firebase, sdk: i.sdk, bubbles: !!i.bubbles && i.sdk >= 30, bubblePref: pref, notificationsEnabled: i.notificationsEnabled !== false };
  } catch {
    return null;
  }
}

/** Mở trang cài đặt Bong bóng của app (Android 11+; máy cũ hơn: cài đặt thông báo). false nếu không mở được. */
export async function openBubbleSettings(): Promise<boolean> {
  if (!isAndroidApp()) return false;
  return PawNailNative.openBubbleSettings().then(() => true, () => false);
}

/** Mở trang cài đặt thông báo của app (bật lại khi người dùng đã chặn). */
export async function openNotificationSettings(): Promise<boolean> {
  if (!isAndroidApp()) return false;
  return PawNailNative.openNotificationSettings().then(() => true, () => false);
}
