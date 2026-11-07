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

// Dịch vụ gọi đã cấu hình trên máy chủ chưa (GET /api/zego/token → { enabled }, không lộ khoá). Mở 1 chat 1-1 là hỏi sẵn;
// lỗi mạng / chưa đăng nhập → null và lần sau hỏi lại. false = KHÔNG gọi được (thiếu App ID / secret) — chỉ nhớ 60 giây: app để
// chạy nền lâu vẫn nhận ra khi chủ app vừa thêm ZEGO_APP_ID + deploy lại (không phải tải lại trang). true thì nhớ cả phiên.
const OFF_TTL_MS = 60_000;
let callsEnabled: Promise<boolean | null> | null = null;
let offAt = 0;
export function probeCalls(): Promise<boolean | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (callsEnabled && offAt && Date.now() - offAt > OFF_TTL_MS) callsEnabled = null;
  if (!callsEnabled) {
    offAt = 0;
    const p: Promise<boolean | null> = fetch("/api/zego/token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (typeof d?.enabled === "boolean" ? d.enabled : null))
      .catch(() => null);
    callsEnabled = p;
    p.then((v) => {
      if (callsEnabled !== p) return;
      if (v === null) callsEnabled = null;
      else if (v === false) offAt = Date.now();
    });
  }
  return callsEnabled;
}
