// Chuỗi chỉ gồm emoji (≤ 16 ký tự) — tin STICKER cũ ngoài danh mục (🐶, 💼) vẫn vẽ bằng emoji chữ. Không import gì
// (dùng ở lib/chat/preview.ts — nằm trong bundle chung qua UnreadMessagesContext).
export function isEmojiOnly(s: unknown): s is string {
  return (
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= 16 &&
    /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|️|‍|⃣)+$/u.test(s) &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s)
  );
}
