// Micro / camera cho cuộc gọi: xin quyền TRƯỚC khi vào phòng ZEGOCLOUD và nói rõ lỗi (thay vì vào phòng câm lặng / camera đen).
// Trên app Android, lời xin này đi qua BridgeWebChromeClient của Capacitor → hộp thoại quyền của Android (RECORD_AUDIO / CAMERA)
// rồi WebView mới cấp AUDIO_CAPTURE / VIDEO_CAPTURE; người dùng đã chặn hẳn ("Không hỏi lại") thì chỉ còn đường vào Cài đặt.
import { tr } from "@/lib/i18n/tr";

export type MediaProblem = "denied" | "nodevice" | "busy" | "unsupported";

/** Tên lỗi getUserMedia → loại lỗi để báo người dùng. */
export function classifyMediaError(e: unknown): MediaProblem {
  const n = (e as { name?: string } | null)?.name || "";
  if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") return "denied";
  if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return "nodevice";
  if (n === "TypeError") return "unsupported"; // trang không an toàn (http) / constraint rỗng
  return "busy"; // NotReadableError / TrackStartError / AbortError: thiết bị đang bị ứng dụng khác giữ
}

export interface MediaCheck {
  /** Lỗi chặn cuộc gọi (micro) — null = vào phòng được */
  problem: MediaProblem | null;
  /** Camera dùng được (cuộc gọi video) — false thì vào phòng với camera tắt */
  video: boolean;
  /** Camera lỗi riêng (micro vẫn được) */
  camProblem?: MediaProblem;
}

/**
 * Xin micro (+ camera nếu cần) rồi trả thiết bị ngay (ZEGOCLOUD tự mở lại). Camera lỗi mà micro được → vẫn gọi, camera tắt.
 */
export async function checkCallMedia(wantVideo: boolean): Promise<MediaCheck> {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!md?.getUserMedia) return { problem: "unsupported", video: false };
  const stop = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());
  try {
    stop(await md.getUserMedia({ audio: true, video: wantVideo }));
    return { problem: null, video: wantVideo };
  } catch (e) {
    const p = classifyMediaError(e);
    if (!wantVideo) return { problem: p, video: false };
    try {
      stop(await md.getUserMedia({ audio: true }));
      return { problem: null, video: false, camProblem: p };
    } catch (e2) {
      return { problem: classifyMediaError(e2), video: false };
    }
  }
}

export type CallPlatform = "android-app" | "ios-app" | "ios-web" | "web";

/** Nơi đang chạy (để chỉ đúng chỗ bật quyền). */
export function callPlatform(): CallPlatform {
  if (typeof window === "undefined") return "web";
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === "ios" ? "ios-app" : "android-app";
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios-web" : "web";
}

/** Câu báo lỗi + hướng dẫn bật quyền (EN / VI theo ngôn ngữ đang dùng). */
export function mediaProblemText(problem: MediaProblem, video: boolean, platform: CallPlatform): { title: string; hint?: string } {
  if (problem === "denied") {
    const title = video
      ? tr("PawNail chưa được phép dùng micrô / máy ảnh", "PawNail isn't allowed to use your microphone or camera")
      : tr("PawNail chưa được phép dùng micrô", "PawNail isn't allowed to use your microphone");
    const what = video ? tr("Micrô và Máy ảnh", "Microphone and Camera") : tr("Micrô", "Microphone");
    const hint =
      platform === "android-app"
        ? tr(`Mở Cài đặt → Ứng dụng → PawNail → Quyền → cho phép ${what}, rồi bấm Thử lại.`, `Open Settings → Apps → PawNail → Permissions → allow ${what}, then tap Try again.`)
        : platform === "ios-app"
          ? tr(`Mở Cài đặt → PawNail → bật ${what}, rồi bấm Thử lại.`, `Open Settings → PawNail → turn on ${what}, then tap Try again.`)
          : platform === "ios-web"
            ? tr(`Chạm "aA" trên thanh địa chỉ → Cài đặt trang web → cho phép ${what}, rồi bấm Thử lại.`, `Tap "aA" in the address bar → Website Settings → allow ${what}, then tap Try again.`)
            : tr(`Chạm biểu tượng ổ khoá cạnh địa chỉ trang → Quyền → cho phép ${what}, rồi bấm Thử lại.`, `Tap the lock icon next to the site address → Permissions → allow ${what}, then tap Try again.`);
    return { title, hint };
  }
  if (problem === "nodevice") return { title: tr("Không tìm thấy micrô trên máy này.", "No microphone was found on this device.") };
  if (problem === "busy")
    return {
      title: tr("Micrô / máy ảnh đang bị ứng dụng khác dùng.", "Your microphone or camera is in use by another app."),
      hint: tr("Đóng ứng dụng đó (hoặc cuộc gọi khác) rồi bấm Thử lại.", "Close that app (or the other call), then tap Try again."),
    };
  return {
    title: tr("Trình duyệt này không gọi được.", "This browser can't make calls."),
    hint: tr("Cập nhật trình duyệt, hoặc dùng app PawNail.", "Update your browser, or use the PawNail app."),
  };
}

/** Mã lỗi đăng nhập phòng của ZEGOCLOUD → câu báo (kèm mã cho hỗ trợ). */
export function zegoJoinErrorText(code: number): string {
  if ([1102016, 1102018, 1102020].includes(code))
    return tr(`Dịch vụ gọi từ chối phiên này (mã ${code}). Vui lòng thử lại sau.`, `The call service rejected this session (code ${code}). Please try again later.`);
  if ([1002031, 1002053].includes(code)) return tr(`Mạng đang có vấn đề (mã ${code}). Kiểm tra kết nối rồi thử lại.`, `Network problem (code ${code}). Check your connection and try again.`);
  return tr(`Không vào được cuộc gọi (mã ${code}). Vui lòng thử lại sau.`, `Couldn't join the call (code ${code}). Please try again later.`);
}
