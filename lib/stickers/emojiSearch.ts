// Tìm emoji CHỮ trong tab Emoji (bảng chèn vào tin, lib/chatStickers.ts EMOJI_GROUPS) theo từ khoá EN + VI.
// Dữ liệu: tên + từ khoá Unicode CLDR (EN + VI) đã có trong manifest sticker (manifest.generated.ts + manifestExt.generated.ts —
// tải ĐỘNG khi bắt đầu tìm, cùng các tệp mà tab Nhãn dán dùng) + từ khoá tiếng Việt viết tay (keywordsVi.ts: "cảm ơn" → 🙏).
// So khớp KHÔNG DẤU (foldVi): "cam on" = "cảm ơn", "tim" = "tim". Điểm của 1 emoji = cụm khớp tốt nhất:
//   trùng nguyên văn / nguyên từ / nguyên cụm 3 > đầu từ / đủ các từ ("tim do" ↔ "trái tim màu đỏ") 2 > chuỗi con (≥ 3 ký tự) 1
//   +0,5 khi trùng ở TÊN · +0,15 khi cụm khớp cùng ngôn ngữ giao diện ("cat": EN → 🐱, VI → "cắt" 💇‍♀️)
//   +0,7 nếu từ khoá viết tay chỉ thẳng emoji đó ("cười" → 😂 🤣) · +0,3 nếu qua cả bộ ("tim" → bộ Tim).
// Hoà điểm → thứ tự trên bàn phím (❤️ trước 💕). Mọi chuỗi đã bỏ dấu + tách từ SẴN khi dựng chỉ mục → mỗi phím gõ chỉ là vài
// nghìn phép so sánh chuỗi ngắn (≈ 0,2 ms trên máy tính; mục tiêu < 16 ms trên điện thoại tầm trung).
import { foldVi } from "@/lib/chat/fold";
import { KEYWORDS_VI } from "./keywordsVi";
import { packItems } from "./search";

/** Ký tự (không FE0F) → [từ EN, từ VI] (phần tử đầu = tên). */
export type EmojiWords = Map<string, [string[], string[]]>;

const VS16 = /️/g;
const bare = (g: string) => g.replace(VS16, "");

/** Dòng "ký tự \t en|en \t vi|vi" (định dạng WORDS / WORDS_EXT của manifest) → bảng từ. */
export function parseEmojiWords(...blocks: string[]): EmojiWords {
  const out: EmojiWords = new Map();
  for (const block of blocks)
    for (const line of block.split("\n")) {
      if (!line) continue;
      const [g, en, vi] = line.split("\t");
      if (g && !out.has(g)) out.set(g, [en ? en.split("|") : [], vi ? vi.split("|") : []]);
    }
  return out;
}

let wordsPromise: Promise<EmojiWords> | null = null;
/** Tải từ khoá (2 tệp manifest, tải động 1 lần / phiên). */
export function loadEmojiWords(): Promise<EmojiWords> {
  if (!wordsPromise)
    wordsPromise = Promise.all([import("./manifest.generated"), import("./manifestExt.generated")])
      .then(([c, e]) => parseEmojiWords(c.WORDS, e.WORDS_EXT))
      .catch((err) => {
        wordsPromise = null;
        throw err;
      });
  return wordsPromise;
}

interface Text {
  t: string; // đã bỏ dấu, chữ thường
  w: string[]; // các từ
  name: boolean; // là TÊN → +0,5
  vi: boolean; // cụm tiếng Việt
}
interface Entry {
  glyph: string;
  texts: Text[];
  order: number;
}
export interface EmojiIndex {
  entries: Entry[];
  /** Từ khoá VI viết tay (đã bỏ dấu) → [vị trí emoji, điểm cộng] (+0,7 đích trực tiếp, +0,3 qua cả bộ) */
  hand: (Text & { targets: [number, number][] })[];
}

const mkText = (s: string, name: boolean, vi: boolean): Text => {
  const t = foldVi(s).trim().replace(/\s+/g, " ");
  return { t, w: t.split(" "), name, vi };
};

/** Dựng chỉ mục cho danh sách emoji của bàn phím (bỏ trùng, giữ thứ tự). */
export function buildEmojiIndex(glyphs: string[], words: EmojiWords): EmojiIndex {
  const entries: Entry[] = [];
  const pos = new Map<string, number>();
  for (const g of glyphs) {
    const b = bare(g);
    if (pos.has(b)) continue;
    const [en, vi] = words.get(b) ?? [[], []];
    const texts: Text[] = [];
    en.forEach((k, i) => k && texts.push(mkText(k, i === 0, false)));
    vi.forEach((k, i) => k && texts.push(mkText(k, i === 0, true)));
    pos.set(b, entries.length);
    entries.push({ glyph: g, texts, order: entries.length });
  }
  const hand: EmojiIndex["hand"] = [];
  for (const [key, targets] of Object.entries(KEYWORDS_VI)) {
    const hits = new Map<number, number>();
    const hit = (i: number | undefined, bonus: number) => i !== undefined && (hits.get(i) ?? 0) < bonus && hits.set(i, bonus);
    for (const t of targets) {
      if (t.startsWith("pack:")) for (const id of packItems(t.slice(5))) hit(pos.get(bare(id)), 0.3);
      else hit(pos.get(bare(t)), 0.7);
    }
    if (hits.size) hand.push({ ...mkText(key, false, true), targets: [...hits] });
  }
  return { entries, hand };
}

/**
 * 3 = trùng nguyên văn / nguyên từ / nguyên cụm · 2 = đầu chuỗi / đầu từ / đủ mọi từ của truy vấn (từ cuối được phép đang gõ
 * dở) · 1 = chuỗi con (≥ 3 ký tự) · 0.
 */
function score(q: string, qw: string[], x: Text): number {
  const { t, w } = x;
  if (t === q) return 3;
  if (qw.length > 1 ? ` ${t} `.includes(` ${q} `) : w.includes(q)) return 3;
  if (t.startsWith(q)) return 2;
  if (qw.length === 1) {
    for (const word of w) if (word.startsWith(q)) return 2;
  } else {
    const last = qw[qw.length - 1];
    let all = w.some((word) => word.startsWith(last));
    for (let i = 0; all && i < qw.length - 1; i++) all = w.includes(qw[i]);
    if (all) return 2;
  }
  if (q.length >= 3 && t.includes(q)) return 1;
  return 0;
}

/** Emoji khớp `query` (đã xếp hạng). `lang` = ngôn ngữ giao diện (ưu tiên cụm cùng ngôn ngữ). Truy vấn rỗng → []. */
export function searchEmoji(query: string, idx: EmojiIndex, lang: "vi" | "en" = "en", limit = 96): string[] {
  const q = foldVi(query).trim().replace(/\s+/g, " ");
  if (!q) return [];
  const qw = q.split(" ");
  const vi = lang === "vi";
  const n = idx.entries.length;
  const base = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let b = 0;
    for (const x of idx.entries[i].texts) {
      const s = score(q, qw, x);
      if (!s) continue;
      const v = s + (x.name ? 0.5 : 0) + (x.vi === vi ? 0.15 : 0);
      if (v > b) b = v;
    }
    base[i] = b;
  }
  // từ khoá viết tay: cộng thêm (emoji không khớp CLDR thì lấy điểm của chính từ khoá)
  const handScore = new Float64Array(n);
  const handBonus = new Float64Array(n);
  for (const h of idx.hand) {
    const s = score(q, qw, h);
    if (!s) continue;
    for (const [i, bonus] of h.targets) {
      if (handScore[i] < s) handScore[i] = s;
      if (s >= 2 && handBonus[i] < bonus) handBonus[i] = bonus; // chỉ cộng khi từ khoá khớp thật (không phải chuỗi con)
    }
  }
  const final = new Float64Array(n);
  const hits: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = base[i] || handScore[i];
    if (!b) continue;
    final[i] = b + handBonus[i];
    hits.push(i);
  }
  hits.sort((a, b) => final[b] - final[a] || idx.entries[a].order - idx.entries[b].order);
  return hits.slice(0, limit).map((i) => idx.entries[i].glyph);
}
