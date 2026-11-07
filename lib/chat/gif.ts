// GIF trong tin nhắn: vẫn là tin IMAGE (tương thích ngược) nhưng nhận ra theo host GIPHY / Tenor. THUẦN (máy chủ + trình duyệt).
// Từ 11/2026 GIF GIPHY gửi bằng bản MP4 (nhẹ hơn GIF/WebP nhiều lần, mượt hơn): nội dung tin =
//   "https://mediaN.giphy.com/media/…/200.mp4#wh=356x200&still=<URL ảnh tĩnh 200_s.gif, mã hoá URI>"
// — #wh giữ khung đúng tỉ lệ trước khi tải, still = ảnh poster (hiện trước khung đầu / khi tắt chuyển động). Tin GIF cũ
// (.gif / .webp, không still) vẫn vẽ bằng <img> như trước. Mọi chỗ xem trước (danh sách, thông báo) vẫn ghi "GIF".
const GIF_HOST = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|[a-z0-9-]+\.tenor\.com)\//i;

export function isGifUrl(u: string | null | undefined): boolean {
  return typeof u === "string" && GIF_HOST.test(u);
}

/** Phần trước "#" và "?" (đường dẫn thật của tệp). */
const pathOf = (u: string) => u.split("#")[0].split("?")[0];

/** Đường dẫn tệp (bỏ "#…", "?…") kết thúc bằng .mp4 — không xét host. */
export const isMp4Url = (u: string) => /\.mp4$/i.test(pathOf(u));

/** GIF gửi bằng bản video (MP4 của GIPHY / Tenor) — vẽ bằng <video> thay cho <img>. */
export function isGifVideo(u: string | null | undefined): boolean {
  return isGifUrl(u) && isMp4Url(u as string);
}

/** URL tệp để đặt vào src (bỏ "#wh=…&still=…"). */
export const gifMediaSrc = (u: string) => u.split("#")[0];

/** "…#wh=480x270" → 480/270; không có → null. */
export function gifAspect(u: string): number | null {
  const m = /#(?:.*&)?wh=(\d{1,5})x(\d{1,5})/.exec(u);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

/** Ảnh poster của GIF video ("&still=" trong phần #). Chỉ nhận URL https trên host GIF (không thành "đèn hiệu" theo dõi). */
export function gifStill(u: string): string | null {
  const hash = u.indexOf("#");
  if (hash < 0) return null;
  const m = /(?:^|&)still=([^&]*)/.exec(u.slice(hash + 1));
  if (!m) return null;
  let s: string;
  try {
    s = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return s.length <= 400 && isGifUrl(s) && /^[^\s"'<>#]+$/.test(s) && /\.(gif|webp|jpe?g|png)$/i.test(pathOf(s)) ? s : null;
}

/** Ghép nội dung tin GIF video: MP4 + #wh + (poster nếu là URL host GIF hợp lệ). */
export function gifVideoContent(mp4: string, w: number, h: number, still?: string | null): string {
  const tail = still && isGifUrl(still) ? `&still=${encodeURIComponent(still)}` : "";
  return `${gifMediaSrc(mp4)}#wh=${Math.round(w)}x${Math.round(h)}${tail}`;
}

/**
 * Máy chủ: nội dung tin IMAGE trên host GIF có hợp lệ không — đường dẫn không có ký tự lạ, phần # chỉ là
 * "wh=WxH" (+ "&still=<URL host GIF>"). Nội dung không phải host GIF → true (đã có kiểm tra nguồn ảnh riêng).
 */
export function gifContentOk(u: string): boolean {
  if (!isGifUrl(u)) return true;
  if (u.length > 1000) return false;
  const [file, ...rest] = u.split("#");
  if (!/^https:\/\/[^\s"'<>]+$/.test(file)) return false;
  if (!rest.length) return true;
  const frag = rest.join("#");
  const m = /^wh=\d{1,5}x\d{1,5}(?:&still=([^&#\s"'<>]+))?$/.exec(frag);
  if (!m) return false;
  return !m[1] || gifStill(u) !== null;
}

/** Host gửi Access-Control-Allow-Origin: * → dùng crossorigin="anonymous" (service worker cache được, không "opaque"). */
export const corsSafeGif = (u: string) => /^https:\/\/(media\d*|i)\.giphy\.com\//i.test(u);
