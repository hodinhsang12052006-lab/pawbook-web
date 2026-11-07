// Kiểm thử THUẦN (không mạng, không DB) cho nhãn dán / GIF / hình nền chat:
//   danh mục (611 emoji động Noto + Fluent 3D) · id + tính duy nhất · URL ghim Noto 17.0 · bộ theo mùa (ngày + thị trường,
//   bỏ trùng) · tìm EN / VI (CLDR) không dấu + bỏ trùng theo ký tự · kiểm id phía máy chủ · tin sticker cũ (emoji chữ) ·
//   isGifUrl · chuyển hình nền cũ (pn_chat_wp → pn_wp:v2:<user>) · xoá ảnh nền · ChatKey · giới hạn số hình động cùng lúc.
//   npx tsx scripts/qa/stickers_unit.mts
import { ALL_PACKS, ANIM_PACKS, SEASON_PACKS, THREE_D_PACKS, TET_ZODIAC, allStickerIds } from "../../lib/stickers/catalog";
import { flId, LEGACY_IDS, MAX_STICKER_ID_LENGTH } from "../../lib/stickers/packs";
import { activeSeasonsOn, activeSeasonPacks, thanksgivingDay } from "../../lib/stickers/seasons";
import { searchStickers } from "../../lib/stickers/search";
import * as CORE from "../../lib/stickers/manifest.generated";
import * as EXT from "../../lib/stickers/manifestExt.generated";
import { buildManifest, fluentPathFor, isExtFluentId } from "../../lib/stickers/manifest";
import { NOTO_IDS, STICKER_GLYPH } from "../../lib/stickers/ids.generated";
import { FLUENT_PATH } from "../../lib/stickers/paths.generated";
import { NOTO_VERSION } from "../../lib/stickers/catalog.generated";
import { isValidStickerId, lottieUrl, stillUrl, thumbUrl, NOTO_BASE } from "../../lib/stickers/urls";
import { isAllowedStickerId, serverStickerGlyph } from "../../lib/stickers/server";
import { makeSlots } from "../../lib/stickers/lottie";
import { isEmojiOnly } from "../../lib/chat/emojiOnly";
import { isGifUrl, gifAspect } from "../../lib/chat/gif";
import { gifQueryEn } from "../../lib/gifQueryVi";
import { mediaPreview } from "../../lib/chat/preview";
import { EMOJI_GROUPS } from "../../lib/chatStickers";
import { setTrLocale } from "../../lib/i18n/tr";
import {
  CHAT_WALLPAPERS,
  LEGACY_WP_KEY,
  chatKeyOf,
  migrateLegacyWallpaper,
  prunePhotos,
  readWpState,
  removePhoto,
  resolveChoice,
  wpStorageKey,
  MAX_PHOTOS,
} from "../../lib/chatWallpapers";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};
const STICKERS = buildManifest(CORE);
const FULL = buildManifest(CORE, EXT);
const bare = (g: string) => g.replace(/️/g, "");

// ---------- 1. id + danh mục ----------
ok("S1", "Slug Fluent: 'Nail polish' → fl:nail_polish, '1st place medal' → fl:1st_place_medal, 'Star-struck' → fl:star_struck, 'Santa claus' → fl:santa_claus",
  flId("Nail polish") === "fl:nail_polish" && flId("1st place medal") === "fl:1st_place_medal" && flId("Star-struck") === "fl:star_struck" && flId("Santa claus") === "fl:santa_claus");
const ids = allStickerIds();
ok("S2", "Mọi id duy nhất, ≤ 48 ký tự", new Set(ids).size === ids.length && ids.every((i) => i.length <= MAX_STICKER_ID_LENGTH), ids.length);
const missing = ids.filter((i) => !STICKERS[i] || !STICKER_GLYPH[i] || (i.startsWith("fl:") && !FLUENT_PATH[i]));
ok("S3", `Mọi mục của mọi bộ (${ALL_PACKS.length} bộ, ${ids.length} id) có trong manifest + ids + paths đã sinh, và ngược lại`, !missing.length && Object.keys(STICKER_GLYPH).length === ids.length, missing.slice(0, 10));
ok("S4", "10 bộ hoạt hình (đầu tiên: 'Lấp lánh' / 'Glam') + 6 bộ 3D + 12 bộ theo mùa; con giáp 2027–2030",
  ANIM_PACKS.length === 10 && ANIM_PACKS[0].id === "glam" && ANIM_PACKS[0].label.join("|") === "Lấp lánh|Glam" && THREE_D_PACKS.length === 6 && SEASON_PACKS.length === 12 && Object.keys(TET_ZODIAC).join() === "2027,2028,2029,2030",
  ANIM_PACKS.map((p) => p.id));
const notoInPacks = new Set(ANIM_PACKS.flatMap((p) => p.items));
const glam = "💅 💍 💎 👑 💋 🌹 💐 🌷 🌸 🦋 ✨ 🫧 💖 💃 📸 🎁 💸 ⏰".split(" ");
ok("S4b", `Danh mục dày: ${notoInPacks.size} emoji động Noto trong các bộ hoạt hình (≥ 611), không bộ hoạt hình nào có Fluent; Glam = 18 mục động đúng thứ tự`,
  notoInPacks.size >= 611 && ANIM_PACKS.every((p) => p.items.every((i) => !i.startsWith("fl:"))) && ANIM_PACKS[0].items.join(" ") === glam.join(" "),
  notoInPacks.size);
const animIds = ANIM_PACKS.flatMap((p) => p.items);
ok("S4c", "Không mục nào lặp giữa / trong các bộ hoạt hình", new Set(animIds.map(bare)).size === animIds.length, animIds.length);
const searchable = Object.keys(FULL).length;
const flExt = Object.keys(FULL).filter((k) => k.startsWith("fl:")).length;
ok("S4d", `Tìm được trên ${searchable} sticker (≥ 611 Noto + ≥ 1500 thư mục Fluent 3D)`, Object.values(FULL).filter((m) => m.src === "noto").length >= 611 && flExt >= 1500, { searchable, flExt });
const oldIds = "😂 🤣 🥰 😍 😘 😭 🥺 😡 😱 🤯 🤩 🥳 😎 🤔 🙄 😴 🤗 🤭 😳 😅 😊 😇 🥲 😮 💀 🙈 👋 💅 ✨ 🔥 💖 💯 👏 🙏 💸 👍 💪 🎉 🎁 ⭐ 🌈 🌸 😺 😹 😻 🐕 🦊 🐼 🦄 🦁 🐧 🦉 🍂 ❄️ ⛄ 🎆 🍾 ❤️ 💘 🎂 🎃 👻".split(" ");
const lostOld = oldIds.filter((i) => !isValidStickerId(i));
ok("S5", "Mọi sticker của bộ sticker động cũ (66 emoji, tin STICKER đã gửi) vẫn hợp lệ", !lostOld.length, lostOld);
const legacyMock = "🚀 💎 🚗 🛠️".split(" ");
ok("S5b", "Sticker của bộ MOCK cũ (07–10/2026) có bản Noto → vẫn vẽ bằng ảnh: 🚀 💎 🚗 🛠️ hợp lệ (LEGACY_IDS)",
  legacyMock.every((i) => isValidStickerId(i) && LEGACY_IDS.includes(i) && !!stillUrl(i)), legacyMock.map((i) => [i, isValidStickerId(i)]));
ok("S6", `URL Noto GHIM phiên bản ${NOTO_VERSION} (không 'latest'): ảnh tĩnh emoji.svg + hình động lottie.json; Fluent → jsDelivr ghim commit + ô nhỏ /_next/image w=96 q=70; Fluent không có hình động`,
  NOTO_VERSION === "17.0" && NOTO_BASE === "https://fonts.gstatic.com/s/e/notoemoji/17.0/" &&
    stillUrl("😂") === "https://fonts.gstatic.com/s/e/notoemoji/17.0/1f602/emoji.svg" &&
    lottieUrl("❤️") === "https://fonts.gstatic.com/s/e/notoemoji/17.0/2764_fe0f/lottie.json" &&
    lottieUrl("🛠️") === "https://fonts.gstatic.com/s/e/notoemoji/17.0/1f6e0_fe0f/lottie.json" &&
    stillUrl("fl:nail_polish") === "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/Nail%20polish/Default/3D/nail_polish_3d_default.png" &&
    lottieUrl("fl:nail_polish") === null &&
    /^\/_next\/image\?url=https%3A%2F%2Fcdn\.jsdelivr\.net%2F.*&w=96&q=70$/.test(thumbUrl("fl:nail_polish") || ""),
  [stillUrl("😂"), lottieUrl("❤️"), stillUrl("fl:nail_polish"), thumbUrl("fl:nail_polish")]);
const allUrls = NOTO_IDS.split(" ").flatMap((i) => [stillUrl(i) || "", lottieUrl(i) || ""]);
ok("S6b", `Mọi id Noto (${NOTO_IDS.split(" ").length}) → URL /17.0/, không còn 512.webp`, allUrls.every((u) => u.startsWith(NOTO_BASE) && !/512\.webp|\/latest\//.test(u)));
ok("S7", "Fluent ngoài bộ: đường dẫn suy từ tên thư mục ('Baby' → Baby/Default/3D/baby_3d_default.png, 'Airplane' → Airplane/3D/airplane_3d.png); vẽ được bằng manifest mở rộng",
  fluentPathFor("Baby", "d") === "Baby/Default/3D/baby_3d_default.png" && fluentPathFor("Airplane", "") === "Airplane/3D/airplane_3d.png" &&
    isExtFluentId("fl:baby") && !isExtFluentId("fl:nail_polish") && FULL["fl:baby"]?.path === "Baby/Default/3D/baby_3d_default.png" &&
    stillUrl("fl:baby", FULL["fl:baby"]) === "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/Baby/Default/3D/baby_3d_default.png" && stillUrl("fl:baby") === null,
  FULL["fl:baby"]);

// ---------- 2. Máy chủ: kiểm id tin STICKER ----------
ok("V1", "Máy chủ nhận 'fl:nail_polish', '💅', '🛠️' và Fluent ngoài bộ 'fl:baby'; từ chối 'hello', '<img>', '', id quá dài, 'fl:not_a_sticker', '__proto__', '🐶' (không có trong danh mục mới)",
  isAllowedStickerId("fl:nail_polish") && isAllowedStickerId("💅") && isAllowedStickerId("🛠️") && isAllowedStickerId("fl:baby") && serverStickerGlyph("fl:baby") === "👶" &&
    !isAllowedStickerId("hello") && !isAllowedStickerId("<img src=x>") && !isAllowedStickerId("") && !isAllowedStickerId("fl:" + "a".repeat(60)) && !isAllowedStickerId("fl:not_a_sticker") &&
    !isAllowedStickerId("toString") && !isAllowedStickerId("__proto__") && !isAllowedStickerId("fl:__proto__") && !isAllowedStickerId("🐶"));

// ---------- 3. Bộ theo mùa ----------
const s = (y: number, m: number, d: number, mk: "US" | "AU") => activeSeasonsOn([y, m, d], mk);
ok("M1", "07/11/2026 — Mỹ: [Lễ Tạ ơn, Mùa thu]; Úc: [Mùa xuân]; không còn Halloween", JSON.stringify(s(2026, 11, 7, "US")) === '["thanksgiving_us","fall_us"]' && JSON.stringify(s(2026, 11, 7, "AU")) === '["spring_au"]', { us: s(2026, 11, 7, "US"), au: s(2026, 11, 7, "AU") });
ok("M2", "Halloween 15–31/10 cả 2 thị trường, hết ngày 01/11", s(2026, 10, 15, "US").includes("halloween") && s(2026, 10, 31, "AU").includes("halloween") && !s(2026, 11, 1, "US").includes("halloween") && !s(2026, 10, 14, "US").includes("halloween"));
const tg = new Date(thanksgivingDay(2026) * 86_400_000);
ok("M3", "Lễ Tạ ơn 2026 = 26/11 (thứ Năm thứ 4) → bộ hiện tới 27/11, mất ngày 28/11", tg.getUTCDate() === 26 && s(2026, 11, 27, "US").includes("thanksgiving_us") && !s(2026, 11, 28, "US").includes("thanksgiving_us"));
const tet = (m: number, d: number) => s(2027, m, d, "US").includes("tet");
ok("M4", "Tết 2027 (06/02): bộ Tết từ 16/01 tới 21/02, ngoài khoảng thì không", tet(1, 16) && tet(2, 21) && !tet(1, 15) && !tet(2, 22));
ok("M5", "Năm mới 26/12 → 07/01 (qua năm), mọi thị trường", s(2026, 12, 26, "AU").includes("newyear") && s(2027, 1, 7, "US").includes("newyear") && !s(2027, 1, 8, "US").includes("newyear"));
ok("M6", "Giáng sinh: Mỹ có tuyết, Úc 'Giáng sinh mùa hè' (01–26/12)", s(2026, 12, 10, "US").includes("christmas_us") && !s(2026, 12, 10, "US").includes("christmas_au") && s(2026, 12, 10, "AU").includes("christmas_au"));
ok("M7", "Ngày của Mẹ 2027 (CN thứ 2 tháng 5 = 09/05): từ 02/05 tới 09/05; Trung thu 2027 (15/09): 01/09 → 16/09", s(2027, 5, 2, "AU").includes("mothers_day") && s(2027, 5, 9, "US").includes("mothers_day") && !s(2027, 5, 10, "US").includes("mothers_day") && s(2027, 9, 1, "US").includes("midautumn") && s(2027, 9, 16, "US").includes("midautumn") && !s(2027, 9, 17, "US").includes("midautumn"));
const tetPack = activeSeasonPacks(new Date(2027, 0, 20), "US").find((p) => p.id === "tet");
ok("M8", "Bộ Tết 2027 chèn con giáp Dê (fl:goat) ở vị trí thứ 4", tetPack?.items[3] === "fl:goat", tetPack?.items.slice(0, 5));
const nov = activeSeasonPacks(new Date(2026, 10, 7), "US");
const [tgv, fall] = [nov.find((p) => p.id === "thanksgiving_us"), nov.find((p) => p.id === "fall_us")];
const glyphOf = (i: string) => bare(STICKER_GLYPH[i] ?? i);
const tgGlyphs = new Set((tgv?.items ?? []).map(glyphOf));
const dupInPack = (items: string[]) => {
  const noto = new Set(items.filter((i) => !i.startsWith("fl:")).map(glyphOf));
  return items.filter((i) => i.startsWith("fl:") && noto.has(glyphOf(i)));
};
ok("M9", "Tháng 11 ở Mỹ: Lễ Tạ ơn mở đầu bằng 🥧 🌽 🍂 🍁 (động) rồi gà tây 3D; Mùa thu không lặp mục nào của Lễ Tạ ơn; không bộ nào có bản 3D trùng ký tự với mục động",
  tgv?.items.slice(0, 5).join(" ") === "🥧 🌽 🍂 🍁 fl:turkey" && !!fall && fall.items.every((i) => !tgGlyphs.has(glyphOf(i))) && nov.every((p) => !dupInPack(p.items).length),
  { tg: tgv?.items, fall: fall?.items });

// ---------- 4. Tìm kiếm ----------
const q = (t: string) => searchStickers(t, FULL);
ok("Q1", "'cam on' (không dấu) / 'cảm ơn' / 'cám ơn' → 🙏 đứng đầu (tuyển tay) + bộ Cảm ơn", q("cam on")[0] === "🙏" && q("cảm ơn")[0] === "🙏" && q("cảm ơn").includes("fl:bouquet") && q("cám ơn").length > 5, q("cam on").slice(0, 6));
ok("Q2", "'móng' → 💅 (Noto, động) đứng trước; 'chuc mung' → 🎉 (bản động trước bản 3D)", q("móng")[0] === "💅" && q("chuc mung").includes("🎉"), { mong: q("móng").slice(0, 4), cm: q("chuc mung").slice(0, 4) });
ok("Q3", "Tiếng Anh: 'heart' ra ❤️ trước; 'pizza' → 🍕; 'santa' → fl:santa_claus (bộ ngoài mùa vẫn tìm được)", q("heart")[0] === "❤️" && q("pizza")[0] === "🍕" && q("santa").includes("fl:santa_claus"), q("heart").slice(0, 3));
ok("Q4", "'tết' → bao lì xì + con giáp; chuỗi vô nghĩa → rỗng", q("tết").includes("fl:red_envelope") && q("tết").includes("fl:goat") && q("zzqxv").length === 0);
const thin = ["music", "baby", "beer", "plane", "house", "rain"].map((t) => [t, q(t).length] as const);
ok("Q5", "Các từ trước đây không ra gì giờ có kết quả: music, baby, beer, plane, house, rain", thin.every(([, n]) => n > 0), thin);
const thank = q("thank");
const firstDup = thank.findIndex((id, i) => thank.slice(0, i).some((x) => glyphOf(x) === glyphOf(id)));
const head = firstDup < 0 ? thank : thank.slice(0, firstDup);
ok("Q6", "Bỏ trùng theo ký tự: 'thank' → 🙏 chỉ 1 lần trong phần kết quả chính (bản động Noto), bản 3D trùng ký tự xếp sau mọi kết quả khác",
  thank[0] === "🙏" && head.filter((i) => glyphOf(i) === "🙏").length === 1 && new Set(head.map(glyphOf)).size === head.length && (!thank.includes("fl:folded_hands") || thank.indexOf("fl:folded_hands") >= head.length),
  thank.slice(0, 12));
ok("Q7", "Tên + từ khoá tiếng Việt từ Unicode CLDR: 🙏 = 'chắp tay', 💅 = 'sơn móng tay'; tìm 'mèo' → 🐱, 'bia' → 🍻, 'chap tay' → 🙏",
  FULL["🙏"].vi[0] === "chắp tay" && FULL["💅"].vi[0] === "sơn móng tay" && q("mèo").includes("🐱") && q("bia").includes("🍻") && q("chap tay")[0] === "🙏",
  { pray: FULL["🙏"].vi, cat: q("mèo").slice(0, 5), beer: q("bia").slice(0, 5) });

// ---------- 5. GIF + xem trước ----------
ok("G1", "isGifUrl: media*.giphy.com / i.giphy.com / media.tenor.com → GIF; Cloudinary / http / host lạ → không",
  isGifUrl("https://media2.giphy.com/media/abc/200w.webp#wh=200x150") && isGifUrl("https://i.giphy.com/x.gif") && isGifUrl("https://media.tenor.com/x/tinygif.gif") && !isGifUrl("https://res.cloudinary.com/x/image/upload/a.gif") && !isGifUrl("http://media.giphy.com/x.gif") && !isGifUrl("https://giphy.com.evil.io/x.gif"));
ok("G2", "Tỉ lệ từ #wh: 480x270 → 16:9; không có #wh → null", Math.abs((gifAspect("https://media.giphy.com/a.webp#wh=480x270") ?? 0) - 480 / 270) < 1e-9 && gifAspect("https://media.giphy.com/a.webp") === null);
ok("G3", "Tìm GIF tiếng Việt quá ít kết quả → từ tiếng Anh: 'cam on' → thank you, 'sinh nhật' → happy birthday, câu lạ → null", gifQueryEn("cam on") === "thank you" && gifQueryEn("Sinh Nhật") === "happy birthday" && gifQueryEn("abc") === null);
setTrLocale("en");
const p1 = mediaPreview("IMAGE", "https://media.giphy.com/media/a/200w.webp#wh=200x150");
const p2 = mediaPreview("STICKER", "fl:nail_polish");
const p3 = mediaPreview("STICKER", "not-a-sticker");
const p6 = mediaPreview("STICKER", "🐶");
const p7 = mediaPreview("STICKER", "💼");
const p8 = mediaPreview("STICKER", "<b>x</b>");
setTrLocale("vi");
const p4 = mediaPreview("STICKER", "😂");
const p5 = mediaPreview("IMAGE", "https://media.giphy.com/media/a/200w.webp");
setTrLocale("en");
ok("G4", "Xem trước trong danh sách: GIF → 'GIF'; sticker → '💅 Sticker' / '😂 Nhãn dán'; tin sticker cũ chỉ là emoji (🐶, 💼) → '🐶 Sticker'; chuỗi lạ → 'Sticker' (không lộ chuỗi thô)",
  p1 === "GIF" && p2 === "💅 Sticker" && p3 === "Sticker" && p4 === "😂 Nhãn dán" && p5 === "GIF" && p6 === "🐶 Sticker" && p7 === "💼 Sticker" && p8 === "Sticker",
  [p1, p2, p3, p4, p5, p6, p7, p8]);
ok("G5", "isEmojiOnly: 🐶 · 🛠️ · 👍🏽 · ❤️‍🔥 → có; 'hi', '🐶hi', '', '<b>', '1' → không",
  ["🐶", "🛠️", "👍🏽", "❤️‍🔥"].every(isEmojiOnly) && !["hi", "🐶hi", "", "<b>", "1", "#"].some(isEmojiOnly));
const tofu = "🫠 🫡 🫣 🫶 🫰 🫧 🩷 🩵 🩶 🪮".split(" ");
ok("G6", "Bảng chèn emoji chữ không có emoji 14/15 (ô trống trên WebView Android ≤ 12)", EMOJI_GROUPS.every((g) => g.items.every((e) => !tofu.includes(e))));

// ---------- 6. Hình nền ----------
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;
(globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true };
ok("W1", "16 nền: 8 id cũ giữ nguyên + 8 nền mới; có nền sáng (Ngọc trai) và chỉ nền tối mới đổi màu thanh trên; 'Lagoon' = 'Đầm phá'",
  CHAT_WALLPAPERS.length === 16 && ["default", "nails", "rose", "aurora", "glitter", "marble", "ocean", "champagne", "ink", "mocha", "sage", "terrazzo", "lattice", "dusk", "lagoon", "pearl"].every((id) => CHAT_WALLPAPERS.some((w) => w.id === id)) &&
    CHAT_WALLPAPERS.find((w) => w.id === "pearl")!.tone === "light" && !("--chat-bar-bg" in CHAT_WALLPAPERS.find((w) => w.id === "pearl")!.style) && "--chat-bar-bg" in CHAT_WALLPAPERS.find((w) => w.id === "ink")!.style &&
    CHAT_WALLPAPERS.find((w) => w.id === "lagoon")!.vi === "Đầm phá");
const me = "me1";
const convs = [
  { id: "c1", isGroup: false, participants: [{ id: me }, { id: "p1" }] },
  { id: "g1", isGroup: true, participants: [{ id: me }, { id: "p2" }, { id: "p3" }] },
];
mem.set(LEGACY_WP_KEY, JSON.stringify({ all: "ocean", byChat: { "partner:p9": "marble", c1: "nails", g1: "rose", cX: "glitter", c2: "not-a-wallpaper" } }));
const migrated = migrateLegacyWallpaper(me, convs);
const st = readWpState(me);
ok("W2", "Chuyển 1 lần từ pn_chat_wp: partner:<id> → u:<id>; hội thoại 1-1 → u:<người kia>; nhóm → g:<id>; không tra được → giữ; 'all' giữ; nền lạ bỏ; xoá khoá cũ",
  migrated && st.byChat?.["u:p9"] === "marble" && st.byChat?.["u:p1"] === "nails" && st.byChat?.["g:g1"] === "rose" && st.byChat?.["cX"] === "glitter" && !("c2" in (st.byChat ?? {})) && st.all === "ocean" && !mem.has(LEGACY_WP_KEY) && mem.has(wpStorageKey(me)),
  st);
ok("W3", "Chạy lại không làm gì (khoá cũ đã xoá)", migrateLegacyWallpaper(me, convs) === false);
ok("W4", "Khoá theo người: người khác trên cùng máy không thấy lựa chọn của tôi", Object.keys(readWpState("other").byChat ?? {}).length === 0);
const withPhoto = { all: "photo:a", byChat: { "u:x": "photo:a", "u:y": "photo:b", "u:z": "marble" }, photos: { a: { dim: 35, blur: false, w: 1, h: 1, at: 1 }, b: { dim: 35, blur: false, w: 1, h: 1, at: 2 } } };
const rm = removePhoto(withPhoto, "a");
ok("W5", "Xoá 1 ảnh nền: bỏ khỏi danh sách ảnh + mọi chỗ đang dùng (chung / từng chat → về nền chung), giữ ảnh khác",
  !rm.photos?.a && !!rm.photos?.b && rm.all === undefined && !("u:x" in (rm.byChat ?? {})) && rm.byChat?.["u:y"] === "photo:b" && rm.byChat?.["u:z"] === "marble", rm);
// ChatKey: chat 1-1 mới (chưa có conversationId) và sau tin đầu tiên → cùng 1 khoá
const before = chatKeyOf({ id: "p1", isGroup: false });
const after = chatKeyOf({ id: "p1", isGroup: false, conversationId: "c1" });
ok("K1", "ChatKey 1-1 không đổi trước / sau tin đầu tiên (u:p1); nhóm = g:<conversationId>", before === "u:p1" && after === "u:p1" && chatKeyOf({ id: "g1", isGroup: true, conversationId: "g1" }) === "g:g1");
ok("K2", "Chọn trước tin đầu tiên vẫn áp sau khi có conversationId; khoá cũ theo conversationId vẫn tra được; còn lại → nền chung",
  resolveChoice(st, before) === "nails" && resolveChoice(st, after, "c1") === "nails" && resolveChoice(st, "u:zzz", "cX") === "glitter" && resolveChoice(st, "u:nobody") === "ocean");
ok("K3", "Lựa chọn 'photo:<uuid>' không còn ảnh → về nền chung; tối đa 6 ảnh, bỏ ảnh dùng lâu nhất nhưng giữ ảnh đang dùng",
  (() => {
    const photos: Record<string, { dim: number; blur: boolean; w: number; h: number; at: number }> = {};
    for (let i = 0; i < 8; i++) photos["p" + i] = { dim: 35, blur: false, w: 10, h: 10, at: 1000 + i };
    const pruned = prunePhotos({ all: "photo:p0", photos });
    const keys = Object.keys(pruned.photos ?? {});
    return resolveChoice({ all: "ocean", byChat: { "u:a": "photo:gone" } }, "u:a") === "ocean" && keys.length === MAX_PHOTOS && keys.includes("p0") && !keys.includes("p1") && keys.includes("p7");
  })());

// ---------- 7. Giới hạn hình động cùng lúc ----------
const sl = makeSlots(2);
const started: string[] = [];
const cancels = ["a", "b", "c", "d"].map((k) => sl.request(k, () => started.push(k)));
const s1 = started.join("");
cancels[0]();
const s2 = started.join("");
sl.release("b");
const s3 = started.join("");
cancels[2]();
cancels[3]();
ok("L1", "Tối đa N hình động: 2 chỗ → a, b chạy; c, d chờ; a xong → c; b xong → d; huỷ hết → 0 chỗ", s1 === "ab" && s2 === "abc" && s3 === "abcd" && sl.size === 0, { s1, s2, s3, size: sl.size });

console.log(`\nstickers_unit: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
