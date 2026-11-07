"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { thumbUrl, stickerGlyph } from "@/lib/stickers/urls";
import { loadStickerManifest, type Manifest } from "@/lib/stickers/manifest";
import { suggestStickers } from "@/lib/stickers/suggest";

// Thanh gợi ý nhãn dán phía trên ô soạn tin (kiểu Telegram): ô soạn tin là ĐÚNG 1 emoji (hoặc "từ" cuối là 1 emoji) → các
// nhãn khớp (Noto động cùng ký tự, 3D Fluent, nhãn liên quan theo từ khoá — lib/stickers/suggest.ts). Chạm = gửi nhãn đó + bỏ
// emoji khỏi ô soạn tin (MessagesContent). Nằm TRONG khung soạn tin (khung tin co lại + dính đáy) → không bao giờ che tin cuối.
// Chỉ ảnh tĩnh nhỏ (Noto SVG vài KB / Fluent WebP 96px) — không gọi API, không tải hình động. Manifest lõi (tệp JS tĩnh của app,
// đã có trong bộ đệm nếu từng mở tab Nhãn dán) chỉ để thêm nhãn liên quan; chưa có thì thanh vẫn hiện nhãn cùng ký tự.
export default function StickerSuggest({ glyph, onPick, onDismiss }: { glyph: string; onPick: (id: string) => void; onDismiss: () => void }) {
  useTr();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    let alive = true;
    loadStickerManifest()
      .then((m) => alive && setManifest(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const ids = useMemo(() => suggestStickers(glyph, manifest, 12), [glyph, manifest]);
  if (!ids.length) return null;
  return (
    <div className="pn-stk-suggest" role="group" aria-label={tr("Gợi ý nhãn dán", "Sticker suggestions")} data-sticker-suggest={glyph}>
      <div className="pn-stk-suggest-row no-scrollbar">
        {ids.map((id) => {
          const src = thumbUrl(id, manifest?.[id]);
          const g = stickerGlyph(id) ?? manifest?.[id]?.glyph ?? glyph;
          return (
            <button
              key={id}
              type="button"
              data-sticker={id}
              // giữ bàn phím mở (như nút Gửi) — chạm nhãn không làm ô soạn tin mất tiêu điểm
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onPick(id)}
              aria-label={tr(`Gửi nhãn dán ${g}`, `Send sticker ${g}`)}
              className="pn-stk-suggest-btn"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" width={48} height={48} decoding="async" crossOrigin={src.startsWith("https://") ? "anonymous" : undefined} draggable={false} />
              ) : (
                <span aria-hidden>{g}</span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onDismiss} aria-label={tr("Ẩn gợi ý nhãn dán", "Hide sticker suggestions")} className="pn-stk-suggest-x">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
