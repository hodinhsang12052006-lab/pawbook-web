// Dữ liệu riêng của TỪNG NGƯỜI trên máy này (localStorage, theo userId — máy dùng chung ở tiệm không lẫn tài khoản).
// Không bao giờ gửi lên máy chủ. Mọi lần đọc / ghi đều bọc try/catch (chế độ riêng tư, bộ nhớ bị chặn…).
import { isKnownSticker } from "./urls";
import type { StickerId } from "./packs";

const RECENT_CAP = 30;
const FAV_CAP = 50;
const EMOJI_CAP = 24;
const GIF_CAP = 24;

const stkKey = (uid: string) => `pn_stk:v1:${uid}`;
const emojiKey = (uid: string) => `pn_emoji_recent:v1:${uid}`;
const gifKey = (uid: string) => `pn_gif_recent:v1:${uid}`;
const tabKey = (uid: string) => `pn_media_tab:${uid}`;
const LEGACY_EMOJI_KEY = "pn_recent_emoji";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export interface StickerStore {
  r: StickerId[];
  f: StickerId[];
}

/** Gần đây + Yêu thích (bỏ id lạ / không còn trong danh mục). */
export function readStickerStore(uid: string): StickerStore {
  const raw = readJson<Partial<StickerStore>>(stkKey(uid), {});
  return {
    r: strings(raw.r).filter(isKnownSticker).slice(0, RECENT_CAP),
    f: strings(raw.f).filter(isKnownSticker).slice(0, FAV_CAP),
  };
}
export function pushRecentSticker(uid: string, id: StickerId): StickerStore {
  const s = readStickerStore(uid);
  const next = { ...s, r: [id, ...s.r.filter((x) => x !== id)].slice(0, RECENT_CAP) };
  writeJson(stkKey(uid), next);
  return next;
}
export function toggleFavoriteSticker(uid: string, id: StickerId): StickerStore {
  const s = readStickerStore(uid);
  const on = s.f.includes(id);
  const next = { ...s, f: on ? s.f.filter((x) => x !== id) : [id, ...s.f].slice(0, FAV_CAP) };
  writeJson(stkKey(uid), next);
  return next;
}

/** Emoji gần đây. Lần đầu: chuyển từ khoá cũ "pn_recent_emoji" (không theo người) sang khoá theo người rồi xoá khoá cũ. */
export function readEmojiRecent(uid: string): string[] {
  try {
    const legacy = localStorage.getItem(LEGACY_EMOJI_KEY);
    if (legacy !== null) {
      if (localStorage.getItem(emojiKey(uid)) === null) writeJson(emojiKey(uid), strings(JSON.parse(legacy)).slice(0, EMOJI_CAP));
      localStorage.removeItem(LEGACY_EMOJI_KEY);
    }
  } catch {}
  return strings(readJson<unknown>(emojiKey(uid), [])).slice(0, EMOJI_CAP);
}
export function pushEmojiRecent(uid: string, e: string): string[] {
  const next = [e, ...readEmojiRecent(uid).filter((x) => x !== e)].slice(0, EMOJI_CAP);
  writeJson(emojiKey(uid), next);
  return next;
}

export interface StoredGif {
  id: string;
  send: string;
  preview: string;
  w: number;
  h: number;
  title?: string;
}
const okGif = (g: unknown): g is StoredGif => {
  const x = g as StoredGif;
  return !!x && typeof x.id === "string" && typeof x.send === "string" && typeof x.preview === "string" && /^https:\/\//.test(x.send) && /^https:\/\//.test(x.preview) && x.w > 0 && x.h > 0;
};
export function readGifRecent(uid: string): StoredGif[] {
  const raw = readJson<unknown>(gifKey(uid), []);
  return (Array.isArray(raw) ? raw.filter(okGif) : []).slice(0, GIF_CAP);
}
export function pushGifRecent(uid: string, g: StoredGif): StoredGif[] {
  const next = [{ id: g.id, send: g.send, preview: g.preview, w: g.w, h: g.h, ...(g.title ? { title: g.title } : {}) }, ...readGifRecent(uid).filter((x) => x.id !== g.id)].slice(0, GIF_CAP);
  writeJson(gifKey(uid), next);
  return next;
}

export type MediaTabId = "emoji" | "sticker" | "gif";
export function readMediaTab(uid: string): MediaTabId | null {
  try {
    const v = localStorage.getItem(tabKey(uid));
    return v === "emoji" || v === "sticker" || v === "gif" ? v : null;
  } catch {
    return null;
  }
}
export function writeMediaTab(uid: string, t: MediaTabId) {
  try {
    localStorage.setItem(tabKey(uid), t);
  } catch {}
}
