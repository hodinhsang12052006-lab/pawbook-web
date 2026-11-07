import { isPlaceholderAvatar } from "@/lib/avatar";

// Dữ liệu thông báo đẩy cho TIN NHẮN CHAT (app/api/messages → lib/push.ts → lib/fcm.ts). Hàm thuần — kiểm thử ở
// scripts/qa/fcm_payload_unit.mts.

/** Gốc của app native (capacitor.config.ts server.url) — URL trong thông báo luôn trỏ về đây, kể cả khi chạy QA local. */
export const APP_ORIGIN = "https://www.bitpawos.com";

/** Mở ĐÚNG cuộc trò chuyện này (1-1 lẫn nhóm). Trước đây là /messages?to=<người gửi> → bấm thông báo của nhóm lại mở chat riêng với người gửi. */
export const chatPushUrl = (conversationId: string) => `/messages?c=${encodeURIComponent(conversationId)}`;

type ConvLike = { isGroup?: boolean | null; name?: string | null; participants?: { id: string; name?: string | null }[] };

// Ký tự định hướng (bidi) / độ rộng 0 trong tên tự đặt: đảo thứ tự hiển thị, giả làm người khác trong thông báo. Giữ
// ZWJ / ZWNJ (emoji ghép, chữ Ba Tư). App Android lọc thêm lần nữa (ChatNotifications.cleanName).
const SPOOF_CHARS = /[\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
export const cleanDisplayName = (s: string | null | undefined) => String(s ?? "").replace(SPOOF_CHARS, "").trim();

/** Nhóm chưa đặt tên: tiêu đề ghép từ tên thành viên và KHÁC NHAU theo người nhận (bỏ chính người nhận). */
export const isUnnamedGroup = (conv: ConvLike) => !!conv.isGroup && !cleanDisplayName(conv.name);

/**
 * Tiêu đề cuộc trò chuyện nhìn từ người nhận `viewerId`: tên nhóm (nhóm chưa đặt tên → "Lan, Mai, Hoa +2" gồm các
 * thành viên KHÁC người nhận, như Messenger), hoặc tên người gửi (1-1).
 */
export function chatPushTitle(conv: ConvLike, senderName: string, viewerId?: string): string {
  const sender = cleanDisplayName(senderName);
  if (!conv.isGroup) return sender;
  const named = cleanDisplayName(conv.name);
  if (named) return named;
  const firsts = (conv.participants || [])
    .filter((p) => !viewerId || p.id !== viewerId)
    .map((p) => cleanDisplayName(p.name).split(/\s+/)[0])
    .filter(Boolean);
  if (!firsts.length) return sender;
  return firsts.slice(0, 3).join(", ") + (firsts.length > 3 ? ` +${firsts.length - 3}` : "");
}

/**
 * Tiêu đề dạng thông báo CŨ (web, iPhone, app Android cũ — chỉ có 1 dòng tiêu đề + nội dung): 1-1 = người gửi; nhóm =
 * "Người gửi · Tên nhóm"; nhóm chưa đặt tên = "Người gửi · các thành viên còn lại" (không lặp người gửi, không có chính
 * người nhận).
 */
export function chatPushLegacyTitle(conv: ConvLike, senderName: string, senderId: string, viewerId?: string): string {
  const sender = cleanDisplayName(senderName);
  if (!conv.isGroup) return sender;
  const named = cleanDisplayName(conv.name);
  if (named) return `${sender} · ${named}`;
  const others = chatPushTitle({ ...conv, participants: (conv.participants || []).filter((p) => p.id !== senderId) }, "", viewerId);
  return others ? `${sender} · ${others}` : sender;
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

// Ảnh trên chính bitpawos.com: điện thoại người NHẬN tải kèm cookie phiên của họ → chỉ đường dẫn ẢNH (/_next/image,
// /uploads/…, file .png/.jpg/.webp/.gif/.avif), không bao giờ /api/… hay /auth/… (GET có tác dụng phụ dưới danh nghĩa
// người nhận — avatarUrl do người gửi tự đặt). Khớp ChatAvatars.isImagePathOnOwnSite của app Android.
export function isOwnImagePath(path: string): boolean {
  const p = path.toLowerCase();
  if (p.includes("..") || p.includes("%") || p.includes("//")) return false;
  if (p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/admin")) return false;
  if (p === "/_next/image" || p.startsWith("/uploads/")) return true;
  return /^\/[a-z0-9/_.-]+\.(png|jpe?g|webp|gif|avif)$/.test(p);
}

export function chatPushAvatar(raw: string | null | undefined): string {
  const src = (raw || "").trim();
  if (!src || src.length > 2048 || isPlaceholderAvatar(src)) return "";
  if (src.startsWith("/") && !src.startsWith("//")) {
    const path = src.split(/[?#]/)[0];
    return isSvg(path) || /[\s"'<>\\]/.test(src) || !isOwnImagePath(path) ? "" : APP_ORIGIN + src;
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
  if (host === "www.bitpawos.com" || host === "bitpawos.com") return isOwnImagePath(u.pathname) ? APP_ORIGIN + u.pathname + u.search : "";
  if (host === "res.cloudinary.com") return cloudinarySquare(u);
  if (PROXY_HOSTS.has(host)) return `${APP_ORIGIN}/_next/image?url=${encodeURIComponent(u.href)}&w=${SIZE}&q=75`;
  return "";
}
