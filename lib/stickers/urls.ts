// URL ảnh của 1 sticker. Không cần manifest (từ khoá) — bong bóng tin vẽ được ngay.
//  - Noto (id = ký tự emoji): fonts.gstatic.com, ảnh tĩnh SVG (vài KB) + bản động WebP 512px.
//  - Fluent 3D (id "fl:…"): PNG 256px trên jsDelivr, cố định theo commit (cache 1 năm, immutable).
import { FLUENT_PATH, FLUENT_SHA } from "./paths.generated";
import { STICKER_GLYPH } from "./ids.generated";
import type { StickerId } from "./packs";

export const NOTO_BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest/";
export const FLUENT_BASE = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_SHA}/assets/`;

/** Mã điểm theo cách đặt tên của Noto, GIỮ FE0F ("❤️" → "2764_fe0f", "😂" → "1f602"). */
export function notoCodepoints(glyph: string): string {
  return [...glyph].map((c) => c.codePointAt(0)!.toString(16)).join("_");
}

export const isKnownSticker = (id: string): boolean => Object.prototype.hasOwnProperty.call(STICKER_GLYPH, id);
export const stickerGlyph = (id: string): string | null => (isKnownSticker(id) ? STICKER_GLYPH[id] : null);
export const isFluent = (id: string) => id.startsWith("fl:");

function fluentPng(id: StickerId): string | null {
  const p = FLUENT_PATH[id];
  return p ? FLUENT_BASE + p.split("/").map(encodeURIComponent).join("/") : null;
}

/** Ảnh tĩnh: Noto → emoji.svg · Fluent → PNG 3D. null nếu id không có trong danh mục. */
export function stillUrl(id: StickerId): string | null {
  if (!isKnownSticker(id)) return null;
  if (isFluent(id)) return fluentPng(id);
  return `${NOTO_BASE}${notoCodepoints(id)}/emoji.svg`;
}

/** Bản động: Noto → 512.webp · Fluent → null (bộ 3D là ảnh tĩnh). */
export function animUrl(id: StickerId): string | null {
  if (!isKnownSticker(id) || isFluent(id)) return null;
  return `${NOTO_BASE}${notoCodepoints(id)}/512.webp`;
}

/**
 * Ảnh nhỏ trong bảng chọn: Noto → SVG (~8 KB); Fluent → /_next/image (WebP 96px, ~3–6 KB, từ chính tên miền của
 * app — next.config.ts images.remotePatterns chỉ mở đúng repo + commit này).
 */
export function thumbUrl(id: StickerId): string | null {
  if (!isKnownSticker(id)) return null;
  if (!isFluent(id)) return stillUrl(id);
  const png = fluentPng(id);
  return png ? `/_next/image?url=${encodeURIComponent(png)}&w=96&q=70` : null;
}
