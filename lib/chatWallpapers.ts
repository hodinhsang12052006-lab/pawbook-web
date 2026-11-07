import type { CSSProperties } from "react";

// Hình nền khung chat (như "chủ đề" Messenger / Telegram) — 16 nền CSS/SVG tĩnh (không tải ảnh, không tốn pin) + "Ảnh của
// bạn" (ảnh trong máy, chỉ lưu IndexedDB trên máy này — lib/localImageStore.ts — KHÔNG bao giờ tải lên).
// Chọn riêng từng cuộc trò chuyện hoặc cho tất cả; lưu trên thiết bị theo từng người (localStorage pn_wp:v2:<userId>)
// nên người kia không bị đổi theo. Họa tiết là nét vẽ gốc của PawNail (không dùng tài sản của ứng dụng nào khác).

export type WpTone = "dark" | "light";
export type WpGroup = "calm" | "pattern" | "gradient";

export interface ChatWallpaper {
  id: string;
  vi: string;
  en: string;
  tone: WpTone;
  group: WpGroup;
  style: CSSProperties;
  swatch: string; // CSS background cho ô xem trước
  pattern?: boolean; // swatch có họa tiết lặp (thu nhỏ cho vừa ô)
  /** background-size của ô xem trước khi pattern (mặc định "60px 60px, auto") — từng lớp, đúng thứ tự swatch */
  swatchSize?: string;
}

const svg = (body: string, size = 120) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`;

// Họa tiết "móng + hoa" nét mảnh (gốc PawNail)
const NAIL_PATHS =
  "<path d='M24 18c-6 0-9 6-9 14v16c0 4 3 6 9 6s9-2 9-6V32c0-8-3-14-9-14z'/>" +
  "<path d='M18 26c3-3 9-3 12 0'/>" +
  "<circle cx='86' cy='34' r='5'/><circle cx='86' cy='22' r='6'/><circle cx='97' cy='31' r='6'/><circle cx='93' cy='44' r='6'/><circle cx='79' cy='44' r='6'/><circle cx='75' cy='31' r='6'/>" +
  "<path d='M70 92l4-10 4 10-10-6h12z'/>" +
  "<path d='M22 96c8-6 16-6 24 0'/>";
const motif = (stroke: string, size: number) => svg(`<g fill='none' stroke='${stroke}' stroke-width='1.2' transform='scale(${size / 120})'>${NAIL_PATHS}</g>`, size);
/** Họa tiết móng + hoa nét mảnh (gốc PawNail) — dùng lại cho ảnh bìa mặc định của hồ sơ (lib/defaultCovers). */
export const nailMotif = motif;
const MOTIF_ROSE = motif("rgba(255,236,246,0.028)", 160);
const MOTIF_GOLD = motif("rgba(227,196,138,0.06)", 140);
const MOTIF_SWATCH = motif("rgba(255,236,246,0.16)", 160);
const MOTIF_GOLD_SWATCH = motif("rgba(227,196,138,0.28)", 140);
const GLITTER_DOTS = svg(
  "<g fill='rgba(227,196,138,0.22)'><circle cx='12' cy='18' r='1'/><circle cx='70' cy='9' r='0.7'/><circle cx='104' cy='40' r='1.1'/><circle cx='40' cy='62' r='0.8'/><circle cx='88' cy='86' r='0.9'/><circle cx='18' cy='104' r='0.7'/><circle cx='122' cy='120' r='0.9'/><circle cx='58' cy='128' r='0.7'/></g>",
  140
);
const SWATCH_GLITTER = svg(
  "<g fill='rgba(240,214,160,0.75)'><circle cx='10' cy='12' r='1.6'/><circle cx='44' cy='8' r='1.1'/><circle cx='52' cy='34' r='1.8'/><circle cx='22' cy='40' r='1.2'/><circle cx='36' cy='54' r='1.4'/><circle cx='8' cy='56' r='1'/></g>",
  60
);
const marbleVeins = (a: number) =>
  svg(
    `<g fill='none' stroke-linecap='round'>` +
      `<path d='M-20 70C40 40 70 120 130 90s90-60 150-20' stroke='rgba(255,240,230,${a})' stroke-width='1.6'/>` +
      `<path d='M-20 170c50-30 90 10 140-15s80-55 160-25' stroke='rgba(255,240,230,${a * 0.7})' stroke-width='1'/>` +
      `<path d='M60 -10c-10 60 30 90 10 150s20 80 40 120' stroke='rgba(255,240,230,${a * 0.55})' stroke-width='0.8'/>` +
      `<path d='M180 -10c-20 50 10 80-15 130' stroke='rgba(255,240,230,${a * 0.45})' stroke-width='0.7'/>` +
      `</g>`,
    280
  );
// Đá terrazzo: mảnh đá màu champagne / hồng / trắng rất mờ. k = hệ số độ đậm (ô xem trước ×3).
const terrazzo = (k: number) =>
  svg(
    `<path d='M18 22l9-3 4 8-8 4z' fill='rgba(227,196,138,${(0.1 * k).toFixed(2)})'/>` +
      `<path d='M96 18l7 2-1 8-8-2z' fill='rgba(232,120,160,${(0.09 * k).toFixed(2)})'/>` +
      `<path d='M60 70l10-2 2 7-9 4z' fill='rgba(255,255,255,${(0.05 * k).toFixed(2)})'/>` +
      `<path d='M130 96l6 5-6 6-5-5z' fill='rgba(227,196,138,${(0.1 * k).toFixed(2)})'/>` +
      `<path d='M30 120l8 1-2 9-7-3z' fill='rgba(232,120,160,${(0.09 * k).toFixed(2)})'/>` +
      `<path d='M110 140l5-6 6 4-4 6z' fill='rgba(255,255,255,${(0.05 * k).toFixed(2)})'/>` +
      `<circle cx='82' cy='118' r='2.5' fill='rgba(227,196,138,${(0.1 * k).toFixed(2)})'/>` +
      `<circle cx='146' cy='40' r='2' fill='rgba(232,120,160,${(0.09 * k).toFixed(2)})'/>` +
      `<circle cx='12' cy='76' r='1.8' fill='rgba(255,255,255,${(0.06 * k).toFixed(2)})'/>`,
    160
  );
const lattice = (a: number) => svg(`<path d='M24 0L48 24 24 48 0 24z' fill='none' stroke='rgba(255,236,246,${a})'/>`, 48);
const AMBIENT = "radial-gradient(120% 55% at 50% -8%, rgba(236,140,176,.10), transparent 62%), radial-gradient(70% 45% at 100% 0%, rgba(222,190,132,.07), transparent 60%)";

const bar = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.96)`;
};
type Def = Omit<ChatWallpaper, "style" | "swatch" | "pattern" | "swatchSize"> & { bg: string; image: string; size: string; swatch?: string; pattern?: boolean; swatchSize?: string };
/** Thanh trên + khung soạn tin lấy màu nền (96%) CHỈ với nền tối; nền sáng / ảnh giữ thanh tối mặc định. */
const wp = (d: Def): ChatWallpaper => ({
  id: d.id,
  vi: d.vi,
  en: d.en,
  tone: d.tone,
  group: d.group,
  style: {
    backgroundColor: d.bg,
    backgroundImage: d.image,
    backgroundSize: d.size,
    ...(d.tone === "dark" ? { ["--chat-bar-bg" as string]: bar(d.bg) } : {}),
  } as CSSProperties,
  swatch: d.swatch ?? (d.image === "none" ? d.bg : `${d.image}, ${d.bg}`),
  ...(d.pattern ? { pattern: true } : {}),
  ...(d.swatchSize ? { swatchSize: d.swatchSize } : {}),
});

// 16 nền: 8 id cũ GIỮ tên + giá trị V2.1 (đã lưu trong máy người dùng); 8 nền mới.
export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  // ---- Dịu ----
  wp({ id: "default", vi: "Lụa mận", en: "Plum silk", tone: "dark", group: "calm", bg: "#1c1521", image: `${AMBIENT}, ${MOTIF_ROSE}`, size: "auto, auto, 160px 160px", swatch: `radial-gradient(120% 60% at 50% -10%, rgba(236,140,176,.30), transparent 65%), ${MOTIF_SWATCH}, #1c1521`, pattern: true, swatchSize: "auto, 60px 60px, auto" }),
  wp({ id: "ink", vi: "Mực đêm", en: "Midnight", tone: "dark", group: "calm", bg: "#15121a", image: "none", size: "auto", swatch: "#15121a" }),
  wp({ id: "mocha", vi: "Mocha", en: "Mocha", tone: "dark", group: "calm", bg: "#221a17", image: "radial-gradient(90% 50% at 50% -10%, rgba(255,214,170,.07), transparent 70%)", size: "auto", swatch: "radial-gradient(110% 80% at 50% -10%, rgba(255,214,170,.35), transparent 70%), #221a17" }),
  wp({ id: "sage", vi: "Xanh xô thơm", en: "Sage", tone: "dark", group: "calm", bg: "#161c19", image: "radial-gradient(80% 50% at 0 0, rgba(140,190,160,.12), transparent 70%)", size: "auto", swatch: "radial-gradient(110% 80% at 0 0, rgba(140,190,160,.5), transparent 70%), #161c19" }),
  // ---- Họa tiết ----
  wp({ id: "nails", vi: "Hoa móng", en: "Nail art", tone: "dark", group: "pattern", bg: "#1d1722", image: MOTIF_GOLD, size: "140px 140px", swatch: `${MOTIF_GOLD_SWATCH}, #1d1722`, pattern: true, swatchSize: "56px 56px, auto" }),
  wp({ id: "glitter", vi: "Lấp lánh", en: "Glitter", tone: "dark", group: "pattern", bg: "#1d1720", image: `${GLITTER_DOTS}, radial-gradient(80% 45% at 100% 0, rgba(227,196,138,.08), transparent 70%)`, size: "140px 140px, auto", swatch: `${SWATCH_GLITTER}, radial-gradient(90% 60% at 100% 0, rgba(227,196,138,.35), transparent 70%), #1d1720`, pattern: true, swatchSize: "30px 30px, auto, auto" }),
  wp({ id: "marble", vi: "Đá marble", en: "Marble", tone: "dark", group: "pattern", bg: "#201a1e", image: marbleVeins(0.05), size: "280px 280px", swatch: `${marbleVeins(0.16)}, #2a2226`, pattern: true, swatchSize: "120px 120px, auto" }),
  wp({ id: "terrazzo", vi: "Đá terrazzo", en: "Terrazzo", tone: "dark", group: "pattern", bg: "#1d181d", image: terrazzo(1), size: "160px 160px", swatch: `${terrazzo(3)}, #1d181d`, pattern: true, swatchSize: "64px 64px, auto" }),
  wp({ id: "lattice", vi: "Mắt cáo", en: "Lattice", tone: "dark", group: "pattern", bg: "#1a1520", image: lattice(0.045), size: "48px 48px", swatch: `${lattice(0.18)}, #1a1520`, pattern: true, swatchSize: "20px 20px, auto" }),
  // ---- Chuyển màu ----
  wp({ id: "rose", vi: "Hồng phấn", en: "Rose blush", tone: "dark", group: "gradient", bg: "#211520", image: "radial-gradient(80% 50% at 0 0, rgba(232,120,160,.16), transparent 70%), radial-gradient(60% 40% at 100% 100%, rgba(232,120,160,.08), transparent 70%)", size: "auto, auto", swatch: "radial-gradient(110% 80% at 0 0, rgba(232,120,160,.55), transparent 70%), radial-gradient(80% 60% at 100% 100%, rgba(232,120,160,.3), transparent 70%), #211520" }),
  wp({ id: "aurora", vi: "Đêm tím", en: "Violet night", tone: "dark", group: "gradient", bg: "#1b1624", image: "radial-gradient(90% 50% at 50% -10%, rgba(150,110,200,.16), transparent 70%)", size: "auto", swatch: "radial-gradient(120% 75% at 50% -10%, rgba(150,110,200,.6), transparent 72%), #1b1624" }),
  wp({ id: "ocean", vi: "Biển đêm", en: "Deep ocean", tone: "dark", group: "gradient", bg: "#141b1e", image: "radial-gradient(80% 50% at 100% 0, rgba(70,150,160,.14), transparent 70%)", size: "auto", swatch: "radial-gradient(110% 85% at 100% 0, rgba(70,170,180,.62), transparent 72%), #141b1e" }),
  wp({ id: "champagne", vi: "Champagne", en: "Champagne", tone: "dark", group: "gradient", bg: "#1f1913", image: "radial-gradient(100% 55% at 50% -10%, rgba(227,196,138,.16), transparent 70%)", size: "auto", swatch: "radial-gradient(110% 80% at 50% -10%, rgba(227,196,138,.5), transparent 70%), #1f1913" }),
  wp({
    id: "dusk",
    vi: "Hoàng hôn",
    en: "Dusk",
    tone: "dark",
    group: "gradient",
    bg: "#171220",
    image: "radial-gradient(120% 70% at 15% 0%, rgba(240,140,110,.26), transparent 65%), radial-gradient(100% 60% at 100% 100%, rgba(130,90,180,.28), transparent 65%), linear-gradient(180deg,#2a1a24 0%,#171220 70%)",
    size: "auto",
    swatch: "radial-gradient(120% 70% at 15% 0%, rgba(240,140,110,.42), transparent 65%), radial-gradient(100% 60% at 100% 100%, rgba(130,90,180,.45), transparent 65%), linear-gradient(180deg,#2a1a24 0%,#171220 70%), #171220",
  }),
  wp({
    id: "lagoon",
    vi: "Đầm phá",
    en: "Lagoon",
    tone: "dark",
    group: "gradient",
    bg: "#121a20",
    image: "radial-gradient(110% 70% at 0% 0%, rgba(60,170,170,.24), transparent 65%), radial-gradient(90% 60% at 100% 100%, rgba(70,110,190,.22), transparent 65%)",
    size: "auto",
    swatch: "radial-gradient(110% 70% at 0% 0%, rgba(60,170,170,.38), transparent 65%), radial-gradient(90% 60% at 100% 100%, rgba(70,110,190,.35), transparent 65%), #121a20",
  }),
  wp({
    id: "pearl",
    vi: "Ngọc trai",
    en: "Pearl",
    tone: "light",
    group: "gradient",
    bg: "#f3ece8",
    image: "radial-gradient(90% 55% at 100% 0%, rgba(232,150,180,.18), transparent 70%), linear-gradient(180deg,#f6f0ec,#ebe2e6)",
    size: "auto",
    swatch: "radial-gradient(90% 55% at 100% 0%, rgba(232,150,180,.29), transparent 70%), linear-gradient(180deg,#f6f0ec,#ebe2e6), #f3ece8",
  }),
];

export const WALLPAPER_GROUPS: { id: WpGroup; vi: string; en: string }[] = [
  { id: "calm", vi: "Dịu", en: "Calm" },
  { id: "pattern", vi: "Họa tiết", en: "Patterns" },
  { id: "gradient", vi: "Chuyển màu", en: "Gradients" },
];

const BY_ID = new Map(CHAT_WALLPAPERS.map((w) => [w.id, w]));
export const wallpaperById = (id: string) => BY_ID.get(id) ?? CHAT_WALLPAPERS[0];
export const isPresetId = (id: string) => BY_ID.has(id);

// ---------------------------------------------------------------------------------------------------------------
// Lưu trên máy (theo người): localStorage "pn_wp:v2:<userId>"
//   { all?: Choice, byChat?: Record<ChatKey, Choice>, photos?: Record<uuid, PhotoMeta> }
//   Choice  = id nền có sẵn | "photo:<uuid>"
//   ChatKey = nhóm "g:<conversationId>" · 1-1 "u:<partnerUserId>" (KHÔNG đổi trước / sau tin đầu tiên)
// ---------------------------------------------------------------------------------------------------------------
export type WpChoice = string;
export interface PhotoMeta {
  /** độ tối phủ lên ảnh, 15–65 (%) */
  dim: number;
  blur: boolean;
  w: number;
  h: number;
  /** lần dùng gần nhất (ms) — giữ tối đa MAX_PHOTOS ảnh, bỏ ảnh lâu không dùng nhất */
  at: number;
}
export interface WpState {
  all?: WpChoice;
  byChat?: Record<string, WpChoice>;
  photos?: Record<string, PhotoMeta>;
}
export const MAX_PHOTOS = 6;
export const DIM_MIN = 15;
export const DIM_MAX = 65;
export const DIM_DEFAULT = 35;
export const LEGACY_WP_KEY = "pn_chat_wp";
export const WP_EVENT = "pn-wp-change";
export const wpStorageKey = (uid: string) => `pn_wp:v2:${uid}`;

export function chatKeyOf(chat: { id: string; isGroup?: boolean; conversationId?: string | null }): string {
  return chat.isGroup ? `g:${chat.conversationId || chat.id}` : `u:${chat.id}`;
}

export const photoIdOf = (choice: string | null | undefined): string | null => (choice && choice.startsWith("photo:") ? choice.slice(6) : null);

export function parseWpState(raw: string | null): WpState {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as WpState;
    if (!v || typeof v !== "object") return {};
    const out: WpState = {};
    if (typeof v.all === "string") out.all = v.all;
    if (v.byChat && typeof v.byChat === "object") out.byChat = Object.fromEntries(Object.entries(v.byChat).filter(([, c]) => typeof c === "string"));
    if (v.photos && typeof v.photos === "object") out.photos = v.photos;
    return out;
  } catch {
    return {};
  }
}

export function readWpRaw(uid: string): string | null {
  try {
    return localStorage.getItem(wpStorageKey(uid));
  } catch {
    return null;
  }
}
export function readWpState(uid: string): WpState {
  return parseWpState(readWpRaw(uid));
}
export function writeWpState(uid: string, s: WpState) {
  try {
    localStorage.setItem(wpStorageKey(uid), JSON.stringify(s));
  } catch {}
  try {
    window.dispatchEvent(new Event(WP_EVENT));
  } catch {}
}

/** Lựa chọn có dùng được không (nền có sẵn, hoặc ảnh còn trong danh sách ảnh của người này). */
export function validChoice(s: WpState, c: WpChoice | undefined | null): c is WpChoice {
  if (!c) return false;
  const pid = photoIdOf(c);
  return pid ? !!s.photos?.[pid] : isPresetId(c);
}

/** Nền của 1 cuộc trò chuyện: riêng (theo ChatKey, hoặc conversationId cũ chưa đổi được) → chung → mặc định. */
export function resolveChoice(s: WpState, chatKey: string | null, conversationId?: string | null): WpChoice {
  const own = (chatKey && s.byChat?.[chatKey]) || (conversationId && s.byChat?.[conversationId]) || null;
  if (validChoice(s, own)) return own;
  if (validChoice(s, s.all)) return s.all!;
  return "default";
}
/** Cuộc trò chuyện này có nền riêng không. */
export function hasOwnChoice(s: WpState, chatKey: string | null, conversationId?: string | null): boolean {
  return !!((chatKey && s.byChat?.[chatKey]) || (conversationId && s.byChat?.[conversationId]));
}

/** Ảnh còn được dùng ở đâu đó (chung / riêng 1 cuộc trò chuyện). */
export function referencedPhotoIds(s: WpState): Set<string> {
  const ids = new Set<string>();
  for (const c of [s.all, ...Object.values(s.byChat ?? {})]) {
    const p = photoIdOf(c);
    if (p) ids.add(p);
  }
  return ids;
}

/** Bỏ 1 ảnh: khỏi danh sách ảnh + mọi lựa chọn đang dùng ảnh đó (chung / từng cuộc trò chuyện → về nền chung / mặc định). */
export function removePhoto(s: WpState, id: string): WpState {
  const photos = { ...(s.photos ?? {}) };
  delete photos[id];
  const byChat = Object.fromEntries(Object.entries(s.byChat ?? {}).filter(([, c]) => photoIdOf(c) !== id));
  const out: WpState = { ...s, photos, byChat };
  if (photoIdOf(out.all) === id) delete out.all;
  return out;
}

/** Giữ tối đa MAX_PHOTOS ảnh: bỏ ảnh dùng lâu nhất (ưu tiên giữ ảnh đang được dùng). */
export function prunePhotos(s: WpState): WpState {
  const photos = { ...(s.photos ?? {}) };
  const ids = Object.keys(photos);
  if (ids.length <= MAX_PHOTOS) return s;
  const used = referencedPhotoIds(s);
  const order = ids.sort((a, b) => Number(used.has(b)) - Number(used.has(a)) || photos[b].at - photos[a].at);
  for (const id of order.slice(MAX_PHOTOS)) delete photos[id];
  return { ...s, photos };
}

/**
 * Chuyển 1 lần từ khoá cũ "pn_chat_wp" ({ all, byChat } — không theo người, khoá theo conversationId / "partner:<id>"):
 *   "partner:<id>" → "u:<id>" · conversationId 1-1 → "u:<partnerId>" (tra trong danh sách hội thoại đã tải) ·
 *   conversationId nhóm → "g:<id>" · không tra được → giữ nguyên (resolveChoice vẫn tra theo conversationId) · "all" giữ.
 * Không ghi đè lựa chọn đã có ở khoá mới. Xong thì xoá khoá cũ. Trả về true nếu đã chuyển.
 */
export function migrateLegacyWallpaper(uid: string, conversations: { id: string; isGroup: boolean; participants: { id: string }[] }[]): boolean {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_WP_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;
  let old: { all?: unknown; byChat?: Record<string, unknown> } = {};
  try {
    old = JSON.parse(raw) || {};
  } catch {}
  const next = readWpState(uid);
  const byChat = { ...(next.byChat ?? {}) };
  for (const [k, v] of Object.entries(old.byChat ?? {})) {
    if (typeof v !== "string" || !isPresetId(v)) continue;
    let key = k;
    if (k.startsWith("partner:")) key = `u:${k.slice(8)}`;
    else {
      const conv = conversations.find((c) => c.id === k);
      if (conv?.isGroup) key = `g:${conv.id}`;
      else if (conv) {
        const partner = conv.participants.find((p) => p.id !== uid);
        if (partner) key = `u:${partner.id}`;
      }
    }
    if (!(key in byChat)) byChat[key] = v;
  }
  const out: WpState = { ...next, byChat };
  if (!out.all && typeof old.all === "string" && isPresetId(old.all)) out.all = old.all;
  writeWpState(uid, out);
  try {
    localStorage.removeItem(LEGACY_WP_KEY);
  } catch {}
  return true;
}

/** Nền đang vẽ (đưa thẳng vào khung chat). */
export interface WpRender {
  id: string;
  tone: WpTone | "photo";
  style: CSSProperties;
}
export function presetRender(id: string): WpRender {
  const w = wallpaperById(id);
  return { id: w.id, tone: w.tone, style: w.style };
}
export function photoRender(url: string | null, dim: number): WpRender {
  const d = Math.min(DIM_MAX, Math.max(DIM_MIN, dim)) / 100;
  return {
    id: "photo",
    tone: "photo",
    style: {
      backgroundColor: "#1c1521",
      backgroundImage: url ? `linear-gradient(rgb(20 14 22 / var(--wp-dim)), rgb(20 14 22 / var(--wp-dim))), url("${url}")` : "none",
      backgroundSize: "cover",
      backgroundPosition: "center",
      ["--wp-dim" as string]: String(d),
    } as CSSProperties,
  };
}
