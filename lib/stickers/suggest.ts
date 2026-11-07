// Gợi ý nhãn dán theo emoji đang gõ (thanh mảnh phía trên ô soạn tin, kiểu Telegram): gõ "😂" → các nhãn 😂 động (Noto) +
// 3D (Fluent) + nhãn LIÊN QUAN (🤣, 😆 …). THUẦN — không gọi mạng: cùng ký tự lấy từ ids.generated.ts (đã có trong bundle);
// liên quan lấy từ từ khoá Unicode CLDR của manifest lõi (nếu đã nạp — tệp JS tĩnh của chính app, tab Nhãn dán cũng dùng)
// và từ khoá tiếng Việt viết tay (keywordsVi.ts). Mạng chỉ dùng cho ảnh nhỏ của nhãn (thumbUrl).
//
// Liên quan = có chung từ khoá CLDR tiếng Anh, chấm theo IDF (từ hiếm như "haha", "tears" nặng hơn từ chung như "face"):
// tổng IDF ≥ 6 mới tính (dưới ngưỡng này là ghép nhầm kiểu 🔥 → 🛠️ vì cùng "tool"); cùng nhóm viết tay ("cười" → 😂 🤣) +8.
// Mỗi ký tự chỉ 1 nhãn (ưu tiên bản động Noto). Thứ tự: Noto cùng ký tự → 3D cùng ký tự → liên quan (điểm, độ phổ biến).
import { STICKER_GLYPH } from "./ids.generated";
import { KEYWORDS_VI } from "./keywordsVi";
import { notoIdFor } from "./urls";
import type { Manifest } from "./manifest";
import type { StickerId } from "./packs";

const VS16 = /️/g;
const SKIN = /[\u{1F3FB}-\u{1F3FF}]/gu;
/** Khoá so ký tự: bỏ FE0F + màu da (nhãn dán không có biến thể màu da). */
const glyphKey = (g: string) => g.replace(VS16, "").replace(SKIN, "");

let fluentByGlyph: Map<string, StickerId[]> | null = null;
function fluentFor(key: string): StickerId[] {
  if (!fluentByGlyph) {
    fluentByGlyph = new Map();
    for (const [id, g] of Object.entries(STICKER_GLYPH)) {
      if (!id.startsWith("fl:")) continue;
      const k = glyphKey(g);
      const arr = fluentByGlyph.get(k);
      if (arr) arr.push(id);
      else fluentByGlyph.set(k, [id]);
    }
  }
  return fluentByGlyph.get(key) ?? [];
}

/** Nhãn CÙNG ký tự (không cần manifest): bản động Noto trước, rồi bản 3D Fluent trong bộ. */
export function exactStickers(glyph: string): StickerId[] {
  const noto = notoIdFor(glyph);
  return [...(noto ? [noto] : []), ...fluentFor(glyphKey(glyph))];
}

interface Idf {
  df: Map<string, number>;
  n: number;
  kw: Map<StickerId, string[]>;
}
const idfCache = new WeakMap<Manifest, Idf>();
function idfOf(m: Manifest): Idf {
  let x = idfCache.get(m);
  if (x) return x;
  const df = new Map<string, number>();
  const kw = new Map<StickerId, string[]>();
  for (const id of Object.keys(m)) {
    const k = [...new Set(m[id].en.slice(1).map((s) => s.toLowerCase()))];
    kw.set(id, k);
    for (const w of k) df.set(w, (df.get(w) ?? 0) + 1);
  }
  x = { df, n: kw.size, kw };
  idfCache.set(m, x);
  return x;
}

/** Nhóm viết tay chứa ký tự này ("cười" → 😂 🤣): các ký tự cùng nhóm (chỉ đích trực tiếp, không cả bộ). */
function handPeers(key: string): Set<string> {
  const out = new Set<string>();
  for (const targets of Object.values(KEYWORDS_VI)) {
    const direct = targets.filter((t) => !t.startsWith("pack:")).map((t) => (t.startsWith("fl:") ? STICKER_GLYPH[t] ?? "" : t));
    if (direct.some((g) => g && glyphKey(g) === key)) for (const g of direct) if (g) out.add(glyphKey(g));
  }
  out.delete(key);
  return out;
}

/** Nhãn LIÊN QUAN theo từ khoá (cần manifest lõi). Không gồm ký tự gốc. */
export function relatedStickers(glyph: string, m: Manifest, limit = 12): StickerId[] {
  const key = glyphKey(glyph);
  const { df, n, kw } = idfOf(m);
  const self = Object.keys(m).find((id) => glyphKey(m[id].glyph) === key && m[id].src === "noto") ?? Object.keys(m).find((id) => glyphKey(m[id].glyph) === key);
  const mine = new Set(self ? kw.get(self) ?? [] : []);
  const peers = handPeers(key);
  const score = new Map<StickerId, number>();
  for (const [id, k] of kw) {
    const g = glyphKey(m[id].glyph);
    if (g === key) continue;
    let s = peers.has(g) ? 8 : 0;
    for (const w of k) if (mine.has(w)) s += Math.log(n / (df.get(w) ?? n));
    if (s >= 6) score.set(id, s);
  }
  const ranked = [...score.entries()].sort(([a, sa], [b, sb]) => sb - sa || (m[b].p ?? 0) - (m[a].p ?? 0) || (a < b ? -1 : 1)).map(([id]) => id);
  // mỗi ký tự 1 nhãn, ưu tiên bản động Noto
  const seen = new Map<string, StickerId>();
  for (const id of ranked) {
    const g = glyphKey(m[id].glyph);
    const cur = seen.get(g);
    if (!cur) seen.set(g, id);
    else if (m[cur].src !== "noto" && m[id].src === "noto") seen.set(g, id);
  }
  const order: StickerId[] = [];
  const done = new Set<string>();
  for (const id of ranked) {
    const g = glyphKey(m[id].glyph);
    if (done.has(g)) continue;
    done.add(g);
    order.push(seen.get(g)!);
    if (order.length >= limit) break;
  }
  return order;
}

/** Thanh gợi ý: cùng ký tự + liên quan (khi đã có manifest), tối đa `limit`. [] = không hiện thanh. */
export function suggestStickers(glyph: string, m: Manifest | null, limit = 12): StickerId[] {
  const out = exactStickers(glyph);
  if (m) for (const id of relatedStickers(glyph, m, limit)) if (!out.includes(id)) out.push(id);
  return out.slice(0, limit);
}
