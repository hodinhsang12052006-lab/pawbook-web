"use client";

// 1 mẫu vẽ lên ảnh tay thật: mỗi móng = dáng móng chuẩn (NailArt) đặt đúng góc + độ dài móng thật,
// sơn màu theo hiệu ứng (bóng / nhám / chrome / mắt mèo / nhũ), hoạ tiết trên ngón trỏ + áp út (hoặc mọi
// ngón với hoạ tiết toàn bộ), bóng đổ chân móng + 2 mép, vệt bóng, viền mềm để hoà vào ảnh.
import React, { forwardRef, useId } from "react";
import { NAIL, ACCENT, ALL_NAILS, Motif, hash } from "@/components/designs/NailArt";
import { nailTransform, type NailMark, type StudioLook } from "@/lib/studio";

interface Props {
  href: string; // ảnh tay (blob: để xem, data: khi xuất ảnh)
  w: number; h: number;
  marks: NailMark[];
  look: StudioLook;
  crop: { x: number; y: number; size: number };
  widthRatio: number;
  lengthFactor: number;
  className?: string;
}

const TryOnLook = forwardRef<SVGSVGElement, Props>(function TryOnLook({ href, w, h, marks, look, crop, widthRatio, lengthFactor, className = "" }, ref) {
  const uid = useId().replace(/:/g, "");
  const colors = look.palette.length ? look.palette : ["#ec4899", "#a855f7", "#d4af37"];
  const c2 = colors[1] ?? colors[0];
  const metal = colors[2] ?? colors[1] ?? "#d4af37";
  const path = NAIL[look.shape] ?? NAIL.almond;
  const rnd = hash(look.id + look.pattern);
  const finish = look.finish;
  const pattern = look.pattern;
  const baseFill = (i: number) =>
    pattern === "tortoise" ? "#b45309" : pattern === "babyboomer" ? "#f2c4c4" : pattern === "milkbath" ? "#f8fafc" : pattern === "negative" ? "#f3d6c8"
    : `url(#n${uid}${pattern === "mixmatch" && (i === 2 || i === 3) ? 1 : 0})`;

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox={`${crop.x} ${crop.y} ${crop.size} ${crop.size}`} className={className} role="img" aria-label={look.title.vi}>
      <defs>
        {[colors[0], c2].map((c, i) => (
          <linearGradient key={i} id={`n${uid}${i}`} x1="0" y1="0" x2={finish === "cateye" ? "1" : "0"} y2="1">
            {finish === "chrome" ? (
              <><stop offset="0%" stopColor="#ffffff" /><stop offset="35%" stopColor={c} /><stop offset="55%" stopColor="#ffffff" stopOpacity="0.9" /><stop offset="100%" stopColor={c} /></>
            ) : finish === "cateye" ? (
              <><stop offset="0%" stopColor={c} /><stop offset="42%" stopColor={c} /><stop offset="55%" stopColor="#fff7ed" stopOpacity="0.95" /><stop offset="70%" stopColor={c} /><stop offset="100%" stopColor={c} /></>
            ) : (
              // Sơn ĐẶC (gel thật che kín móng cũ) — độ trong cũ làm lộ màu móng gốc ở chân móng
              <><stop offset="0%" stopColor={c} /><stop offset="100%" stopColor={c} /></>
            )}
          </linearGradient>
        ))}
        {/* id dùng chung với các hoạ tiết của NailArt (ombre / aura / baby boomer / chrome) */}
        <linearGradient id={`om${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c2} /><stop offset="55%" stopColor={c2} stopOpacity="0" /></linearGradient>
        <radialGradient id={`au${uid}`}><stop offset="0%" stopColor={c2} /><stop offset="100%" stopColor={c2} stopOpacity="0" /></radialGradient>
        <linearGradient id={`bb${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8fafc" /><stop offset="35%" stopColor="#f8fafc" stopOpacity="0.85" /><stop offset="80%" stopColor="#f8fafc" stopOpacity="0" /></linearGradient>
        <linearGradient id={`cr${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="40%" stopColor={metal} /><stop offset="60%" stopColor="#ffffff" /><stop offset="100%" stopColor={metal} /></linearGradient>
        {/* bóng chân móng + 2 mép cong → móng có khối, không phẳng như dán sticker */}
        <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#000" stopOpacity="0" /><stop offset="80%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.3" /></linearGradient>
        <linearGradient id={`sd${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#000" stopOpacity="0.24" /><stop offset="20%" stopColor="#000" stopOpacity="0" /><stop offset="80%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.24" /></linearGradient>
        <clipPath id={`clip${uid}`}><path d={path} /></clipPath>
        <filter id={`soft${uid}`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.35" /></filter>
      </defs>
      <image href={href} xlinkHref={href} x="0" y="0" width={w} height={h} preserveAspectRatio="none" />
      {marks.map((m, i) => {
        const drawMotif = pattern !== "solid" && pattern !== "mixmatch" && (ALL_NAILS.has(pattern) || ACCENT.has(i) || marks.length < 3);
        return (
          <g key={i} transform={nailTransform(m, widthRatio, lengthFactor)} opacity={0.97}>
            <g filter={`url(#soft${uid})`}>
              <path d={path} fill={baseFill(i)} fillOpacity={pattern === "jelly" ? 0.6 : pattern === "negative" ? 0.5 : 1} />
              {drawMotif && (
                <g clipPath={`url(#clip${uid})`}>
                  <Motif pattern={pattern} c2={c2} metal={metal} i={i} rnd={rnd} uid={uid} outline={path} />
                </g>
              )}
              {finish === "glitter" && (
                <g clipPath={`url(#clip${uid})`}>
                  {Array.from({ length: 18 }).map((_, k) => <circle key={k} cx={2 + rnd() * 22} cy={4 + rnd() * 60} r={0.5 + rnd() * 1.1} fill={k % 3 ? "#fef3c7" : "#ffffff"} opacity={0.8} />)}
                </g>
              )}
              <g clipPath={`url(#clip${uid})`}>
                <rect x="-2" y="-6" width="30" height="82" fill={`url(#sd${uid})`} />
                <rect x="-2" y="-6" width="30" height="82" fill={`url(#sh${uid})`} />
              </g>
              {finish !== "matte" && <path d="M6 24 Q6.5 13 11 9" stroke="#ffffff" strokeOpacity={finish === "chrome" ? 0.85 : 0.5} strokeWidth="2.4" strokeLinecap="round" fill="none" />}
            </g>
            <path d={path} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.6" />
          </g>
        );
      })}
    </svg>
  );
});

export default TryOnLook;
