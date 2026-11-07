// Dòng xem trước của 1 tin không phải chữ (danh sách chat, thông báo trong app). Gọi lúc render (tr()).
import { tr } from "@/lib/i18n/tr";
import { STICKER_GLYPH } from "@/lib/stickers/ids.generated";
import { isEmojiOnly } from "./emojiOnly";
import { isGifUrl } from "./gif";

/**
 * null = tin chữ (dùng nội dung như cũ). Sticker: "<emoji> Sticker". Tin sticker cũ ngoài danh mục mà chỉ là emoji
 * (🐶, 💼 — bộ cũ 07–10/2026) vẫn hiện emoji; chuỗi lạ khác chỉ hiện "Sticker" — không lộ chuỗi thô.
 */
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
      const glyph = Object.prototype.hasOwnProperty.call(STICKER_GLYPH, b) ? STICKER_GLYPH[b] : isEmojiOnly(b) ? b : "";
      return `${glyph} ${tr("Nhãn dán", "Sticker")}`.trim();
    }
    default:
      return null;
  }
}
