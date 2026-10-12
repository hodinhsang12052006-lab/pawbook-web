// Sticker hoạt hình cho tin nhắn — "Noto Emoji Animation" của Google (giấy phép CC BY 4.0, ghi công
// trong bảng sticker). Tin sticker lưu CHỈ ký tự emoji (type STICKER, ≤ 16 ký tự) → máy nhận tự vẽ
// bản hoạt hình; không có / không tải được thì hiện emoji to. Danh sách dưới đây đã kiểm tra tồn tại
// trên fonts.gstatic.com (10/2026) — emoji không có bản hoạt hình (🐶, 🐰, 🎄…) không đưa vào.

export interface StickerPack {
  id: string;
  label: [string, string]; // [vi, en]
  icon: string;
  items: string[];
}

export const STICKER_PACKS: StickerPack[] = [
  { id: "feel", label: ["Cảm xúc", "Feelings"], icon: "😂", items: ["😂", "🤣", "🥰", "😍", "😘", "😭", "🥺", "😡", "😱", "🤯", "🤩", "🥳", "😎", "🤔", "🙄", "😴", "🤗", "🤭", "😳", "😅", "😊", "😇", "🥲", "😮", "💀", "🙈", "👋"] },
  { id: "salon", label: ["Tiệm nail", "Salon"], icon: "💅", items: ["💅", "✨", "🔥", "💖", "💯", "👏", "🙏", "💸", "👍", "💪", "🎉", "🎁", "⭐", "🌈", "🌸"] },
  { id: "pets", label: ["Thú cưng", "Pets"], icon: "😺", items: ["😺", "😹", "😻", "🐕", "🦊", "🐼", "🦄", "🦁", "🐧", "🦉"] },
  { id: "party", label: ["Lễ hội", "Holidays"], icon: "🎃", items: ["🎃", "👻", "🎆", "❤️", "💘", "🎂", "🍾", "🥳", "🎉", "🎁"] },
];

const ANIMATED = new Set(STICKER_PACKS.flatMap((p) => p.items));

/** Mã điểm của emoji theo cách đặt tên của Noto ("❤️" → "2764_fe0f", "😂" → "1f602"). */
function codepoints(emoji: string): string {
  const cps = [...emoji].map((c) => c.codePointAt(0)!.toString(16));
  // Noto bỏ FE0F ở emoji đơn (trừ vài ngoại lệ như ❤️) — giữ nguyên chuỗi đầy đủ cho các ký tự đã liệt kê.
  return cps.join("_");
}

/** URL bản hoạt hình (webp) — null nếu emoji không có trong bộ sticker. */
export function stickerUrl(emoji: string): string | null {
  if (!ANIMATED.has(emoji)) return null;
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoints(emoji)}/512.webp`;
}

// Bảng emoji chèn vào chữ — chia nhóm như bàn phím điện thoại.
export const EMOJI_GROUPS: { id: string; label: [string, string]; icon: string; items: string[] }[] = [
  { id: "smileys", label: ["Mặt cười", "Smileys"], icon: "😀", items: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🫡 🤔 🫢 🤭 🤫 🤥 😶 🫠 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(" ") },
  { id: "hands", label: ["Cử chỉ", "Gestures"], icon: "👍", items: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪".split(" ") },
  { id: "hearts", label: ["Tim", "Hearts"], icon: "❤️", items: "❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 🩷 🩵 🩶 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💋 💯 💢 💥 💫 ✨ 🌟 ⭐ 🔥".split(" ") },
  { id: "beauty", label: ["Nail & làm đẹp", "Nails & beauty"], icon: "💅", items: "💅 💄 💋 👄 🪞 🧴 🧼 🪮 💇‍♀️ 💆‍♀️ 👑 💍 💎 👜 👛 👠 👡 👗 👙 🎀 🌸 🌺 🌷 🌹 🌼 🦋 🫧 🧖‍♀️ 🛍️ 💐".split(" ") },
  { id: "food", label: ["Ăn uống", "Food"], icon: "🧋", items: "🧋 ☕ 🍵 🥤 🧃 🍹 🍺 🍻 🥂 🍾 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🥖 🥪 🍕 🍔 🍟 🌮 🥗 🍓 🍉 🍌 🍑 🥭 🍰 🎂 🧁 🍩 🍪 🍫 🍦".split(" ") },
  { id: "fun", label: ["Vui chơi & lễ", "Fun & holidays"], icon: "🎉", items: "🎉 🎊 🥳 🎁 🎈 🎂 🎃 👻 🎄 🎅 🧧 🏮 🎆 🎇 🧨 💘 💝 🌕 🏖️ ✈️ 🚗 🏠 🏪 💼 💰 💵 💸 📱 📸 🎵 🎶 🏆 🥇 ⚽ 🏀".split(" ") },
  { id: "animals", label: ["Động vật", "Animals"], icon: "🐶", items: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐢 🐙 🐠 🐬 🐳".split(" ") },
];
