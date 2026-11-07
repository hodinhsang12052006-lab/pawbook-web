// Dòng xem trước của 1 tin không phải chữ (danh sách chat, thông báo trong app). Gọi lúc render (tr()).
import { tr } from "@/lib/i18n/tr";
import { STICKER_GLYPH } from "@/lib/stickers/ids.generated";
import { isGifUrl } from "./gif";

/** null = tin chữ (dùng nội dung như cũ). Sticker lạ (không có trong danh mục) chỉ hiện "Sticker" — không lộ chuỗi thô. */
export function mediaPreview(type: string | null | undefined, body: string | null | undefined): string | null {
  const b = body || "";
  switch (type) {
    case "IMAGE":
      return isGifUrl(b) ? tr("GIF", "GIF") : tr("📷 Ảnh", "📷 Photo");
    case "VIDEO":
      return "🎬 Video";
    case "AUDIO":
      return tr("🎤 Tin nhắn thoại", "🎤 Voice message");
    case "STICKER": {
      const glyph = Object.prototype.hasOwnProperty.call(STICKER_GLYPH, b) ? STICKER_GLYPH[b] : "";
      return `${glyph} ${tr("Nhãn dán", "Sticker")}`.trim();
    }
    default:
      return null;
  }
}
