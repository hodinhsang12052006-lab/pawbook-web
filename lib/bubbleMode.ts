// Bong bóng chat Android ("chat heads" của hệ thống, Android 11+): app native mở 1 WebView nhỏ riêng
// (BubbleActivity) trỏ tới https://www.bitpawos.com/messages?c=<id>&bubble=1 với User-Agent có thêm
// "PawNailApp PawNailBubble". Ở chế độ này web CHỈ hiện khung chat của đúng cuộc trò chuyện đó: không thanh trên /
// thanh dưới / danh sách / lời mời cài app / bật thông báo, không đổ chuông cuộc gọi (app chính lo), link ra khỏi
// khung chat tải trang thật để app chuyển sang app chính.
//
// Nhận biết: CHỈ bằng User-Agent "PawNailBubble" trên production. ?bubble=1 chỉ có tác dụng khi chạy dev: link
// https://www.bitpawos.com/jobs?bubble=1 ai cũng gửi được trong tin nhắn — trước đây bấm vào là app chính / tab web
// kẹt ở "chế độ bong bóng" (mất thanh dưới, KHÔNG đổ chuông cuộc gọi đến) tới khi tải lại hẳn trang.
// Script đầu trang (app/[lang]/layout.tsx) đặt html[data-bubble] TRƯỚC khi vẽ (CSS ẩn các lớp phủ toàn app ngay từ
// khung hình đầu); trang /messages đọc User-Agent phía máy chủ (isBubbleRequest).
// Không có "use client" / hook: dùng được cả ở Server Component.

export const BUBBLE_UA_TOKEN = "PawNailBubble";

/** ?bubble=1 (thử bong bóng trên trình duyệt máy tính) chỉ khi không phải bản production. */
const QUERY_FLAG_ALLOWED = process.env.NODE_ENV !== "production";

export const isBubbleUserAgent = (ua: string | null | undefined) => !!ua && ua.includes(BUBBLE_UA_TOKEN);

/** Phía máy chủ: User-Agent của WebView bong bóng (dev: thêm ?bubble=1). */
export function isBubbleRequest(ua: string | null | undefined, bubbleParam: string | string[] | undefined): boolean {
  const p = Array.isArray(bubbleParam) ? bubbleParam[0] : bubbleParam;
  return isBubbleUserAgent(ua) || (QUERY_FLAG_ALLOWED && p === "1");
}

/** Đoạn JS (chạy trong try {} của script đầu trang, biến d = document.documentElement). */
export const BUBBLE_HEAD_JS = QUERY_FLAG_ALLOWED
  ? `if(navigator.userAgent.indexOf("${BUBBLE_UA_TOKEN}")>=0||/[?&]bubble=1(&|$)/.test(location.search))d.setAttribute("data-bubble","");`
  : `if(navigator.userAgent.indexOf("${BUBBLE_UA_TOKEN}")>=0)d.setAttribute("data-bubble","");`;

/** Phía trình duyệt: trang này đang chạy trong bong bóng chat? (false khi render phía máy chủ) */
export function isBubbleMode(): boolean {
  if (typeof document === "undefined") return false;
  return isBubbleUserAgent(navigator.userAgent) || (QUERY_FLAG_ALLOWED && document.documentElement.hasAttribute("data-bubble"));
}
