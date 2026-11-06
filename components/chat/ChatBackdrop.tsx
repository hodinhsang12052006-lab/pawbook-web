"use client";

// 11/2026: khung chat là 1 mặt phẳng tĩnh, chuyên nghiệp (xem .chat-wallpaper trong globals.css và
// các hình nền tuỳ chọn ở lib/chatWallpapers.ts) — không còn quầng sáng trôi / hoạ tiết / vignette
// phía sau tin nhắn. Giữ component để các chỗ gọi không phải đổi.
export default function ChatBackdrop({ theme }: { theme: string }) {
  void theme;
  return null;
}
