"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { isVideoUrl } from "@/lib/mediaUpload";
import { gifAspect, gifMediaSrc, gifStill, isGifVideo } from "@/lib/chat/gif";
import { canAnimate } from "@/lib/stickers/lottie";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

/** Xem ảnh/video toàn màn hình: phím ←/→/Esc, vuốt trái/phải trên điện thoại. */
export default function MediaLightbox({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  useTr(); // render lại khi đổi VI/EN
  const startX = useRef<number | null>(null);
  const [gifAnim] = useState(() => canAnimate());
  const go =(d: number) => onIndex((index + d + urls.length) % urls.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const url = urls[index];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Xem ảnh / video", "Photo / video viewer")}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/95 animate-fadeIn"
      onClick={onClose}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="max-h-[88vh] max-w-[94vw]" onClick={(e) => e.stopPropagation()}>
        {isGifVideo(url) ? (
          // GIF dạng MP4 (GIPHY): lặp, tắt tiếng, không thanh điều khiển — như GIF. Giảm chuyển động / tiết kiệm dữ liệu → có
          // thanh điều khiển, không tự chạy (người xem tự bấm phát).
          <video
            key={url}
            src={gifMediaSrc(url)}
            poster={gifStill(url) ?? undefined}
            autoPlay={gifAnim}
            loop
            muted
            playsInline
            controls={!gifAnim}
            aria-label="GIF"
            className="max-h-[88vh] max-w-[94vw] rounded-xl"
            style={{ aspectRatio: String(gifAspect(url) ?? 1), width: "min(94vw, 480px)" }}
          />
        ) : isVideoUrl(url) ? (
          <video key={url} src={url} controls autoPlay playsInline className="max-h-[88vh] max-w-[94vw] rounded-xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="" className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain" />
        )}
      </div>
      <button onClick={onClose} aria-label={tr("Đóng", "Close")} className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
      {urls.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={tr("Ảnh trước", "Previous")} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block"><ChevronLeft className="h-6 w-6" /></button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={tr("Ảnh sau", "Next")} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block"><ChevronRight className="h-6 w-6" /></button>
          <span className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">{index + 1} / {urls.length}</span>
        </>
      )}
    </div>
  );
}
