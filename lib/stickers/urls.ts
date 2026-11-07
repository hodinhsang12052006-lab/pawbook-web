// URL ảnh của 1 sticker. Không cần manifest cho sticker trong bộ — bong bóng tin vẽ được ngay.
//  - Noto (id = ký tự emoji): fonts.gstatic.com, GHIM phiên bản 17.0 — ảnh tĩnh SVG (vài KB) + hình động lottie.json
//    (8–90 KB, nén ~4×; phát bằng lottie-web/lottie_light — lib/stickers/lottie.ts).
//  - Fluent 3D (id "fl:…"): PNG 256px trên jsDelivr, cố định theo commit (cache 1 năm, immutable). Fluent ngoài bộ: đường dẫn
//    lấy từ manifest mở rộng (truyền `meta`).
import { FLUENT_PATH, FLUENT_SHA } from "./paths.generated";
import { NOTO_IDS, STICKER_GLYPH } from "./ids.generated";
import { MAX_STICKER_ID_LENGTH, type StickerId } from "./packs";
import type { StickerMeta } from "./manifest";

export const NOTO_VERSION = "17.0";
export const NOTO_BASE = `https://fonts.gstatic.com/s/e/notoemoji/${NOTO_VERSION}/`;
export const FLUENT_BASE = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_SHA}/assets/`;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Mã điểm theo cách đặt tên của Noto: hex thường, đệm ≥ 4 chữ số, GIỮ FE0F ("❤️" → "2764_fe0f", "©️" → "00a9_fe0f"). */
export function notoCodepoints(glyph: string): string {
  return [...glyph].map((c) => c.codePointAt(0)!.toString(16).padStart(4, "0")).join("_");
}

/** id có trong bộ (Noto hoặc Fluent trong bộ) — bong bóng tin vẽ được không cần manifest. */
export const isKnownSticker = (id: string): boolean => typeof id === "string" && has(STICKER_GLYPH, id);
/** Nội dung tin STICKER thuộc danh mục trong bộ, dài ≤ 48 ký tự. Máy chủ còn nhận Fluent ngoài bộ: lib/stickers/server.ts. */
export const isValidStickerId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= MAX_STICKER_ID_LENGTH && isKnownSticker(id);
export const stickerGlyph = (id: string): string | null => (isKnownSticker(id) ? STICKER_GLYPH[id] : null);
export const isFluent = (id: string) => id.startsWith("fl:");

// Ký tự (bỏ FE0F) → id Noto động. Dựng 1 lần khi cần.
let notoByBare: Map<string, StickerId> | null = null;
const SKIN = /[\u{1F3FB}-\u{1F3FF}]/gu;
const VS16 = /️/g;

/**
 * id nhãn động Noto cho 1 emoji gõ tay ("❤" / "❤️" → "❤️"). Noto không có biến thể màu da: `keepTone` = true (tin emoji
 * to) → emoji có màu da trả null (giữ đúng màu người gửi chọn, vẽ bằng chữ); false (gợi ý nhãn dán) → bỏ màu da rồi tra.
 */
export function notoIdFor(glyph: string, keepTone = false): StickerId | null {
  if (!glyph) return null;
  if (!notoByBare) {
    notoByBare = new Map();
    for (const id of NOTO_IDS.split(" ")) if (id) notoByBare.set(id.replace(VS16, ""), id);
  }
  const bare = glyph.replace(VS16, "");
  const hit = notoByBare.get(bare);
  if (hit) return hit;
  const toneless = bare.replace(SKIN, "");
  if (keepTone || toneless === bare) return null;
  return notoByBare.get(toneless) ?? null;
}

/** Chuỗi chỉ gồm emoji (tin STICKER cũ ngoài danh mục). */
export { isEmojiOnly } from "@/lib/chat/emojiOnly";

export const fluentUrl = (path: string) => FLUENT_BASE + path.split("/").map(encodeURIComponent).join("/");

function fluentPath(id: StickerId, meta?: StickerMeta | null): string | null {
  if (has(FLUENT_PATH, id)) return FLUENT_PATH[id];
  return meta?.src === "fl" && meta.path ? meta.path : null;
}
const isNoto = (id: StickerId, meta?: StickerMeta | null) => !isFluent(id) && (isKnownSticker(id) || meta?.src === "noto");

/** Ảnh tĩnh: Noto → emoji.svg · Fluent → PNG 3D. null nếu không vẽ được. */
export function stillUrl(id: StickerId, meta?: StickerMeta | null): string | null {
  if (isFluent(id)) {
    const p = fluentPath(id, meta);
    return p ? fluentUrl(p) : null;
  }
  return isNoto(id, meta) ? `${NOTO_BASE}${notoCodepoints(id)}/emoji.svg` : null;
}

/** Hình động: Noto → lottie.json · Fluent → null (bộ 3D là ảnh tĩnh). */
export function lottieUrl(id: StickerId, meta?: StickerMeta | null): string | null {
  return isNoto(id, meta) ? `${NOTO_BASE}${notoCodepoints(id)}/lottie.json` : null;
}

/**
 * Ảnh nhỏ trong bảng chọn: Noto → SVG (~5 KB); Fluent → /_next/image (WebP 96px, ~3–6 KB, từ chính tên miền của
 * app — next.config.ts images.remotePatterns chỉ mở đúng repo + commit này).
 */
export function thumbUrl(id: StickerId, meta?: StickerMeta | null): string | null {
  if (!isFluent(id)) return stillUrl(id, meta);
  const png = stillUrl(id, meta);
  return png ? `/_next/image?url=${encodeURIComponent(png)}&w=96&q=70` : null;
}
