"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { canAnimate } from "@/lib/stickers/lottie";

/** Trình duyệt (không phải máy chủ) thiếu IntersectionObserver */
const noIo = () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined";

// GIF dạng video (MP4 của GIPHY) — dùng cho bong bóng tin và ô trong bảng GIF.
//  - Ảnh tĩnh (poster) luôn nằm dưới: khung không bao giờ trống / nhảy, kể cả khi video chưa về.
//  - <video autoplay muted loop playsinline preload="metadata"> chỉ được DỰNG khi ô ở gần vùng nhìn thấy (trong khung cuộn
//    `rootSelector`, nới 300px) → cả trăm GIF trong lịch sử không giữ cả trăm trình phát; CHẠY khi thấy ≥ 15%, DỪNG khi khuất
//    (IntersectionObserver).
//  - Giảm chuyển động / tiết kiệm dữ liệu / 2G (canAnimate() = false): chỉ ảnh tĩnh, không tải video (chạm để xem).
export default function GifVideo({
  src,
  poster,
  rootSelector,
  className = "",
  fit = "contain",
  onError,
}: {
  src: string;
  poster?: string | null;
  /** Khung cuộn chứa ô (".m-scroll", ".pn-gif-scroll") — gốc của IntersectionObserver */
  rootSelector?: string;
  className?: string;
  fit?: "contain" | "cover";
  onError?: () => void;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [anim] = useState(() => canAnimate());
  // Trình duyệt quá cũ không có IntersectionObserver → coi như luôn thấy (dựng + chạy ngay)
  const [near, setNear] = useState(noIo);
  const [visible, setVisible] = useState(noIo);

  useEffect(() => {
    const el = boxRef.current;
    if (!anim || !el || typeof IntersectionObserver === "undefined") return;
    const root = rootSelector ? el.closest(rootSelector) : null;
    const nearIo = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), { root, rootMargin: "300px 0px" });
    const visIo = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting && e.intersectionRatio >= 0.15), { root, threshold: [0, 0.15, 0.5, 1] });
    nearIo.observe(el);
    visIo.observe(el);
    return () => {
      nearIo.disconnect();
      visIo.disconnect();
    };
  }, [anim, rootSelector]);

  // React không ghi thuộc tính "muted" ra DOM — đặt cả thuộc tính lẫn property trước khi phát (chính sách tự phát).
  const setVideo = useCallback((v: HTMLVideoElement | null) => {
    videoRef.current = v;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
  }, []);

  const mounted = anim ? near : !poster;
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !anim) return;
    if (visible) v.play()?.catch(() => {});
    else v.pause();
  }, [visible, mounted, anim]);

  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  return (
    <span ref={boxRef} className={`pn-gifv ${className}`} data-gif-video="" data-playing={mounted && visible && anim ? "1" : "0"}>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" decoding="async" draggable={false} className={`pn-gifv-media ${fitClass}`} />
      )}
      {mounted && (
        <video
          ref={setVideo}
          src={src}
          poster={poster ?? undefined}
          autoPlay={anim && visible}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden
          tabIndex={-1}
          onError={onError}
          className={`pn-gifv-media ${fitClass}`}
        />
      )}
    </span>
  );
}
