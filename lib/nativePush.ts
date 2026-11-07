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
// Đăng xuất đã gỡ token khỏi tài khoản cũ (releaseNativePush) → lần mở app / đăng nhập sau tự đăng ký lại cho tài
// khoản mới (quyền thông báo của máy vẫn còn), không bắt người dùng bật lại.
const RELOGIN_KEY = "pn_native_push_relogin";

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
  /** Kênh "Tin nhắn" chưa bị người dùng tắt riêng (quyền thông báo vẫn "granted" khi chỉ tắt kênh). */
  messagesChannel: boolean;
}
interface PawNailNativePlugin {
  getInfo(): Promise<Partial<NativeNotifInfo> & { chat?: number }>;
  setActiveConversation(o: { id: string | null }): Promise<void>;
  clearConversation(o: { id: string }): Promise<void>;
  /** Đăng xuất: gỡ mọi thông báo + lịch sử tin + lối tắt hội thoại + ảnh đại diện đã cache (versionCode 3+). */
  clearAll(): Promise<void>;
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

// Proxy plugin của Capacitor biến MỌI thuộc tính (kể cả "then") thành lời gọi native → KHÔNG được trả thẳng proxy từ hàm
// async: `await` coi nó là thenable, gọi .then() → "PushNotifications.then() is not implemented" và promise treo mãi
// (getPushState / nativeEnable không bao giờ xong). Bọc trong 1 object thường.
const plugin = async () => ({ P: (await import("@capacitor/push-notifications")).PushNotifications });
const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const reloginPending = () => {
  try {
    return localStorage.getItem(RELOGIN_KEY) === "1";
  } catch {
    return false;
  }
};

/** Đường dẫn trong app: đúng 1 dấu "/" đầu (không "//host", không scheme), không khoảng trắng / dấu gạch ngược. */
export const isSafeAppPath = (u: unknown): u is string => typeof u === "string" && u.length < 2048 && /^\/(?!\/)[^\s\\]*$/.test(u);

export async function nativeGetState(): Promise<PushState> {
  if (!(await nativeServerOn())) return "unsupported";
  const p = await (await plugin()).P.checkPermissions();
  if (p.receive === "denied") return "denied";
  return p.receive === "granted" && savedToken() ? "on" : "off";
}

/** Đăng ký với Firebase → nhận token → gửi lên máy chủ. */
async function registerToken(): Promise<boolean> {
  const { P } = await plugin();
  // Gỡ listener sau mỗi lượt — trước đây mỗi lần mở app lại cộng thêm 1 cặp listener (gọi trùng nhiều lần).
  const handles: Promise<{ remove: () => Promise<void> }>[] = [];
  const token = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 15_000);
    handles.push(
      P.addListener("registration", (t) => {
        clearTimeout(timer);
        resolve(t.value);
      }),
      P.addListener("registrationError", () => {
        clearTimeout(timer);
        resolve(null);
      })
    );
    P.register().catch(() => resolve(null));
  });
  for (const h of handles) h.then((x) => x.remove()).catch(() => {});
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
    localStorage.removeItem(RELOGIN_KEY);
  } catch {}
  return true;
}

export async function nativeEnable(): Promise<PushState> {
  if (!(await nativeServerOn())) return "unsupported";
  const { P } = await plugin();
  let perm = await P.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await P.requestPermissions();
  if (perm.receive !== "granted") return perm.receive === "denied" ? "denied" : "off";
  return (await registerToken()) ? "on" : "off";
}

export async function nativeDisable(): Promise<PushState> {
  const token = savedToken();
  if (token) {
    await fetch("/api/push/native", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RELOGIN_KEY);
  } catch {}
  return "off";
}

/**
 * Đăng xuất (gọi TRƯỚC signOut — DELETE cần phiên còn hiệu lực): gỡ token của máy này khỏi tài khoản đang đăng xuất
 * (trước đây token vẫn gắn với tài khoản cũ → điện thoại tiếp tục hiện tin nhắn của người đó cho người dùng sau), gỡ
 * thông báo đang hiện, và trên Android xoá cả lịch sử tin / lối tắt hội thoại / ảnh đại diện app đã lưu. Đã bật thông
 * báo trước đó → đánh dấu để lần đăng nhập sau tự đăng ký lại (initNativePush).
 */
export async function releaseNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  const token = savedToken();
  try {
    if (token) localStorage.setItem(RELOGIN_KEY, "1");
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  const jobs: Promise<unknown>[] = [];
  if (token) jobs.push(fetch("/api/push/native", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {}));
  if (isAndroidApp()) jobs.push(PawNailNative.clearAll().catch(() => {}));
  // Bản app cũ (chưa có clearAll) / iPhone: ít nhất gỡ thông báo đang nằm trong khay.
  jobs.push(plugin().then(({ P }) => P.removeAllDeliveredNotifications()).catch(() => {}));
  await Promise.all(jobs);
  chatRenderer = 0;
}

/**
 * Gỡ các thông báo đang nằm trong khay có tag thuộc `tags` (vd thông báo "đang gọi" của 1 cuộc gọi đã nghe / từ chối).
 * Dùng API sẵn có của plugin push (mọi bản app, kể cả versionCode 3) — thông báo Firebase vẽ có id 0 + tag.
 */
export async function clearNativeNotificationsByTag(tags: string[]): Promise<number> {
  if (!isNativeApp() || !tags.length) return 0;
  try {
    const { P } = await plugin();
    const { notifications } = await P.getDeliveredNotifications();
    const mine = notifications.filter((n) => typeof n.tag === "string" && tags.includes(n.tag));
    if (mine.length) await P.removeDeliveredNotifications({ notifications: mine });
    return mine.length;
  } catch {
    return 0;
  }
}

/** Chỉ dọn dữ liệu chat trên máy (xoá tài khoản — máy chủ đã tự xoá token). */
export function clearAllNative(): void {
  if (isAndroidApp()) PawNailNative.clearAll().catch(() => {});
}

let initialized = false;
/** Gọi 1 lần khi app mở: bấm thông báo → mở đúng trang; đã cho phép → làm mới token. */
export async function initNativePush() {
  // Bong bóng chat (WebView phụ) không đăng ký thông báo / không nghe bấm thông báo — app chính lo.
  if (initialized || !isNativeApp() || isBubbleMode()) return;
  initialized = true;
  const { P } = await plugin();
  P.addListener("pushNotificationActionPerformed", (a) => {
    const url = (a.notification.data as { url?: string } | undefined)?.url;
    if (isSafeAppPath(url)) window.location.href = url;
  });
  if (isAndroidApp()) {
    PawNailNative.getInfo()
      .then((i) => {
        chatRenderer = Number(i.chat) || 0;
      })
      .catch(() => {});
  }
  if (!(await nativeServerOn())) return;
  const perm = await P.checkPermissions();
  // Đã bật từ trước (token đã lưu) → làm mới token; vừa đăng xuất rồi đăng nhập lại (RELOGIN_KEY) → đăng ký lại cho
  // tài khoản mới. Chưa đăng nhập → máy chủ trả 401, cờ vẫn giữ cho lần sau.
  if (perm.receive === "granted" && (savedToken() || reloginPending())) registerToken().catch(() => {});
}

// ---------------------------------------------------------------------------
// Thông báo chat do app Android tự vẽ (versionCode 3+) — mọi hàm là no-op trên web / iPhone / bản app cũ.
// ---------------------------------------------------------------------------

/** Đang chạy trong app Android có plugin PawNailNative (không phải bong bóng chat). */
export const isAndroidApp = () =>
  typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("PawNailNative");

// Phiên bản bộ vẽ thông báo chat native (PawNailNative.getInfo().chat — versionCode 3+); 0 = không có / chưa đọc.
let chatRenderer = 0;

/**
 * App Android này TỰ báo tin nhắn mới (kêu + rung + hiện nổi) khi ở nền: có bộ vẽ native VÀ máy đã đăng ký thông báo.
 * Khi đó web đừng phát thêm âm thanh / toast lúc trang bị ẩn (WebView của Capacitor vẫn chạy JS + Pusher ở nền → trước
 * đây kêu 2 lần cùng lúc).
 */
export function nativeHandlesChatAlerts(): boolean {
  return chatRenderer >= 1 && isAndroidApp() && !!savedToken();
}

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
    return {
      firebase: !!i.firebase,
      sdk: i.sdk,
      bubbles: !!i.bubbles && i.sdk >= 30,
      bubblePref: pref,
      notificationsEnabled: i.notificationsEnabled !== false,
      messagesChannel: i.messagesChannel !== false,
    };
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
