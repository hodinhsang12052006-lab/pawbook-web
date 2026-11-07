// Emoji + sticker cho tin nhắn.
//  - EMOJI_GROUPS: bảng emoji chèn vào chữ (tab Emoji) — giữ nguyên.
//  - Sticker (tab Nhãn dán): lib/stickers/* — Noto Emoji Animation (Google, CC BY 4.0) + Microsoft Fluent Emoji 3D (MIT).
//    Tin STICKER lưu id sticker (Noto: chính ký tự emoji → tin cũ vẫn hợp lệ; Fluent: "fl:<tên>"). Máy chủ chỉ nhận id
//    có trong lib/stickers/ids.generated.ts. Ghi công: NOTICE + dòng cuối bảng sticker.
export { stillUrl, animUrl, thumbUrl, stickerGlyph, isKnownSticker, isFluent } from "@/lib/stickers/urls";
export { ANIM_PACKS, THREE_D_PACKS, SEASON_PACKS, ALL_PACKS, flId, type StickerId, type StickerPack } from "@/lib/stickers/packs";
export { activeSeasonPacks } from "@/lib/stickers/seasons";

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
