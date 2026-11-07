// Manifest sticker (tên + từ khoá EN/VI, độ phổ biến, đường dẫn Fluent) dựng từ dữ liệu sinh gọn (*.generated.ts).
// Hai tầng, đều tải ĐỘNG (không nằm trong bundle chung):
//   - lõi (manifest.generated.ts, ~29 KB gzip): mọi sticker trong bộ — tải khi mở tab Nhãn dán;
//   - mở rộng (manifestExt.generated.ts, ~42 KB gzip): mọi thư mục Fluent 3D còn lại — tải khi bắt đầu tìm, hoặc khi
//     cần vẽ 1 sticker Fluent ngoài bộ (bong bóng tin, Gần đây / Yêu thích).
import { flId, type StickerId } from "./packs";
import { FLUENT_GLYPH } from "./ids.generated";
import { FLUENT_PATH } from "./paths.generated";

export interface StickerMeta {
  src: "noto" | "fl";
  glyph: string;
  /** Tên + từ khoá tiếng Anh (chữ thường, CLDR + Noto + Fluent); en[0] là tên */
  en: string[];
  /** Tên + từ khoá tiếng Việt (Unicode CLDR); vi[0] là tên — có thể rỗng */
  vi: string[];
  /** Độ phổ biến trong danh mục Noto (cao = phổ biến) */
  p?: number;
  /** Fluent: đường dẫn PNG 3D trong assets/ của repo (ghim commit) */
  path?: string;
}
export type Manifest = Record<StickerId, StickerMeta>;

export interface CoreData {
  WORDS: string;
  NOTO: string;
}
export interface ExtData {
  WORDS_EXT: string;
  FLUENT_EXT: string;
}

const bare = (g: string) => g.replace(/️/g, "");

/** Đường dẫn PNG 3D theo tên thư mục — cùng quy tắc với scripts/stickers/build_manifest.mjs (derivePath). */
export function fluentPathFor(folder: string, flag: string): string {
  if (flag && flag !== "d") return flag;
  const snake = folder.toLowerCase().replace(/ /g, "_");
  return flag === "d" ? `${folder}/Default/3D/${snake}_3d_default.png` : `${folder}/3D/${snake}_3d.png`;
}

function parseWords(s: string, into: Map<string, [string[], string[]]>) {
  for (const line of s.split("\n")) {
    if (!line) continue;
    const [g, en, vi] = line.split("\t");
    into.set(g, [en ? en.split("|") : [], vi ? vi.split("|") : []]);
  }
}

/** Dòng "tên thư mục \t ký tự \t cờ" → [id, glyph, path]. */
export function parseFluentExt(s: string): [StickerId, string, string][] {
  const out: [StickerId, string, string][] = [];
  for (const line of s.split("\n")) {
    if (!line) continue;
    const [folder, glyph, flag = ""] = line.split("\t");
    out.push([flId(folder), glyph, fluentPathFor(folder, flag)]);
  }
  return out;
}

export function buildManifest(core: CoreData, ext?: ExtData | null): Manifest {
  const words = new Map<string, [string[], string[]]>();
  parseWords(core.WORDS, words);
  if (ext) parseWords(ext.WORDS_EXT, words);
  const w = (g: string, fallback: string) => {
    const x = words.get(bare(g));
    return x && x[0].length ? x : ([[fallback], x?.[1] ?? []] as [string[], string[]]);
  };
  const out = Object.create(null) as Manifest;
  for (const line of core.NOTO.split("\n")) {
    if (!line) continue;
    const [id, p] = line.split("\t");
    const [en, vi] = w(id, "emoji");
    out[id] = { src: "noto", glyph: id, en, vi, ...(p ? { p: Number(p) } : {}) };
  }
  for (const [id, glyph] of Object.entries(FLUENT_GLYPH)) {
    const [en, vi] = w(glyph, id.slice(3).replace(/_/g, " "));
    out[id] = { src: "fl", glyph, en, vi, path: FLUENT_PATH[id] };
  }
  if (ext) {
    for (const [id, glyph, path] of parseFluentExt(ext.FLUENT_EXT)) {
      if (out[id]) continue;
      const [en, vi] = w(glyph, id.slice(3).replace(/_/g, " "));
      out[id] = { src: "fl", glyph, en, vi, path };
    }
  }
  return out;
}

let corePromise: Promise<Manifest> | null = null;
let fullPromise: Promise<Manifest> | null = null;

/** Lõi: mọi sticker trong bộ. */
export function loadStickerManifest(): Promise<Manifest> {
  if (!corePromise)
    corePromise = import("./manifest.generated")
      .then((m) => buildManifest(m))
      .catch((e) => {
        corePromise = null;
        throw e;
      });
  return corePromise;
}

/** Lõi + mọi thư mục Fluent 3D (tìm kiếm, sticker Fluent ngoài bộ). */
export function loadFullStickerManifest(): Promise<Manifest> {
  if (!fullPromise)
    fullPromise = Promise.all([import("./manifest.generated"), import("./manifestExt.generated")])
      .then(([c, e]) => buildManifest(c, e))
      .catch((e) => {
        fullPromise = null;
        throw e;
      });
  return fullPromise;
}

/** id Fluent ngoài bộ (cần manifest mở rộng để biết đường dẫn ảnh). */
export const isExtFluentId = (id: string) => /^fl:[a-z0-9_]{1,45}$/.test(id) && !Object.prototype.hasOwnProperty.call(FLUENT_PATH, id);
