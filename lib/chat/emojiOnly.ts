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

// ---------- Tách emoji theo "cụm ký tự" (grapheme) ----------
// 1 emoji = 1 trong các dạng:
//   - mũ phím: [#*0-9] (+FE0F) + U+20E3 ("1️⃣", "#️⃣")
//   - cờ: 2 ký tự chỉ vùng ("🇻🇳")
//   - ký tự hình (+FE0F / màu da) (+ chuỗi thẻ: cờ England 🏴󠁧󠁢󠁥󠁮󠁧󠁿) (+ ZWJ + ký tự hình …): "👍🏽", "❤️‍🔥", "👨‍👩‍👧‍👦", "🫱🏻‍🫲🏿"
// Ký tự hình mặc định dạng CHỮ (không FE0F, không Emoji_Presentation) chỉ tính là emoji từ U+2600 (☺ ♥ ✌ ✈ ❤ …) —
// "©", "®", "™", "‼", "↔", "▶" một mình vẫn là chữ. FE0E (ép dạng chữ) → không phải emoji.
const PIC = String.raw`\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}){0,2}`;
const ONE = new RegExp(String.raw`[#*0-9]️?⃣|\p{Regional_Indicator}{2}|${PIC}(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:‍${PIC})*`, "uy");
const SPACE = /\s+/y;
const TEXT_DEFAULT = /^\p{Extended_Pictographic}$/u;
const PRESENTS = /\p{Emoji_Presentation}/u;

function emojiLike(g: string): boolean {
  if (!TEXT_DEFAULT.test(g) || PRESENTS.test(g)) return true;
  return g.codePointAt(0)! >= 0x2600;
}

/**
 * Tách `s` thành các emoji (bỏ khoảng trắng giữa chúng). null nếu có ký tự KHÔNG phải emoji, rỗng, hoặc nhiều hơn `max`.
 * "😂" → ["😂"] · "👍🏽 ❤️" → ["👍🏽", "❤️"] · "🇻🇳" → ["🇻🇳"] · "haha 😂" → null.
 */
export function emojiGraphemes(s: unknown, max = 3): string[] | null {
  if (typeof s !== "string" || !s || s.length > 24 * max) return null;
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    SPACE.lastIndex = i;
    if (SPACE.test(s)) {
      i = SPACE.lastIndex;
      continue;
    }
    ONE.lastIndex = i;
    const m = ONE.exec(s);
    if (!m || !emojiLike(m[0])) return null;
    out.push(m[0]);
    if (out.length > max) return null;
    i = ONE.lastIndex;
  }
  return out.length ? out : null;
}

/** Cờ quốc gia (2 ký tự chỉ vùng, "🇻🇳"). Windows không có hình cờ (Segoe UI Emoji vẽ 2 chữ "VN") → 1 cờ không vẽ cỡ 92px. */
export function isFlagEmoji(g: string): boolean {
  return /^\p{Regional_Indicator}{2}$/u.test(g);
}

/** Tin chữ chỉ gồm 1–3 emoji → vẽ TO (kiểu Telegram). Trả về số emoji (1–3) hoặc 0. */
export function bigEmojiCount(s: unknown): number {
  return emojiGraphemes(s, 3)?.length ?? 0;
}

/**
 * Gợi ý nhãn dán theo ô soạn tin: cả ô là ĐÚNG 1 emoji, hoặc "từ" cuối (sau khoảng trắng cuối) là đúng 1 emoji
 * ("hehe 😂"). Trả về emoji đó (giữ nguyên FE0F / màu da) hoặc null. Chỉ đọc phần cuối chuỗi → rẻ ở mỗi phím gõ.
 */
export function trailingEmoji(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trimEnd();
  if (!t) return null;
  let start = t.length;
  while (start > 0 && !/\s/.test(t[start - 1])) start--;
  const token = t.slice(start);
  if (token.length > 24) return null;
  return emojiGraphemes(token, 1)?.[0] ?? null;
}
