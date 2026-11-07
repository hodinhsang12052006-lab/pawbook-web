"use client";

// Camera / microphone errors → a clear, localized title + a short "how to allow it" hint for the place the person is
// actually in (desktop browser, Android browser, iPhone Safari, the PawNail Android app). Never a silent failure.
import { tr } from "@/lib/i18n/tr";

export type MediaErrorKind = "denied" | "notfound" | "inuse" | "unsupported" | "unknown";
// "inapp": Facebook / Messenger / Instagram / Zalo / LINE in-app browsers (common when a link is opened from a chat):
// they usually block the microphone and their settings differ, so the only reliable advice is "open in Safari/Chrome".
export type CallPlatform = "android-app" | "ios-app" | "inapp" | "iphone" | "android" | "desktop";

const IN_APP_RE = /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|MicroMessenger/i;

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
  if (IN_APP_RE.test(ua)) return "inapp";
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

/** A phone or tablet (iPadOS reports a Mac user agent, so this goes by the platform, not a UA regex). */
export function isPhoneLike(p: CallPlatform = detectCallPlatform()): boolean {
  return p !== "desktop";
}

/** oldAppBuild: Android app installs before versionCode 3 deny camera/mic in the WebView — they must update. */
export function describeMediaError(kind: MediaErrorKind, o: { video: boolean; platform?: CallPlatform; oldAppBuild?: boolean; cameraOnly?: boolean }): MediaErrorText {
  const platform = o.platform ?? detectCallPlatform();
  const What = o.video ? tr("Micro / camera", "Microphone / camera") : tr("Micro", "Microphone");
  const whatLower = o.video ? tr("micro và camera", "microphone and camera") : tr("micro", "microphone");
  // A video call whose CAMERA alone failed (the microphone works) can always continue as a voice call — including a
  // camera-only block: Chrome, the Android WebView and iOS report it as NotAllowedError on the combined request.
  const canFallBackToVoice = o.video && !!o.cameraOnly && (kind === "notfound" || kind === "inuse" || kind === "denied");
  const camOnly = o.video && !!o.cameraOnly;
  // the blocked device(s), in the words of the browser's own permission screen
  const what = camOnly ? tr("Camera", "Camera") : o.video ? tr("Micro và Camera", "Microphone and Camera") : tr("Micro", "Microphone");
  if (kind === "denied") {
    let hint: string;
    if (platform === "android-app") {
      hint = tr(
        "Mở Cài đặt › Ứng dụng › PawNail Jobs › Quyền, cho phép " + (camOnly ? "Máy ảnh" : "Micro" + (o.video ? " và Máy ảnh" : "")) + ", rồi gọi lại.",
        "Open Settings › Apps › PawNail Jobs › Permissions, allow " + (camOnly ? "Camera" : "Microphone" + (o.video ? " and Camera" : "")) + ", then call again."
      );
      if (o.oldAppBuild) hint += " " + tr("Bản PawNail này đã cũ — hãy cập nhật PawNail trên Google Play.", "This PawNail version is out of date — please update PawNail on Google Play.");
    } else if (platform === "ios-app") {
      hint = tr(
        "Mở Cài đặt › PawNail, bật " + (camOnly ? "Camera" : "Micro" + (o.video ? " và Camera" : "")) + ", rồi gọi lại.",
        "Open Settings › PawNail, turn on " + (camOnly ? "Camera" : "Microphone" + (o.video ? " and Camera" : "")) + ", then call again."
      );
    } else if (platform === "inapp") {
      hint = tr(
        "Trình duyệt trong ứng dụng này (Facebook, Messenger, Zalo…) thường chặn micro. Mở PawNail bằng Safari hoặc Chrome để gọi.",
        "This in-app browser (Facebook, Messenger, Zalo…) usually blocks the microphone. Open PawNail in Safari or Chrome to call."
      );
    } else if (platform === "iphone") {
      hint = tr(
        "Chạm nút trang trên thanh địa chỉ (aA hoặc ☰) › Cài đặt trang web › " + (camOnly ? "Camera" : o.video ? "Micro/Camera" : "Micro") + " › Cho phép, rồi tải lại trang.",
        "Tap the page button in the address bar (aA or ☰) › Website Settings › " + (camOnly ? "Camera" : o.video ? "Microphone/Camera" : "Microphone") + " › Allow, then reload."
      );
    } else if (platform === "android") {
      hint = tr(
        "Chạm biểu tượng bên trái địa chỉ trang (hình nút chỉnh hoặc ổ khoá) › Quyền › cho phép " + what + ", rồi gọi lại.",
        "Tap the icon left of the web address (settings or lock icon) › Permissions › allow " + what + ", then call again."
      );
    } else {
      hint = tr(
        "Bấm biểu tượng bên trái địa chỉ trang (hình nút chỉnh hoặc ổ khoá) › cho phép " + what + " (hoặc Cài đặt trang web), rồi gọi lại.",
        "Click the icon left of the web address (settings or lock icon) › allow " + what + " (or Site settings), then call again."
      );
    }
    if (camOnly && platform !== "inapp") {
      hint = tr("Micro vẫn dùng được — bạn có thể gọi thoại. Để bật camera: ", "Your microphone works, so you can make a voice call. To allow the camera: ") + hint.charAt(0).toLowerCase() + hint.slice(1);
    }
    return { kind, title: camOnly ? tr("Camera đang bị chặn", "Camera access is blocked") : tr(`${What} đang bị chặn`, `${What} access is blocked`), hint, canFallBackToVoice };
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
        platform === "inapp"
          ? tr("Trình duyệt trong ứng dụng này không gọi được. Mở PawNail bằng Safari hoặc Chrome để gọi.", "This in-app browser can't make calls. Open PawNail in Safari or Chrome to call.")
          : platform === "iphone"
          ? tr("Mở PawNail bằng Safari (iOS 14.3 trở lên) để gọi.", "Open PawNail in Safari (iOS 14.3 or later) to call.")
          : tr("Dùng Chrome, Edge, Safari hoặc app PawNail bản mới nhất.", "Use Chrome, Edge, Safari or the latest PawNail app."),
      canFallBackToVoice: false,
    };
  }
  return {
    kind,
    title: tr(`Không mở được ${whatLower}`, `Couldn't start the ${whatLower}`),
    hint: tr("Kiểm tra quyền " + whatLower + " của trình duyệt rồi thử lại.", "Check the browser's " + whatLower + " permission and try again."),
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
