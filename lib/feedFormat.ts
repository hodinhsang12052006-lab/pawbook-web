import React from "react";
import { tr } from "@/lib/i18n/tr";

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
  return new Date(iso).toLocaleDateString(tr("vi-VN", "en-US"), { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Tách nội dung bài đăng thành đoạn text thường + hashtag (#ViecLam,
// #NailArt...) để tô màu riêng — chỉ nhận diện hiển thị, không lưu bảng
// hashtag riêng (chưa cần thiết ở quy mô hiện tại).
export function renderContentWithHashtags(text: string): React.ReactNode[] {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts.map((part, i) =>
    part.startsWith("#") && part.length > 1
      ? React.createElement("span", { key: i, className: "text-pink-400 font-semibold" }, part)
      : React.createElement(React.Fragment, { key: i }, part)
  );
}

export function roleBadgeLabel(role: string): string {
  if (role === "OWNER") return "🏪 Chủ tiệm";
  if (role === "TECHNICIAN") return "💅 Thợ Nail";
  return "👤";
}
