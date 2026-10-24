"use client";

// Lớp HOẠ TIẾT của 1 mẫu (french, ombre, hoa, đá, chrome line…) đặt đúng từng móng thật đã nhận. Chỉ là SVG
// ẩn để chuyển thành điểm ảnh — bộ máy ảnh thật (lib/tryon/engine) phủ lớp này lên móng, cho nhận ánh
// sáng của ảnh và cắt đúng mép móng thật. Màu nền / hiệu ứng / bóng đều do bộ máy vẽ, không vẽ ở đây.
import React, { forwardRef, useId } from "react";
import { NAIL, Motif, hash } from "@/components/designs/NailArt";
import { hasMotif, motifTransform, type StudioLook } from "@/lib/studio";
import type { Crop, NailInfo } from "@/lib/tryon/session";

const TryOnMotif = forwardRef<SVGSVGElement, { look: StudioLook; nails: NailInfo[]; crop: Crop }>(function TryOnMotif({ look, nails, crop }, ref) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const colors = look.palette.length ? look.palette : ["#ec4899", "#a855f7", "#d4af37"];
  const c2 = colors[1] ?? colors[0];
  const metal = colors[2] ?? colors[1] ?? "#d4af37";
  const path = NAIL[look.shape] ?? NAIL.almond;
  const rnd = hash(look.id + look.pattern);
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={crop.w} height={crop.h} viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}>
      <defs>
        {/* id dùng chung với các hoạ tiết của NailArt (ombre / aura / baby boomer / chrome) */}
        <linearGradient id={`om${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c2} /><stop offset="55%" stopColor={c2} stopOpacity="0" /></linearGradient>
        <radialGradient id={`au${uid}`}><stop offset="0%" stopColor={c2} /><stop offset="100%" stopColor={c2} stopOpacity="0" /></radialGradient>
        <linearGradient id={`bb${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8fafc" /><stop offset="35%" stopColor="#f8fafc" stopOpacity="0.85" /><stop offset="80%" stopColor="#f8fafc" stopOpacity="0" /></linearGradient>
        <linearGradient id={`cr${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="40%" stopColor={metal} /><stop offset="60%" stopColor="#ffffff" /><stop offset="100%" stopColor={metal} /></linearGradient>
      </defs>
      {nails.map((n, i) =>
        hasMotif(look.pattern, n.accent, nails.length) ? (
          <g key={i} transform={motifTransform(n.geo)}>
            <Motif pattern={look.pattern} c2={c2} metal={metal} i={i} rnd={rnd} uid={uid} outline={path} />
          </g>
        ) : null,
      )}
    </svg>
  );
});

export default TryOnMotif;
