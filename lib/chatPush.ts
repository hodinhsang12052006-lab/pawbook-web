import { isPlaceholderAvatar } from "@/lib/avatar";

// Dữ liệu thông báo đẩy cho TIN NHẮN CHAT (app/api/messages → lib/push.ts → lib/fcm.ts). Hàm thuần — kiểm thử ở
// scripts/qa/fcm_payload_unit.mts.

/** Gốc của app native (capacitor.config.ts server.url) — URL trong thông báo luôn trỏ về đây, kể cả khi chạy QA local. */
export const APP_ORIGIN = "https://www.bitpawos.com";

/** Mở ĐÚNG cuộc trò chuyện này (1-1 lẫn nhóm). Trước đây là /messages?to=<người gửi> → bấm thông báo của nhóm lại mở chat riêng với người gửi. */
export const chatPushUrl = (conversationId: string) => `/messages?c=${encodeURIComponent(conversationId)}`;

type ConvLike = { isGroup?: boolean | null; name?: string | null; participants?: { id: string; name?: string | null }[] };

/** Tiêu đề cuộc trò chuyện: tên nhóm (nhóm chưa đặt tên → "Lan, Mai, Hoa +2" như Messenger), hoặc tên người gửi (1-1). */
export function chatPushTitle(conv: ConvLike, senderName: string): string {
  if (!conv.isGroup) return senderName;
  const named = (conv.name || "").trim();
  if (named) return named;
  const firsts = (conv.participants || []).map((p) => (p.name || "").trim().split(/\s+/)[0]).filter(Boolean);
  if (!firsts.length) return senderName;
  return firsts.slice(0, 3).join(", ") + (firsts.length > 3 ? ` +${firsts.length - 3}` : "");
}

// Ảnh đại diện trong thông báo do ĐIỆN THOẠI NGƯỜI NHẬN tự tải. avatarUrl do người gửi tự đặt (bất kỳ https://, đường
// dẫn tương đối, data: base64 tới 500 KB, SVG của dicebear…) → không bao giờ gửi thẳng:
//  - ảnh Cloudinary: thu về ô vuông 256px JPEG ngay trên Cloudinary (nhà cung cấp ảnh của PawNail);
//  - Google / Unsplash: đi qua bộ tối ưu ảnh của chính PawNail (/_next/image) → máy chủ lạ không biết IP người nhận;
//  - đường dẫn trên chính bitpawos.com: thành URL tuyệt đối;
//  - còn lại (host lạ = có thể là "tracking beacon", data:, SVG, ảnh giữ chỗ) → "" và app tự vẽ chữ cái đầu.
const PROXY_HOSTS = new Set(["lh3.googleusercontent.com", "images.unsplash.com"]);
const SIZE = 256; // có trong imageSizes mặc định của next/image
const isSvg = (path: string) => /\.svgz?$/i.test(path);

function cloudinarySquare(u: URL): string {
  // /<cloud>/image/upload/<phần còn lại> — chỉ ảnh; đã có biến đổi sẵn (c_scale,w_500/…) thì giữ nguyên.
  const m = /^\/([^/]+)\/image\/upload\/(.+)$/.exec(u.pathname);
  if (!m || isSvg(m[2])) return "";
  if (/^[a-z]{1,3}_[^/]*\//i.test(m[2])) return u.href;
  return `https://res.cloudinary.com/${m[1]}/image/upload/c_fill,g_face,w_${SIZE},h_${SIZE},q_auto,f_jpg/${m[2]}`;
}

export function chatPushAvatar(raw: string | null | undefined): string {
  const src = (raw || "").trim();
  if (!src || src.length > 2048 || isPlaceholderAvatar(src)) return "";
  if (src.startsWith("/") && !src.startsWith("//")) {
    const path = src.split(/[?#]/)[0];
    return isSvg(path) || /[\s"'<>\\]/.test(src) ? "" : APP_ORIGIN + src;
  }
  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return "";
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return "";
  const host = u.hostname.toLowerCase();
  if (isSvg(u.pathname)) return "";
  if (host === "www.bitpawos.com" || host === "bitpawos.com") return APP_ORIGIN + u.pathname + u.search;
  if (host === "res.cloudinary.com") return cloudinarySquare(u);
  if (PROXY_HOSTS.has(host)) return `${APP_ORIGIN}/_next/image?url=${encodeURIComponent(u.href)}&w=${SIZE}&q=75`;
  return "";
}
