"use client";

import { useId, useState } from "react";
import { avatarGradient, avatarGradientClassic, initialsOf, isPlaceholderAvatar } from "@/lib/avatar";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  /** Dùng để chọn màu nền ổn định (ưu tiên id, không có thì dùng tên). */
  seed?: string | null;
  /** Lớp kích thước + viền, VD "h-10 w-10 ring-2 ring-white/10". */
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
  /** Hồ sơ chưa có ảnh: vẽ biểu tượng vai trò (mặt tiền tiệm / lọ sơn) thay cho chữ cái — chỉ dùng ở đầu trang hồ sơ */
  glyph?: "store" | "polish";
}

/**
 * Ảnh đại diện chuẩn của app: có ảnh thật → hiện ảnh; chưa có (hoặc ảnh lỗi)
 * → chữ cái đầu trên gradient. Vẽ bằng SVG nên chữ tự co giãn đúng tỉ lệ ở
 * mọi kích thước, từ 20px (dòng "đã thích") tới 128px (trang hồ sơ).
 */
export default function Avatar({ src, name, seed, className = "h-10 w-10", alt, loading = "lazy", glyph }: AvatarProps) {
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

  // Màu gốc làm thuộc tính SVG (trang khách "/" classic); trong app CSS `refined:` đổi sang bảng màu trầm.
  const [from, to] = avatarGradientClassic(seed || name);
  const [rFrom, rTo] = avatarGradient(seed || name);
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
          <stop offset="0%" stopColor={from} className="refined:[stop-color:var(--av-a)]" style={{ ["--av-a" as string]: rFrom }} />
          <stop offset="100%" stopColor={to} className="refined:[stop-color:var(--av-b)]" style={{ ["--av-b" as string]: rTo }} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gid})`} />
      {/* Ánh sáng nhẹ phía trên (classic) */}
      <ellipse cx="20" cy="6" rx="18" ry="10" fill="#fff" opacity="0.08" className="refined:hidden" />
      {/* Trong app: vệt bóng như lọ sơn + vòng trong mảnh ("monogram mẫu sơn" — biểu tượng chung, không phải mặt người) */}
      <ellipse cx="14" cy="10" rx="14" ry="8" fill="#fff" opacity="0.1" className="hidden refined:inline" />
      <circle cx="20" cy="20" r="19.5" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1" className="hidden refined:inline" />
      {glyph === "store" && (
        <g fill="none" stroke="#f6f0f5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 16.5l2-5.5h14l2 5.5" />
          <path d="M11 16.5a2.25 2.25 0 0 0 4.5 0a2.25 2.25 0 0 0 4.5 0a2.25 2.25 0 0 0 4.5 0a2.25 2.25 0 0 0 4.5 0" />
          <path d="M12.5 19v10.5h15V19" />
          <path d="M18 29.5v-5.5h4v5.5" />
        </g>
      )}
      {glyph === "polish" && (
        <g fill="none" stroke="#f6f0f5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="16.5" y="8.5" width="7" height="8" rx="1.5" />
          <path d="M17.5 16.5v2h5v-2" />
          <rect x="12.5" y="18.5" width="15" height="13" rx="4" />
          <path d="M15.5 23v4" strokeOpacity="0.55" />
        </g>
      )}
      {!glyph && <text
        x="20"
        y="20"
        dy="0.35em"
        textAnchor="middle"
        fill="#fff"
        fontSize={text.length > 1 ? 15 : 17}
        fontWeight={700}
        letterSpacing="0.5"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        className="refined:[fill:#f6f0f5] refined:[font-family:var(--font-pn),system-ui,sans-serif] refined:[font-weight:600] refined:[letter-spacing:0.2px]"
      >
        {text}
      </text>}
    </svg>
  );
}
