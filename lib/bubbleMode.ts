// Bong bóng chat Android ("chat heads" của hệ thống, Android 11+): app native mở 1 WebView nhỏ riêng
// (BubbleActivity) trỏ tới https://www.bitpawos.com/messages?c=<id>&bubble=1 với User-Agent có thêm
// "PawNailApp PawNailBubble". Ở chế độ này web CHỈ hiện khung chat của đúng cuộc trò chuyện đó: không thanh trên /
// thanh dưới / danh sách / lời mời cài app / bật thông báo, không đổ chuông cuộc gọi (app chính lo), link ra khỏi
// khung chat tải trang thật để app chuyển sang app chính.
//
// Nhận biết: script đầu trang (app/[lang]/layout.tsx) đặt html[data-bubble] TRƯỚC khi vẽ (CSS ẩn các lớp phủ toàn
// app ngay từ khung hình đầu); trang /messages đọc User-Agent / ?bubble=1 phía máy chủ (isBubbleRequest).
// Không có "use client" / hook: dùng được cả ở Server Component.

export const BUBBLE_UA_TOKEN = "PawNailBubble";

export const isBubbleUserAgent = (ua: string | null | undefined) => !!ua && ua.includes(BUBBLE_UA_TOKEN);

/** Phía máy chủ: User-Agent của WebView bong bóng, hoặc ?bubble=1 (thử trên trình duyệt). */
export function isBubbleRequest(ua: string | null | undefined, bubbleParam: string | string[] | undefined): boolean {
  const p = Array.isArray(bubbleParam) ? bubbleParam[0] : bubbleParam;
  return isBubbleUserAgent(ua) || p === "1";
}

/** Đoạn JS (chạy trong try {} của script đầu trang, biến d = document.documentElement). */
export const BUBBLE_HEAD_JS = `if(navigator.userAgent.indexOf("${BUBBLE_UA_TOKEN}")>=0||/[?&]bubble=1(&|$)/.test(location.search))d.setAttribute("data-bubble","");`;

/** Phía trình duyệt: trang này đang chạy trong bong bóng chat? (false khi render phía máy chủ) */
export function isBubbleMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute("data-bubble") || isBubbleUserAgent(navigator.userAgent);
}
