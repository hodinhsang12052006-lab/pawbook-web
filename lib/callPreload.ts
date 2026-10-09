// Tải trước bộ gọi (ZegoCloud ~1.5MB nén + khung phòng gọi) TRONG LÚC đang đổ
// chuông, thay vì đợi bấm "Nghe" mới tải → bắt máy là thông gần như ngay.
// Gọi nhiều lần không sao: chỉ tải 1 lần (webpack dùng chung chunk với dynamic()).
let pending: Promise<unknown> | null = null;

export function preloadCallSdk() {
  if (typeof window === "undefined" || pending) return;
  pending = Promise.all([import("@/components/chat/VideoCallRoom"), import("@zegocloud/zego-uikit-prebuilt")]).catch(() => {
    pending = null; // lỗi mạng → lần sau thử lại
  });
}

/** Tải trước khi rảnh — bỏ qua nếu người dùng bật tiết kiệm dữ liệu / mạng 2G. */
export function preloadCallSdkWhenIdle() {
  if (typeof window === "undefined" || pending) return;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || /2g/.test(c?.effectiveType ?? "")) return;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(preloadCallSdk, { timeout: 4000 });
  else setTimeout(preloadCallSdk, 2500);
}
