// Ảnh GIF trong tin nhắn: vẫn là tin IMAGE (tương thích ngược) nhưng nhận ra theo host GIPHY / Tenor.
const GIF_HOST = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|[a-z0-9-]+\.tenor\.com)\//i;

export function isGifUrl(u: string | null | undefined): boolean {
  return typeof u === "string" && GIF_HOST.test(u);
}

/** "…#wh=480x270" → 480/270; không có → null. */
export function gifAspect(u: string): number | null {
  const m = /#(?:.*&)?wh=(\d{1,5})x(\d{1,5})/.exec(u);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

/** Host gửi Access-Control-Allow-Origin: * → dùng crossorigin="anonymous" (service worker cache được, không "opaque"). */
export const corsSafeGif = (u: string) => /^https:\/\/(media\d*|i)\.giphy\.com\//i.test(u);
