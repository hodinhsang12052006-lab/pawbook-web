"use client";

// Camera / microphone errors → a clear, localized title + a short "how to allow it" hint for the place the person is
// actually in (desktop browser, Android browser, iPhone Safari, the PawNail Android app). Never a silent failure.
import { tr } from "@/lib/i18n/tr";

export type MediaErrorKind = "denied" | "notfound" | "inuse" | "unsupported" | "unknown";
export type CallPlatform = "android-app" | "ios-app" | "iphone" | "android" | "desktop";

export function classifyMediaError(err: unknown): MediaErrorKind {
  const name = (err as { name?: string } | null)?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError" || name === "ConstraintNotSatisfiedError") return "notfound";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "inuse";
  if (name === "TypeError" || name === "NotSupportedError" || name === "Unsupported") return "unsupported";
  return "unknown";
}

export function detectCallPlatform(): CallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === "ios" ? "ios-app" : "android-app";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export interface MediaErrorText {
  kind: MediaErrorKind;
  title: string;
  hint: string;
  /** a video call whose camera failed can still continue as a voice call */
  canFallBackToVoice: boolean;
}

/** oldAppBuild: Android app installs before versionCode 3 deny camera/mic in the WebView — they must update. */
export function describeMediaError(kind: MediaErrorKind, o: { video: boolean; platform?: CallPlatform; oldAppBuild?: boolean; cameraOnly?: boolean }): MediaErrorText {
  const platform = o.platform ?? detectCallPlatform();
  const what = o.video ? tr("micro và camera", "microphone and camera") : tr("micro", "microphone");
  const What = o.video ? tr("Micro / camera", "Microphone / camera") : tr("Micro", "Microphone");
  const canFallBackToVoice = o.video && !!o.cameraOnly && (kind === "notfound" || kind === "inuse");
  if (kind === "denied") {
    let hint: string;
    if (platform === "android-app") {
      hint = tr(
        "Mở Cài đặt › Ứng dụng › PawNail › Quyền, cho phép Micro" + (o.video ? " và Máy ảnh" : "") + ", rồi gọi lại.",
        "Open Settings › Apps › PawNail › Permissions, allow Microphone" + (o.video ? " and Camera" : "") + ", then call again."
      );
      if (o.oldAppBuild) hint += " " + tr("Bản PawNail này đã cũ — hãy cập nhật PawNail trên Google Play.", "This PawNail version is out of date — please update PawNail on Google Play.");
    } else if (platform === "ios-app") {
      hint = tr("Mở Cài đặt › PawNail, bật Micro" + (o.video ? " và Camera" : "") + ", rồi gọi lại.", "Open Settings › PawNail, turn on Microphone" + (o.video ? " and Camera" : "") + ", then call again.");
    } else if (platform === "iphone") {
      hint = tr(
        "Chạm aA trên thanh địa chỉ › Cài đặt trang web › cho phép " + what + " (hoặc Cài đặt › Safari › Micro / Camera), rồi tải lại trang.",
        "Tap aA in the address bar › Website Settings › allow " + what + " (or Settings › Safari › Microphone / Camera), then reload."
      );
    } else if (platform === "android") {
      hint = tr("Chạm biểu tượng ổ khoá cạnh địa chỉ trang › Quyền › cho phép " + what + ", rồi gọi lại.", "Tap the lock icon next to the address › Permissions › allow " + what + ", then call again.");
    } else {
      hint = tr("Bấm biểu tượng ổ khoá cạnh địa chỉ trang › Cài đặt trang web › cho phép " + what + ", rồi gọi lại.", "Click the lock icon next to the address › Site settings › allow " + what + ", then call again.");
    }
    return { kind, title: tr(`${What} đang bị chặn`, `${What} access is blocked`), hint, canFallBackToVoice: false };
  }
  if (kind === "notfound") {
    return {
      kind,
      title: o.cameraOnly ? tr("Không tìm thấy camera", "No camera found") : tr("Không tìm thấy micro", "No microphone found"),
      hint: o.cameraOnly
        ? tr("Máy này không có camera dùng được. Bạn vẫn có thể gọi thoại.", "This device has no usable camera. You can still make a voice call.")
        : tr("Cắm tai nghe có micro hoặc kiểm tra micro của máy rồi thử lại.", "Plug in a headset with a mic or check your device's microphone, then try again."),
      canFallBackToVoice,
    };
  }
  if (kind === "inuse") {
    return {
      kind,
      title: o.cameraOnly ? tr("Camera đang bận", "Camera is busy") : tr(`${What} đang bận`, `${What} is busy`),
      hint: tr("Một ứng dụng khác (Zoom, Messenger, máy ảnh…) đang dùng thiết bị. Đóng ứng dụng đó rồi thử lại.", "Another app (Zoom, Messenger, the camera…) is using it. Close that app and try again."),
      canFallBackToVoice,
    };
  }
  if (kind === "unsupported") {
    return {
      kind,
      title: tr("Trình duyệt này không gọi được", "This browser can't make calls"),
      hint:
        platform === "iphone"
          ? tr("Mở PawNail bằng Safari (iOS 14.3 trở lên) để gọi.", "Open PawNail in Safari (iOS 14.3 or later) to call.")
          : tr("Dùng Chrome, Edge, Safari hoặc app PawNail bản mới nhất.", "Use Chrome, Edge, Safari or the latest PawNail app."),
      canFallBackToVoice: false,
    };
  }
  return {
    kind,
    title: tr(`Không mở được ${what}`, `Couldn't start the ${what}`),
    hint: tr("Kiểm tra quyền " + what + " của trình duyệt rồi thử lại.", "Check the browser's " + what + " permission and try again."),
    canFallBackToVoice,
  };
}

/** Short reason shown to the OTHER person when the callee could not join ("<name> couldn't join (microphone blocked)"). */
export function peerMediaReason(): string {
  return tr("micro bị chặn hoặc không dùng được", "microphone blocked or unavailable");
}

/** Android app build number (versionCode) — null outside the app or when it can't be read. */
export async function androidAppBuild(): Promise<number | null> {
  if (detectCallPlatform() !== "android-app") return null;
  try {
    const { App } = await import("@capacitor/app");
    const n = Number((await App.getInfo()).build);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
