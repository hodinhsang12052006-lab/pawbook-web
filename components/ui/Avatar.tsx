"use client";

import { useId, useState } from "react";
import { avatarGradient, initialsOf, isPlaceholderAvatar } from "@/lib/avatar";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  /** Dùng để chọn màu nền ổn định (ưu tiên id, không có thì dùng tên). */
  seed?: string | null;
  /** Lớp kích thước + viền, VD "h-10 w-10 ring-2 ring-white/10". */
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
}

/**
 * Ảnh đại diện chuẩn của app: có ảnh thật → hiện ảnh; chưa có (hoặc ảnh lỗi)
 * → chữ cái đầu trên gradient. Vẽ bằng SVG nên chữ tự co giãn đúng tỉ lệ ở
 * mọi kích thước, từ 20px (dòng "đã thích") tới 128px (trang hồ sơ).
 */
export default function Avatar({ src, name, seed, className = "h-10 w-10", alt, loading = "lazy" }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const gid = useId();
  const showImage = !broken && !isPlaceholderAvatar(src);

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src!}
        alt={alt ?? name ?? ""}
        loading={loading}
        onError={() => setBroken(true)}
        className={`flex-shrink-0 rounded-full bg-slate-800 object-cover ${className}`}
      />
    );
  }

  const [from, to] = avatarGradient(seed || name);
  const text = initialsOf(name);
  return (
    <svg
      viewBox="0 0 40 40"
      // alt="" = ảnh trang trí (tên đã hiện bên cạnh) → ẩn khỏi trình đọc màn hình.
      {...(alt === "" ? { "aria-hidden": true } : { role: "img", "aria-label": alt ?? name ?? "Ảnh đại diện" })}
      className={`flex-shrink-0 rounded-full ${className}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gid})`} />
      {/* Ánh sáng nhẹ phía trên cho có chiều sâu */}
      <ellipse cx="20" cy="6" rx="18" ry="10" fill="#fff" opacity="0.08" />
      <text
        x="20"
        y="20"
        dy="0.35em"
        textAnchor="middle"
        fill="#fff"
        fontSize={text.length > 1 ? 15 : 17}
        fontWeight={700}
        letterSpacing="0.5"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
      >
        {text}
      </text>
    </svg>
  );
}
