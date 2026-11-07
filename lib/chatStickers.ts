// Emoji + sticker cho tin nhắn.
//  - EMOJI_GROUPS: bảng emoji chèn vào chữ (tab Emoji) — giữ nguyên.
//  - Sticker (tab Nhãn dán): lib/stickers/* — Noto Emoji Animation (Google, CC BY 4.0) + Microsoft Fluent Emoji 3D (MIT).
//    Tin STICKER lưu id sticker (Noto: chính ký tự emoji → tin cũ vẫn hợp lệ; Fluent: "fl:<tên>"). Máy chủ chỉ nhận id
//    có trong lib/stickers/ids.generated.ts. Ghi công: NOTICE + dòng cuối bảng sticker.
export { stillUrl, lottieUrl, thumbUrl, stickerGlyph, isKnownSticker, isFluent } from "@/lib/stickers/urls";
export { ANIM_PACKS, THREE_D_PACKS, SEASON_PACKS, ALL_PACKS, type StickerId, type StickerPack } from "@/lib/stickers/catalog";
export { flId } from "@/lib/stickers/packs";
export { activeSeasonPacks } from "@/lib/stickers/seasons";

// Emoji 14 / 15 (2021–2022): WebView Android ≤ 12 vẽ thành ô trống ("tofu") vì font hệ thống chưa có → không đưa vào
// bảng chèn CHỮ (bản sticker Noto vẫn có ở tab Nhãn dán vì là ảnh).
const TOO_NEW = new Set("🫠 🫡 🫣 🫢 🫶 🫰 🫧 🩷 🩵 🩶 🪮 🫵 🥹 🫤 🫥 🫨 🫦 🫱 🫲 🫳 🫴 🫷 🫸".split(" "));
const ok = (s: string) => s.split(" ").filter((e) => e && !TOO_NEW.has(e));

// Bảng emoji chèn vào chữ — chia nhóm như bàn phím điện thoại.
export const EMOJI_GROUPS: { id: string; label: [string, string]; icon: string; items: string[] }[] = [
  { id: "smileys", label: ["Mặt cười", "Smileys"], icon: "😀", items: ok("😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🫡 🤔 🫢 🤭 🤫 🤥 😶 🫠 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕") },
  { id: "hands", label: ["Cử chỉ", "Gestures"], icon: "👍", items: ok("👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪") },
  { id: "hearts", label: ["Tim", "Hearts"], icon: "❤️", items: ok("❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 🩷 🩵 🩶 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💋 💯 💢 💥 💫 ✨ 🌟 ⭐ 🔥") },
  { id: "beauty", label: ["Nail & làm đẹp", "Nails & beauty"], icon: "💅", items: ok("💅 💄 💋 👄 🪞 🧴 🧼 🪮 💇‍♀️ 💆‍♀️ 👑 💍 💎 👜 👛 👠 👡 👗 👙 🎀 🌸 🌺 🌷 🌹 🌼 🦋 🫧 🧖‍♀️ 🛍️ 💐") },
  { id: "food", label: ["Ăn uống", "Food"], icon: "🧋", items: ok("🧋 ☕ 🍵 🥤 🧃 🍹 🍺 🍻 🥂 🍾 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🥖 🥪 🍕 🍔 🍟 🌮 🥗 🍓 🍉 🍌 🍑 🥭 🍰 🎂 🧁 🍩 🍪 🍫 🍦") },
  { id: "fun", label: ["Vui chơi & lễ", "Fun & holidays"], icon: "🎉", items: ok("🎉 🎊 🥳 🎁 🎈 🎂 🎃 👻 🎄 🎅 🧧 🏮 🎆 🎇 🧨 💘 💝 🌕 🏖️ ✈️ 🚗 🏠 🏪 💼 💰 💵 💸 📱 📸 🎵 🎶 🏆 🥇 ⚽ 🏀") },
  { id: "animals", label: ["Động vật", "Animals"], icon: "🐶", items: ok("🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐢 🐙 🐠 🐬 🐳") },
];
