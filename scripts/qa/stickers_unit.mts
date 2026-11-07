// Kiểm thử THUẦN (không mạng, không DB) cho nhãn dán / GIF / hình nền chat:
//   id Fluent + tính duy nhất · bộ theo mùa (ngày + thị trường) · tìm tiếng Việt không dấu · kiểm id phía máy chủ ·
//   isGifUrl · chuyển hình nền cũ (pn_chat_wp → pn_wp:v2:<user>) · ChatKey không đổi trước / sau tin đầu tiên.
//   npx tsx scripts/qa/stickers_unit.mts
import { ALL_PACKS, ANIM_PACKS, SEASON_PACKS, THREE_D_PACKS, TET_ZODIAC, allStickerIds, flId, MAX_STICKER_ID_LENGTH } from "../../lib/stickers/packs";
import { activeSeasonsOn, activeSeasonPacks, thanksgivingDay } from "../../lib/stickers/seasons";
import { searchStickers } from "../../lib/stickers/search";
import { STICKERS } from "../../lib/stickers/manifest.generated";
import { STICKER_GLYPH } from "../../lib/stickers/ids.generated";
import { FLUENT_PATH } from "../../lib/stickers/paths.generated";
import { animUrl, isValidStickerId, stillUrl, thumbUrl } from "../../lib/stickers/urls";
import { isGifUrl, gifAspect } from "../../lib/chat/gif";
import { gifQueryEn } from "../../lib/gifQueryVi";
import { mediaPreview } from "../../lib/chat/preview";
import { setTrLocale } from "../../lib/i18n/tr";
import {
  CHAT_WALLPAPERS,
  LEGACY_WP_KEY,
  chatKeyOf,
  migrateLegacyWallpaper,
  prunePhotos,
  readWpState,
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

// ---------- 1. id + danh mục ----------
ok("S1", "Slug Fluent: 'Nail polish' → fl:nail_polish, '1st place medal' → fl:1st_place_medal, 'Star-struck' → fl:star_struck, 'Santa claus' → fl:santa_claus",
  flId("Nail polish") === "fl:nail_polish" && flId("1st place medal") === "fl:1st_place_medal" && flId("Star-struck") === "fl:star_struck" && flId("Santa claus") === "fl:santa_claus");
const ids = allStickerIds();
ok("S2", "Mọi id duy nhất, ≤ 48 ký tự", new Set(ids).size === ids.length && ids.every((i) => i.length <= MAX_STICKER_ID_LENGTH), ids.length);
const missing = ids.filter((i) => !STICKERS[i] || !STICKER_GLYPH[i] || (i.startsWith("fl:") && !FLUENT_PATH[i]));
ok("S3", `Mọi mục của mọi bộ (${ALL_PACKS.length} bộ, ${ids.length} id) có trong manifest + ids + paths đã sinh`, !missing.length, missing.slice(0, 10));
ok("S4", "Đủ 6 bộ hoạt hình + 6 bộ 3D + 12 bộ theo mùa; con giáp 2027–2030", ANIM_PACKS.length === 6 && THREE_D_PACKS.length === 6 && SEASON_PACKS.length === 12 && Object.keys(TET_ZODIAC).join() === "2027,2028,2029,2030");
const oldIds = "😂 🤣 🥰 😍 😘 😭 🥺 😡 😱 🤯 🤩 🥳 😎 🤔 🙄 😴 🤗 🤭 😳 😅 😊 😇 🥲 😮 💀 🙈 👋 💅 ✨ 🔥 💖 💯 👏 🙏 💸 👍 💪 🎉 🎁 ⭐ 🌈 🌸 😺 😹 😻 🐕 🦊 🐼 🦄 🦁 🐧 🦉 🍂 ❄️ ⛄ 🎆 🍾 ❤️ 💘 🎂 🎃 👻".split(" ");
const lostOld = oldIds.filter((i) => !isValidStickerId(i));
ok("S5", "Mọi sticker của bộ cũ (66 emoji, tin STICKER đã gửi) vẫn hợp lệ", !lostOld.length, lostOld);
ok("S6", "URL: Noto → gstatic emoji.svg / 512.webp; Fluent → jsDelivr ghim commit + ô nhỏ /_next/image w=96 q=70; Fluent không có bản động",
  stillUrl("😂") === "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/emoji.svg" &&
    animUrl("❤️") === "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.webp" &&
    stillUrl("fl:nail_polish") === "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets/Nail%20polish/Default/3D/nail_polish_3d_default.png" &&
    animUrl("fl:nail_polish") === null &&
    /^\/_next\/image\?url=https%3A%2F%2Fcdn\.jsdelivr\.net%2F.*&w=96&q=70$/.test(thumbUrl("fl:nail_polish") || ""),
  [stillUrl("fl:nail_polish"), thumbUrl("fl:nail_polish")]);

// ---------- 2. Máy chủ: kiểm id tin STICKER ----------
ok("V1", "Máy chủ nhận 'fl:nail_polish' và '💅'; từ chối 'hello', '<img>', chuỗi rỗng, id quá dài, 'fl:not_a_sticker'",
  isValidStickerId("fl:nail_polish") && isValidStickerId("💅") && !isValidStickerId("hello") && !isValidStickerId("<img src=x>") && !isValidStickerId("") && !isValidStickerId("fl:" + "a".repeat(60)) && !isValidStickerId("fl:not_a_sticker") && !isValidStickerId("toString") && !isValidStickerId("__proto__"));

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

// ---------- 4. Tìm kiếm ----------
const q = (t: string) => searchStickers(t, STICKERS);
ok("Q1", "'cam on' (không dấu) / 'cảm ơn' / 'cám ơn' → có 🙏 + bộ Cảm ơn", q("cam on").includes("🙏") && q("cảm ơn").includes("fl:folded_hands") && q("cám ơn").length > 5, q("cam on").slice(0, 6));
ok("Q2", "'móng' → 💅 + fl:nail_polish; 'chuc mung' → có kết quả bộ Ăn mừng", q("móng").includes("💅") && q("móng").includes("fl:nail_polish") && q("chuc mung").includes("fl:party_popper"), { mong: q("móng").slice(0, 4), cm: q("chuc mung").slice(0, 4) });
ok("Q3", "Tiếng Anh: 'heart' ra ❤️ trước; 'pizza' → 🍕; 'santa' → fl:santa_claus (bộ ngoài mùa vẫn tìm được)", q("heart")[0] === "❤️" && q("pizza")[0] === "🍕" && q("santa").includes("fl:santa_claus"), q("heart").slice(0, 3));
ok("Q4", "'tết' → bao lì xì + con giáp; chuỗi vô nghĩa → rỗng", q("tết").includes("fl:red_envelope") && q("tết").includes("fl:goat") && q("zzqxv").length === 0);

// ---------- 5. GIF ----------
ok("G1", "isGifUrl: media*.giphy.com / i.giphy.com / media.tenor.com → GIF; Cloudinary / http / host lạ → không",
  isGifUrl("https://media2.giphy.com/media/abc/200w.webp#wh=200x150") && isGifUrl("https://i.giphy.com/x.gif") && isGifUrl("https://media.tenor.com/x/tinygif.gif") && !isGifUrl("https://res.cloudinary.com/x/image/upload/a.gif") && !isGifUrl("http://media.giphy.com/x.gif") && !isGifUrl("https://giphy.com.evil.io/x.gif"));
ok("G2", "Tỉ lệ từ #wh: 480x270 → 16:9; không có #wh → null", Math.abs((gifAspect("https://media.giphy.com/a.webp#wh=480x270") ?? 0) - 480 / 270) < 1e-9 && gifAspect("https://media.giphy.com/a.webp") === null);
ok("G3", "Tìm GIF tiếng Việt quá ít kết quả → từ tiếng Anh: 'cam on' → thank you, 'sinh nhật' → happy birthday, câu lạ → null", gifQueryEn("cam on") === "thank you" && gifQueryEn("Sinh Nhật") === "happy birthday" && gifQueryEn("abc") === null);
setTrLocale("en");
const p1 = mediaPreview("IMAGE", "https://media.giphy.com/media/a/200w.webp#wh=200x150");
const p2 = mediaPreview("STICKER", "fl:nail_polish");
const p3 = mediaPreview("STICKER", "not-a-sticker");
setTrLocale("vi");
const p4 = mediaPreview("STICKER", "😂");
const p5 = mediaPreview("IMAGE", "https://media.giphy.com/media/a/200w.webp");
setTrLocale("en");
ok("G4", "Xem trước trong danh sách: GIF → 'GIF'; sticker → '💅 Sticker' / '😂 Nhãn dán'; sticker lạ → 'Sticker' (không lộ chuỗi thô)", p1 === "GIF" && p2 === "💅 Sticker" && p3 === "Sticker" && p4 === "😂 Nhãn dán" && p5 === "GIF", [p1, p2, p3, p4, p5]);

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
ok("W1", "16 nền: 8 id cũ giữ nguyên + 8 nền mới; có nền sáng (Ngọc trai) và chỉ nền tối mới đổi màu thanh trên",
  CHAT_WALLPAPERS.length === 16 && ["default", "nails", "rose", "aurora", "glitter", "marble", "ocean", "champagne", "ink", "mocha", "sage", "terrazzo", "lattice", "dusk", "lagoon", "pearl"].every((id) => CHAT_WALLPAPERS.some((w) => w.id === id)) &&
    CHAT_WALLPAPERS.find((w) => w.id === "pearl")!.tone === "light" && !("--chat-bar-bg" in CHAT_WALLPAPERS.find((w) => w.id === "pearl")!.style) && "--chat-bar-bg" in CHAT_WALLPAPERS.find((w) => w.id === "ink")!.style);
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

console.log(`\nstickers_unit: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
