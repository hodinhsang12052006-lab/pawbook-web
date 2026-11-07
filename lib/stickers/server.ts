// Kiểm tin STICKER phía MÁY CHỦ: id trong bộ (ids.generated.ts) HOẶC 1 thư mục Fluent 3D ngoài bộ (manifestExt.generated.ts —
// tìm thấy trong ô tìm của bảng sticker). File này chỉ import ở route API (không vào bundle trình duyệt).
import { MAX_STICKER_ID_LENGTH } from "./packs";
import { STICKER_GLYPH } from "./ids.generated";
import { FLUENT_EXT } from "./manifestExt.generated";
import { parseFluentExt } from "./manifest";

let ext: Map<string, string> | null = null;
function extGlyphs(): Map<string, string> {
  if (!ext) ext = new Map(parseFluentExt(FLUENT_EXT).map(([id, glyph]) => [id, glyph]));
  return ext;
}
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Ký tự emoji của 1 id sticker hợp lệ (để ghi xem trước thông báo); null nếu id không thuộc danh mục. */
export function serverStickerGlyph(id: string): string | null {
  if (has(STICKER_GLYPH, id)) return STICKER_GLYPH[id];
  return id.startsWith("fl:") ? extGlyphs().get(id) ?? null : null;
}

/** Nội dung tin STICKER máy chủ chấp nhận. */
export function isAllowedStickerId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_STICKER_ID_LENGTH && serverStickerGlyph(id) !== null;
}
