// Bộ nhãn dán (sticker) của Messenger — viết tay. KHÔNG import gì: scripts/stickers/build_manifest.mjs nạp thẳng file
// này bằng Node (type stripping) để kiểm từng mục có thật trên CDN trước khi sinh manifest.
//
// Nguồn (chỉ 2 bộ có giấy phép mở, xem NOTICE):
//  - Noto Emoji Animation (Google, CC BY 4.0): id = chính ký tự emoji ("😂") → mọi tin STICKER cũ vẫn hợp lệ.
//  - Microsoft Fluent Emoji 3D (MIT): id = "fl:" + tên thư mục trong repo, viết thường, ký tự lạ → "_" ("fl:nail_polish").
// Không dùng sticker / icon của Telegram hay ứng dụng nào khác.

export type StickerId = string;
export type PackKind = "anim" | "3d" | "season";
export type Season =
  | "halloween"
  | "fall_us"
  | "thanksgiving_us"
  | "spring_au"
  | "christmas_us"
  | "christmas_au"
  | "newyear"
  | "tet"
  | "valentine"
  | "women"
  | "mothers_day"
  | "midautumn";

export interface StickerPack {
  id: string;
  /** [vi, en] */
  label: [string, string];
  icon: StickerId;
  kind: PackKind;
  items: StickerId[];
  season?: Season;
}

/** Tên thư mục Fluent → id ("Star-struck" → "fl:star_struck", "1st place medal" → "fl:1st_place_medal"). */
export function flId(folder: string): StickerId {
  return "fl:" + folder.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
export const isFluentId = (id: string) => id.startsWith("fl:");
export const MAX_STICKER_ID_LENGTH = 48;

const g = (s: string): StickerId[] => s.split(" ").filter(Boolean);
const fl = (...folders: string[]): StickerId[] => folders.map(flId);
const pack = (id: string, label: [string, string], kind: PackKind, items: StickerId[], icon?: StickerId, season?: Season): StickerPack => ({
  id,
  label,
  kind,
  items,
  icon: icon ?? items[0],
  ...(season ? { season } : {}),
});

// ---- Hoạt hình (Noto) ----
export const ANIM_PACKS: StickerPack[] = [
  pack("feelings", ["Cảm xúc", "Feelings"], "anim", g("😂 🤣 🥹 🥰 😍 😘 😭 🥺 😡 😱 🤯 🤩 🥳 😎 🤔 🙄 😴 🤗 🤭 😳 😅 😊 😇 🥲 😮 💀 🙈 🫠 😉 😋 😜 🤪 😏 😬 🤤 🥱 😤 🫡 🫣 😵‍💫 🤧 😷 🥶 🥵 😈"), "😂"),
  pack("hands", ["Cử chỉ", "Hands"], "anim", g("👍 👎 👏 🙌 🙏 🫶 👋 🤝 💪 🤌 ✌️ 🤞 👌 🫰 ✍️ 💅 🤙 👀 🫵 ☝️"), "👍"),
  pack("hearts", ["Tim & lấp lánh", "Hearts & sparkle"], "anim", g("❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🩷 💔 ❤️‍🔥 💕 💞 💖 💘 💝 💯 ✨ 🔥 ⭐ 🌟 💫 🌈 💥"), "❤️"),
  pack("party", ["Tiệc tùng", "Party"], "anim", g("🎉 🎊 🥳 🎁 🎈 🍾 🥂 🎂 🎆 🪩 🪅 🏆 🥇 🎓 🍀"), "🎉"),
  pack("animals", ["Thú cưng", "Animals"], "anim", g("😺 😹 😻 🐱 🐕 🦊 🐼 🦄 🦁 🐧 🦉 🐻 🐣 🐥 🦋 🐾 🦘 🐉 🐢 🐙 🐬 🐳 🐝 🐌"), "😺"),
  pack("food", ["Ăn uống", "Food & drink"], "anim", g("☕ 🧋 🍜 🍕 🍔 🍩 🍪 🍓 🍉 🥑 🌮 🍿 🍷 🍦"), "🧋"),
];

// ---- 3D (Fluent) ----
export const THREE_D_PACKS: StickerPack[] = [
  pack("beauty", ["Nail & làm đẹp", "Nails & beauty"], "3d", fl("Nail polish", "Lipstick", "Kiss mark", "Ring", "Gem stone", "Crown", "Ribbon", "Mirror", "Lotion bottle", "Soap", "Bubbles", "Sparkles", "Woman getting massage", "Woman getting haircut", "Woman in steamy room", "Dress", "High-heeled shoe", "Handbag", "Shopping bags", "Bouquet", "Cherry blossom", "Hibiscus", "Tulip", "Rose", "Butterfly", "Hair pick", "Sponge"), flId("Nail polish")),
  pack("salon", ["Đời tiệm nail", "Salon life"], "3d", fl("Spiral calendar", "Calendar", "Alarm clock", "Hourglass not done", "Money bag", "Dollar banknote", "Credit card", "Receipt", "Telephone receiver", "Mobile phone", "Round pushpin", "Check mark button", "Hundred points", "Thumbs up", "Clapping hands", "Flexed biceps", "Folded hands", "Bubble tea", "Hot beverage", "Steaming bowl", "Sleeping face", "Rocket", "Chart increasing", "Trophy", "Star", "Glowing star", "Door"), flId("Spiral calendar")),
  pack("celebrate", ["Ăn mừng", "Celebrate"], "3d", fl("Party popper", "Confetti ball", "Partying face", "Balloon", "Wrapped gift", "Birthday cake", "Cupcake", "Bottle with popping cork", "Clinking glasses", "Fireworks", "Sparkler", "Trophy", "Sports medal", "1st place medal", "Star-struck", "Glowing star", "Mirror ball", "Raising hands"), flId("Party popper")),
  pack("love", ["Yêu thương", "Love"], "3d", fl("Red heart", "Sparkling heart", "Two hearts", "Revolving hearts", "Heart with ribbon", "Heart with arrow", "Growing heart", "Beating heart", "Heart hands", "Smiling face with hearts", "Smiling face with heart-eyes", "Face blowing a kiss", "Love letter", "Kiss mark", "Rose", "Hugging face", "Pink heart", "Heart on fire", "Heart decoration"), flId("Sparkling heart")),
  pack("thanks", ["Cảm ơn", "Thanks"], "3d", fl("Folded hands", "Smiling face with hearts", "Hugging face", "Bouquet", "Thumbs up", "Ok hand", "Clapping hands", "Raising hands", "Heart hands", "Saluting face", "Hundred points", "Check mark button", "Glowing star", "Sunflower", "Tulip", "Face holding back tears", "Smiling face with halo", "Handshake"), flId("Folded hands")),
  pack("work", ["Công việc", "Work"], "3d", fl("Briefcase", "Laptop", "Spiral calendar", "Memo", "Clipboard", "Pushpin", "Chart increasing", "Money bag", "Handshake", "Light bulb", "Rocket", "Alarm clock", "Hot beverage", "Check mark button", "Megaphone", "Bell", "Envelope", "Telephone", "Thinking face", "Saluting face", "Flexed biceps"), flId("Briefcase")),
];

// ---- Theo mùa (hiện theo ngày + thị trường của người xem — lib/stickers/seasons.ts). Noto đứng đầu → bộ có hình động ----
const WOMEN_ITEMS = [...g("💐 🌹 🌷"), ...fl("Bouquet", "Tulip", "Rose", "Sunflower", "Woman", "Crown", "Heart with ribbon", "Wrapped gift", "Smiling face with hearts", "Sparkles")];
export const SEASON_PACKS: StickerPack[] = [
  pack("halloween", ["Halloween", "Halloween"], "season", [...g("🎃 👻"), ...fl("Jack-o-lantern", "Ghost", "Bat", "Spider web", "Candy", "Lollipop", "Skull", "Black cat")], undefined, "halloween"),
  pack("thanksgiving_us", ["Lễ Tạ ơn", "Thanksgiving"], "season", fl("Turkey", "Fallen leaf", "Maple leaf", "Pie", "Ear of corn", "Poultry leg", "Folded hands", "Smiling face with hearts", "Leaf fluttering in wind"), undefined, "thanksgiving_us"),
  pack("fall_us", ["Mùa thu", "Fall"], "season", [...g("🍂 🍁"), ...fl("Fallen leaf", "Maple leaf", "Hot beverage", "Chestnut", "Mushroom", "Scarf", "Pie", "Leaf fluttering in wind")], undefined, "fall_us"),
  pack("spring_au", ["Mùa xuân", "Spring"], "season", [...g("🌸 🌷"), ...fl("Sunflower", "Blossom", "Tulip", "Hibiscus", "Sun", "Butterfly", "Honeybee", "Beach with umbrella", "Ice cream", "Tropical drink")], undefined, "spring_au"),
  pack("christmas_us", ["Giáng sinh", "Christmas"], "season", [...g("❄️ ⛄ ☃️"), ...fl("Christmas tree", "Santa claus", "Snowman", "Snowman without snow", "Snowflake", "Wrapped gift", "Bell", "Deer", "Gloves", "Candle", "Cookie", "Hot beverage", "Star", "Mx claus")], undefined, "christmas_us"),
  pack("christmas_au", ["Giáng sinh mùa hè", "Summer Christmas"], "season", fl("Christmas tree", "Santa claus", "Beach with umbrella", "Sun", "Watermelon", "Shaved ice", "Crab", "Kangaroo", "Koala", "Sunflower", "Tropical drink"), undefined, "christmas_au"),
  pack("newyear", ["Năm mới", "New Year"], "season", [...g("🎆 🍾 🥂"), ...fl("Fireworks", "Sparkler", "Bottle with popping cork", "Clinking glasses", "Party popper", "Calendar", "Twelve oclock", "Confetti ball")], undefined, "newyear"),
  // Con giáp của năm chèn vào vị trí thứ 4 lúc hiển thị (TET_ZODIAC, seasons.ts)
  pack("tet", ["Tết", "Lunar New Year"], "season", fl("Red envelope", "Red paper lantern", "Firecracker", "Tangerine", "Cherry blossom", "Blossom", "Coin", "Money bag", "Fireworks", "Dragon", "Wind chime"), undefined, "tet"),
  pack("valentine", ["Valentine", "Valentine's"], "season", [...g("💘 💝 💖 💕"), ...fl("Heart with ribbon", "Love letter", "Rose", "Chocolate bar", "Kiss mark", "Heart with arrow", "Bouquet", "Smiling face with heart-eyes")], undefined, "valentine"),
  pack("women", ["Ngày Phụ nữ", "Women's Day"], "season", WOMEN_ITEMS, undefined, "women"),
  pack("mothers_day", ["Ngày của Mẹ", "Mother's Day"], "season", WOMEN_ITEMS, undefined, "mothers_day"),
  pack("midautumn", ["Trung thu", "Mid-Autumn"], "season", fl("Moon cake", "Full moon", "Red paper lantern", "Rabbit face", "Rabbit", "Star", "Teacup without handle"), undefined, "midautumn"),
];

/** Con giáp theo năm Tết (âm lịch). */
export const TET_ZODIAC: Record<number, StickerId> = {
  2027: flId("Goat"),
  2028: flId("Monkey"),
  2029: flId("Rooster"),
  2030: flId("Dog"),
};

/** Sticker của bộ cũ (trước 11/2026) không còn trong bộ nào — vẫn vẽ được tin cũ + tìm được, nhưng không hiện thành bộ. */
export const LEGACY_IDS: StickerId[] = g("💸");

export const ALL_PACKS: StickerPack[] = [...SEASON_PACKS, ...ANIM_PACKS, ...THREE_D_PACKS];

/** Mọi id có trong ít nhất 1 bộ (kể cả bộ mùa + con giáp) hoặc trong LEGACY_IDS — đây là danh sách máy chủ chấp nhận. */
export function allStickerIds(): StickerId[] {
  const out = new Set<StickerId>();
  for (const p of ALL_PACKS) {
    out.add(p.icon);
    for (const i of p.items) out.add(i);
  }
  for (const z of Object.values(TET_ZODIAC)) out.add(z);
  for (const l of LEGACY_IDS) out.add(l);
  return [...out];
}
