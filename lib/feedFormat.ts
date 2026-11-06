import React from "react";
import { tr, currentLocale } from "@/lib/i18n/tr";

// "5 phút trước" / "2 giờ trước" / "3 ngày trước" — không kéo thêm date-fns
// chỉ cho 1 hàm nhỏ này.
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return tr("Vừa xong", "Just now");
  if (mins < 60) return tr(`${mins} phút trước`, `${mins}m ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr(`${hours} giờ trước`, `${hours}h ago`);
  const days = Math.floor(hours / 24);
  if (days < 7) return tr(`${days} ngày trước`, `${days}d ago`);
  return shortDate(iso);
}

/** Ngày tháng bằng chữ, không mơ hồ giữa Mỹ / Úc: "Oct 2" · "2 Oct" (en-AU) · "2 thg 10"; thêm năm khi khác năm nay.
 *  (Trước đây "10/02/2026": người dùng Úc đọc thành 10 tháng 2.) */
export function shortDate(iso: string | Date, market?: string | null): string {
  const d = new Date(iso);
  let loc = "vi-VN";
  if (currentLocale() === "en") {
    const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
    loc = market === "AU" ? "en-AU" : market === "US" ? "en-US" : /^en-(AU|NZ|GB)/i.test(nav) ? "en-AU" : "en-US";
  }
  return d.toLocaleDateString(loc, d.getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

// Tách nội dung bài đăng thành đoạn text thường + hashtag (#ViecLam,
// #NailArt...) để tô màu riêng — chỉ nhận diện hiển thị, không lưu bảng
// hashtag riêng (chưa cần thiết ở quy mô hiện tại).
// Hashtag tô màu + link https:// bấm được (mở tab mới, rel an toàn; chỉ https, cắt gọn khi hiển thị).
export function renderContentWithHashtags(text: string): React.ReactNode[] {
  const parts = text.split(/(https:\/\/[^\s<>"']+|#[\p{L}\p{N}_]+)/gu);
  return parts.map((part, i) => {
    if (part.startsWith("https://")) {
      const url = part.replace(/[.,;:!?)\]]+$/, "");
      const tail = part.slice(url.length);
      let label = url;
      try { const u = new URL(url); label = u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? "/…" : ""); } catch {}
      return React.createElement(
        React.Fragment,
        { key: i },
        React.createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow", className: "font-semibold text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200", onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() }, label),
        tail,
      );
    }
    return part.startsWith("#") && part.length > 1
      ? React.createElement("span", { key: i, className: "text-pink-400 font-semibold" }, part)
      : React.createElement(React.Fragment, { key: i }, part);
  });
}

export function roleBadgeLabel(role: string): string {
  if (role === "OWNER") return tr("Chủ tiệm", "Salon owner");
  if (role === "TECHNICIAN") return tr("Thợ nail", "Nail tech");
  return tr("Thành viên", "Member");
}
