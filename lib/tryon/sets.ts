// BỘ MÓNG PHỐI (set composition) — mỗi móng 1 VAI, không còn "2 móng trơn + 2 móng dán cùng 1 sticker".
// Thợ nail thật làm bộ: 1 móng HERO (hoạ tiết chính đủ to), 1 móng ECHO (chi tiết NHỎ KHÁC cùng chủ đề — trăng thì sao,
// hoa to thì nụ, ma thì 2 con ma nhỏ / góc mạng nhện, cụm đá thì 1 viên lẻ, cherry thì đầu French đỏ), móng THREAD
// (kỹ thuật nối bộ nhìn rõ ở ảnh nhỏ: French đủ sâu màu phụ / French gương kim loại / nhũ loang) và móng QUIET (trơn 1
// màu trong bảng màu). Hoạ tiết lặp (chấm bi, sọc, da báo, bàn cờ…) chỉ trên ≤ 2 móng KHÔNG kề nhau, còn lại trơn.
// renderLook gọi expandSet đầu tiên → mọi nơi vẽ (kho mẫu, Thử mẫu, gợi ý 10 mẫu) đều ra bộ phối, cùng hạt giống
// look.seed → cùng kết quả.
import type { LookColors, NailOverride } from "./engine";
import { ALL_NAIL_PATTERNS, PROCEDURAL } from "./patterns";

type Role = NonNullable<NailOverride["role"]>;
type BeadPick = NonNullable<NailOverride["pick"]>;
interface Pal { c1: string; c2: string; m: string }
/** chi tiết ECHO của 1 hoạ tiết: mẫu khác (danh sách ưu tiên — mẫu mới của nhóm khác chưa có thì dùng mẫu cuối) / chọn
 *  hạt nào / cỡ / lật / dời; `colors` riêng (VD đầu French đỏ của cherry) */
interface EchoSpec { pattern?: string | string[]; pick?: BeadPick; scale?: number; mirror?: boolean; uShift?: number; tShift?: number; colors?: (p: Pal) => string[] }

const CHERRY = "#b3122e", ORANGE = "#c4541f";
const h32 = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** độ sáng L* (0–100) của mã hex — so tương phản 2 màu (đầu French trắng trên nền trắng sữa thì không thấy) */
function lstar(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 50;
  const v = parseInt(m[1], 16), ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  const Y = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}
/** mẫu mới của nhóm khác (holly, glitterfade, fr-*…) chỉ dùng khi bộ máy đã đăng ký vẽ được; không thì mẫu dự phòng */
const has = (id: string) => PROCEDURAL.has(id);
const avail = (ids: string | string[]) => { const a = Array.isArray(ids) ? ids : [ids]; return a.find(has) ?? a[a.length - 1]; };

// ECHO theo từng hoạ tiết. Không có trong bảng: hạt (đá / hoạ tiết vẽ) tự lấy phần nhỏ (bỏ hạt to nhất) hoặc 2 bản nhỏ;
// hoạ tiết nền (in lặp) lặp lại trên móng echo (hạt giống mỗi móng khác nhau → bố cục khác)
const ECHO: Record<string, EchoSpec[]> = {
  ghost: [{ pick: "twin", scale: 0.6 }, { pattern: "web" }],
  bats: [{ pick: "rest", scale: 0.95, mirror: true }],
  jackolantern: [{ pattern: "french", colors: (p) => [p.c1, ORANGE, p.m] }, { pick: "twin", scale: 0.58 }],
  skull: [{ pattern: "web" }],
  mummy: [{ pattern: "web" }, { pattern: "ghost", pick: "twin", scale: 0.6 }],
  eyeball: [{ pattern: "web" }],
  web: [{ pattern: "bats", pick: "rest", scale: 0.9 }],
  blackcat: [{ pattern: "moonstars", pick: "first", scale: 0.8 }],
  cherry: [{ pattern: "french", colors: (p) => [p.c1, CHERRY, p.m] }],
  hearts: [{ pick: "rest", scale: 0.9, mirror: true }],
  floral: [{ pick: "second", scale: 0.95 }],
  blossom: [{ pick: "second", scale: 0.95 }],
  leaf: [{ pick: "twin", scale: 0.6, mirror: true }],
  snow: [{ pick: "rest", scale: 1, mirror: true }],
  stars: [{ pick: "rest", scale: 1, mirror: true }],
  moonstars: [{ pick: "rest", scale: 1.1, mirror: true }],
  gems: [{ pick: "first" }],
  gemcluster: [{ pick: "first" }],
  pearls: [{ pick: "first" }],
  charm3d: [{ pattern: "pearls", pick: "all", scale: 0.62, uShift: -0.02 }],
  droplets: [{ pick: "rest" }], chromedrops: [{ pick: "rest" }], droplet: [{ pick: "rest" }],
  holly: [{ pattern: ["fr-candycane", "holly"], pick: "twin", scale: 0.58, colors: (p) => [p.c1, CHERRY, p.m] }],
  ornament: [{ pick: "first", scale: 0.55, mirror: true }],
  gelflower: [{ pick: "first", scale: 0.55, mirror: true }],
  tortoise: [{ pattern: ["fr-tortoise", "tortoise"] }],
  candy: [{ pattern: ["fr-candycane", "french"] }],
};
/** hoạ tiết in lặp: chỉ hero + echo (không kề nhau), móng còn lại trơn — chấm bi / sọc kín 4 móng nhìn như giấy dán tường */
const PRINTS = new Set(["leopard", "checker", "plaid", "polka", "stripes", "tortoise", "fawn", "marble", "foil", "lines", "chromeline", "candy"]);
/** móng trơn của bộ in lặp lấy màu PHỤ (màu chấm / đốm / ô) — như thợ làm: chấm bi trắng thì móng trơn trắng */
const QUIET_C2 = new Set(["polka", "stripes", "checker", "leopard", "plaid"]);
const SKIP = new Set(["solid", "mixmatch"]);

/**
 * Thứ tự móng theo vị trí trên bàn tay (trỏ → út; đủ 5 móng: cái → út): xếp theo hình chiếu tâm móng lên phương
 * vuông góc với hướng móng trung bình, rồi lật để móng ĐẦU MÚT HẸP NHẤT (ngón út) nằm cuối. Thứ tự móng trong Thử mẫu
 * là thứ tự chạm, không phải thứ tự ngón → không dùng chỉ số mảng.
 */
export function nailOrder(segs: { base: { x: number; y: number }; tip: { x: number; y: number }; hw: number }[]): number[] {
  const n = segs.length, ord = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return ord;
  let ax = 0, ay = 0;
  for (const s of segs) { const dx = s.tip.x - s.base.x, dy = s.tip.y - s.base.y, l = Math.hypot(dx, dy) || 1; ax += dx / l; ay += dy / l; }
  const key = (s: (typeof segs)[number]) => ((s.base.x + s.tip.x) / 2) * -ay + ((s.base.y + s.tip.y) / 2) * ax;
  ord.sort((a, b) => key(segs[a]) - key(segs[b]));
  if (segs[ord[0]].hw < segs[ord[n - 1]].hw) ord.reverse();
  return ord;
}

/**
 * Vai từng móng. look.hero / look.echo (chỉ số móng — kho mẫu truyền đúng ngón áp út / ngón trỏ của ảnh tay) thắng;
 * không có thì đoán theo vị trí (`order` trỏ → út): 4 móng hero 2 · echo 0; 5 móng hero 3 · echo 1; ≤ 3 móng hero 1.
 * Móng còn lại xếp gần hero trước (hoà thì móng xa echo trước) và xen kẽ thread / quiet.
 */
export function setRoles(n: number, look: Pick<LookColors, "hero" | "echo">, order?: number[]): { roles: Role[]; variant: number[]; hero: number; echo: number } {
  const ord = order && order.length === n ? order : Array.from({ length: n }, (_, i) => i);
  const pos = new Array<number>(n); ord.forEach((idx, p) => { pos[idx] = p; });
  const ok = (v: number | undefined): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  let hero: number, echo = -1;
  if (ok(look.hero)) {
    hero = look.hero;
    if (ok(look.echo) && look.echo !== hero) echo = look.echo;
    else if (n >= 4) { const p = pos[hero] >= 2 ? pos[hero] - 2 : pos[hero] + 2; if (p < n) echo = ord[p]; }
  } else {
    hero = ord[n <= 3 ? Math.min(1, n - 1) : n - 2];
    if (n >= 4) echo = ord[n - 4];
  }
  const roles = new Array<Role>(n).fill("quiet"), variant = new Array<number>(n).fill(0);
  roles[hero] = "hero";
  if (echo >= 0) roles[echo] = "echo";
  const rest = ord.filter((i) => i !== hero && i !== echo).sort((a, b) => {
    const d = Math.abs(pos[a] - pos[hero]) - Math.abs(pos[b] - pos[hero]);
    if (d) return d;
    return echo >= 0 ? Math.abs(pos[b] - pos[echo]) - Math.abs(pos[a] - pos[echo]) : pos[b] - pos[a];
  });
  rest.forEach((i, k) => { roles[i] = k % 2 ? "quiet" : "thread"; variant[i] = k >> 1; });
  return { roles, variant, hero, echo };
}

const isFrench = (p?: string) => !!p && (p === "french" || p === "chromefrench" || p === "doublefrench" || p.startsWith("fr-"));
/**
 * Móng THREAD: kỹ thuật nối bộ, nhìn rõ ở ảnh nhỏ — nhũ loang (nếu bộ máy có), French đủ sâu màu phụ (chỉ khi màu phụ
 * tương phản ≥ 25 L* với nền), French gương kim loại. Echo đã là French thì thread KHÔNG French nữa (2 móng cùng
 * kiểu) → nhũ loang / chrome kim loại cả móng. Biến thể k: móng thread thứ 2 (bộ 5 móng) khác móng thứ nhất.
 */
function threadFor(pal: Pal, seed: number, k: number, avoidFrench: boolean): NailOverride {
  const opts: NailOverride[] = [];
  const contrast = Math.abs(lstar(pal.c1) - lstar(pal.c2)) >= 25 && pal.c2.toLowerCase() !== pal.m.toLowerCase();
  if (has("glitterfade")) opts.push({ pattern: "glitterfade", colors: [pal.c1, pal.m, pal.m], finish: "glitter" });
  // half-moon (liềm ngược ở CHÂN móng, viền kim loại) khác hẳn đầu French của echo → vẫn dùng được khi echo là French
  if (contrast && has("fr-halfmoon")) opts.push({ pattern: "fr-halfmoon", colors: [pal.c1, pal.c2, pal.m] });
  if (!avoidFrench) {
    if (contrast) opts.push({ pattern: "french", colors: [pal.c1, pal.c2, pal.m] });
    // đầu gương bạc trên nền bạc thì chìm mất → chỉ khi kim loại khác hẳn nền
    if (Math.abs(lstar(pal.c1) - lstar(pal.m)) >= 10) opts.push({ pattern: "chromefrench", colors: [pal.c1, pal.c2, pal.m] });
  }
  opts.push({ pattern: "solid", colors: [pal.m, pal.m, pal.m], finish: "chrome" });
  // chrome kim loại cả móng chỉ là dự phòng khi không còn kiểu nào khác (bộ nào cũng có 1 móng gương thì nhàm)
  const pool = opts.length > 1 ? opts.slice(0, -1) : opts;
  return pool[(Math.floor(h32(seed, 71) * pool.length) + k) % pool.length];
}

/** BỘ THEO CHỦ ĐỀ (mix-*): mỗi móng 1 chi tiết khác nhau cùng 1 bảng màu (3 màu + 1 kim loại) — như bộ thợ vẽ thật */
type Theme = (p: Pal & { dark: string; light: string }, r: number) => Partial<Record<Role, NailOverride>>;
const THEMES: Record<string, Theme> = {
  "mix-halloween": ({ dark, light, m }, r) => {
    const v = Math.floor(r * 4);
    // dơi / mèo đen (hoạ tiết tối) nằm trên nền sáng; ma / bí ngô (sáng) trên nền tối. Nền xen kẽ như bộ Halloween thật
    // (đen – cam – đen – cam): echo cùng nền với hero (A), quiet + thread nền còn lại (B) — 2 móng kề nhau khác nền
    const A = v === 0 || v === 2 ? dark : light, B = A === dark ? light : dark;
    const hero: NailOverride[] = [
      { pattern: "ghost", colors: [dark, light, m] },
      { pattern: "bats", colors: [light, dark, dark] },
      { pattern: "jackolantern", colors: [dark, light, m] },
      { pattern: "blackcat", colors: [light, dark, m] },
    ];
    const echo: NailOverride[] = [
      { pattern: "ghost", pick: "twin", scale: 0.6, colors: [dark, light, m] },
      { pattern: "bats", pick: "rest", mirror: true, colors: [light, dark, dark] },
      { pattern: "french", colors: [dark, light, m] },
      { pattern: "moonstars", pick: "first", scale: 0.8, colors: [light, dark, m] },
    ];
    return {
      hero: hero[v], echo: echo[v],
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [B, m, m], finish: "glitter" } : v === 2 ? { pattern: "solid", colors: [m, m, m], finish: "chrome" } : { pattern: "chromefrench", colors: [B, A, m] },
      quiet: { pattern: "solid", colors: [B, A, m] },
    };
  },
  "mix-christmas": ({ dark, light, m }, r) => {
    const v = r < 0.5 ? 0 : 1;
    const hero = v === 0
      ? (has("holly") ? { pattern: "holly", colors: [light, dark, m] } : { pattern: "snow", colors: [dark, light, m] })
      : (has("ornament") ? { pattern: "ornament", colors: [light, dark, m] } : { pattern: "stars", colors: [dark, light, m] });
    return {
      hero,
      echo: { pattern: avail(["fr-candycane", "french"]), colors: [light, dark, m] },
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [light, m, m], finish: "glitter" } : { pattern: "solid", colors: [m, m, m], finish: "chrome" },
      quiet: { pattern: "velvet", colors: [dark, light, m], finish: "cateye" },
    };
  },
  "mix-valentine": ({ dark, light, m }) => ({
    hero: { pattern: "hearts", colors: [light, dark, m] },
    echo: { pattern: "french", colors: [light, dark, m] },
    thread: { pattern: "polka", colors: [light, dark, m] },
    quiet: { pattern: "solid", colors: [dark, light, m] },
  }),
  "mix-fall": ({ dark, light, m }) => ({
    hero: { pattern: "leaf", colors: [dark, light, m] },
    echo: { pattern: avail(["fr-tortoise", "tortoise"]), colors: [light, dark, m] },
    thread: has("colorchrome") ? { pattern: "colorchrome", colors: [light, light, m], finish: "chrome" } : { pattern: "solid", colors: [light, light, m], finish: "chrome" },
    quiet: { pattern: "solid", colors: [dark, light, m] },
  }),
  "mix-newyear": ({ dark, light, m }, r) => {
    const v = r < 0.5 ? 0 : 1;
    return {
      hero: { pattern: v ? "gemcluster" : "stars", colors: [dark, light, m] },
      echo: v ? { pattern: "gemcluster", pick: "first", colors: [dark, light, m] } : { pattern: "stars", pick: "rest", mirror: true, colors: [dark, light, m] },
      thread: has("glitterfade") ? { pattern: "glitterfade", colors: [dark, m, m], finish: "glitter" } : { pattern: "solid", colors: [m, m, m], finish: "chrome" },
      quiet: { pattern: "solid", colors: [light, dark, m] },
    };
  },
};
export const THEME_SETS = Object.keys(THEMES);

/**
 * Mẫu chung → bộ móng phối (look.nails theo vai). Giữ nguyên khi: đã có nails do nơi gọi tự ghép, hoạ tiết phủ mọi móng
 * (French, ombre, thạch…), sơn trơn / mix màu, hoạ tiết SVG ngoài bộ máy. Chấm bi + mắt mèo: trend thật là chấm bi thưa
 * trên CẢ 4 móng mắt mèo → giữ đủ 4 móng.
 */
export function expandSet(look: LookColors, n: number, order?: number[]): LookColors {
  if (n <= 0 || look.nails?.some(Boolean)) return look;
  const pat = look.pattern, theme = THEMES[pat];
  if (!theme) {
    if (pat === "polka" && look.finish === "cateye") return { ...look, nails: Array.from({ length: n }, () => ({ art: true })) };
    // họ French (fr-*) luôn phủ cả bộ, kể cả biến thể mới chưa kịp ghi vào ALL_NAIL_PATTERNS
    if (SKIP.has(pat) || ALL_NAIL_PATTERNS.has(pat) || pat.startsWith("fr-") || !(PROCEDURAL.has(pat) || ECHO[pat] || PRINTS.has(pat))) return look;
  }
  const cs = look.colors.length ? look.colors : ["#ec4899"];
  const pal: Pal = { c1: cs[0], c2: cs[1] ?? cs[0], m: cs[2] ?? (cs.length > 1 ? cs[cs.length - 1] : "#d4af37") };
  const { roles, variant, hero, echo } = setRoles(n, look, order);
  const seed = look.seed | 0;
  const nails: NailOverride[] = new Array(n);
  if (theme) {
    const L1 = lstar(pal.c1), L2 = lstar(pal.c2);
    const t = theme({ ...pal, dark: L1 <= L2 ? pal.c1 : pal.c2, light: L1 <= L2 ? pal.c2 : pal.c1 }, h32(seed, 3));
    for (let i = 0; i < n; i++) {
      const role = roles[i], base = t[role] ?? { pattern: "solid" };
      let o: NailOverride = { ...base };
      // bộ 5 móng: móng thread / quiet thứ 2 khác móng thứ nhất (không 2 móng y hệt)
      if (variant[i] && role === "thread") o = threadFor(pal, seed, variant[i], isFrench(t.echo?.pattern));
      if (variant[i] && role === "quiet") o = { pattern: "solid", colors: [o.colors?.[0] === pal.c1 ? pal.c2 : pal.c1] };
      nails[i] = { ...o, role, art: o.pattern !== "solid" };
    }
    return { ...look, nails, hero, echo: echo >= 0 ? echo : undefined };
  }
  const specs = ECHO[pat];
  const es = specs?.length ? specs[Math.floor(h32(seed, 5) * specs.length)] : undefined;
  const echoOv: NailOverride = { pattern: es?.pattern ? avail(es.pattern) : pat, pick: es?.pick, scale: es?.scale, mirror: es?.mirror ?? true, uShift: es?.uShift, tShift: es?.tShift, colors: es?.colors?.(pal) };
  for (let i = 0; i < n; i++) {
    const role = roles[i];
    if (role === "hero") nails[i] = { role, pattern: pat, art: true };
    else if (role === "echo") nails[i] = { ...echoOv, role, art: true };
    else if (role === "thread") nails[i] = { ...threadFor(pal, seed, variant[i], isFrench(echoOv.pattern)), role, art: true };
    else {
      // móng trơn: màu nền (hoạ tiết vẽ) / màu phụ (bộ in lặp); đồi mồi: thạch hổ phách như thợ làm
      const c2First = QUIET_C2.has(pat), alt = variant[i] % 2 === 1;
      const qc = (c2First !== alt) ? pal.c2 : pal.c1;
      nails[i] = pat === "tortoise" && !alt ? { role, pattern: "jelly", colors: [pal.c1, pal.c2, pal.m], art: true } : { role, pattern: "solid", colors: [qc, pal.c2, pal.m], art: false };
    }
  }
  return { ...look, nails, hero, echo: echo >= 0 ? echo : undefined };
}

// ---------------------------------------------------------------- hạt (đá / hoạ tiết vẽ) theo vai của móng
type BeadLike = { u: number; t: number; r: number; kind: string; rot?: number };
/** khối 3D GẮN (đá, ngọc trai, chấm, charm nơ): 1 viên lẻ đặt ở CHÂN móng; không được cắt ngang bởi mép móng */
const STONE = new Set(["gem", "pearl", "dot", "bow"]);
const SOLID3D = new Set(["gem", "pearl", "dot", "bow", "drop", "mdrop", "star", "eye"]);
/** cỡ tối thiểu (đơn vị nửa bề ngang móng) để chi tiết nhỏ vẫn đọc được ở ảnh kho mẫu (móng hw 31–56px) */
const FLOOR: Record<string, number> = { gem: 0.11, pearl: 0.11, dot: 0.1, drop: 0.12, mdrop: 0.12, star: 0.16, heart: 0.16, bow: 0.4, eye: 0.3 };
const LU = 2.8; // chiều dài móng ≈ 2.8 lần nửa bề ngang → đổi bán kính sang đơn vị dọc móng

/**
 * Áp vai / cỡ / lật / dời của móng (NailOverride) lên bộ hạt của hoạ tiết. ECHO lấy chi tiết NHỎ KHÁC: `rest` = bỏ hạt
 * to nhất (trăng+sao → chỉ sao, dơi to+2 dơi nhỏ → 2 dơi nhỏ), `first` = 1 viên to nhất thu nhỏ (cụm đá → 1 viên lẻ ở
 * chân móng), `second` = hạt to thứ 2 (hoa to → 1 nụ), `twin` = 2 bản nhỏ xếp chéo về góc đầu móng (ma → 2 con ma
 * nhỏ). Mặc định của echo: toàn đá → first; ≥ 2 hạt → rest; 1 hạt → twin.
 */
export function applyBeadOpts<B extends BeadLike>(beads: B[], ov?: NailOverride | null): B[] {
  if (!ov || !beads.length) return beads;
  const echo = ov.role === "echo";
  let pick: BeadPick = ov.pick ?? (echo ? (beads.every((b) => STONE.has(b.kind)) ? "first" : beads.length > 1 ? "rest" : "twin") : "all");
  if (pick === "rest" && beads.length < 2) pick = "twin";
  if (pick === "second" && beads.length < 2) pick = "first";
  const single = pick === "first" || pick === "second" || pick === "twin";
  if (pick === "all" && !ov.scale && !ov.mirror && !ov.uShift && !ov.tShift) return beads;
  const byR = [...beads].sort((a, b) => b.r - a.r);
  const sel = pick === "rest" ? byR.slice(1) : pick === "first" || pick === "twin" ? [byR[0]] : pick === "second" ? [byR[1]] : beads;
  const stone = sel.every((b) => STONE.has(b.kind));
  const sc = ov.scale ?? (pick === "twin" ? 0.6 : single ? (stone ? 0.62 : 0.65) : 1);
  const sg = ov.mirror ? -1 : 1, du = ov.uShift ?? 0, dt = ov.tShift ?? 0;
  const sized = (b: B, k = 1) => Math.max(sc * k < 1 ? FLOOR[b.kind] ?? 0.3 : 0, b.r * sc * k);
  let out: B[];
  if (single) {
    const b = sel[0];
    if (pick === "twin") {
      // 2 bản nhỏ xếp chéo (giữa móng lệch 1 bên → gần đầu móng lệch bên kia), nghiêng khác nhau như vẽ tay
      out = [{ ...b, u: 0.5, t: -0.3 * sg, r: sized(b), rot: (b.rot ?? 0) + 0.35 * sg }, { ...b, u: 0.76, t: 0.32 * sg, r: sized(b, 0.8), rot: (b.rot ?? 0) - 0.3 * sg }];
    } else out = [stone ? { ...b, u: 0.22, t: 0, r: sized(b) } : { ...b, u: 0.64, t: 0.3 * sg, r: sized(b), rot: (b.rot ?? 0) * sg }];
    out = out.map((x) => ({ ...x, u: x.u + du, t: x.t + dt }));
  } else {
    // giữ bố cục nhóm, thu / phóng quanh tâm nhóm, lật ngang qua giữa móng
    const cu = sel.reduce((a, b) => a + b.u, 0) / sel.length, ct = sel.reduce((a, b) => a + b.t, 0) / sel.length;
    out = sel.map((b) => ({ ...b, u: cu + (b.u - cu) * sc + du, t: sg * (ct + (b.t - ct) * sc) + dt, r: sized(b), rot: (b.rot ?? 0) * sg }));
  }
  // khối 3D (đá, giọt, charm) nằm trọn trong móng; hoạ tiết vẽ được tràn mép 1 chút (như vẽ tay)
  return out.map((b) => {
    const lim = SOLID3D.has(b.kind) ? Math.max(0, 0.9 - b.r) : Math.max(0, 1.05 - 0.5 * b.r), ru = b.r / LU;
    const u0 = SOLID3D.has(b.kind) ? 0.1 + ru : 0.12, u1 = SOLID3D.has(b.kind) ? 0.9 - ru : 0.92;
    return { ...b, t: Math.max(-lim, Math.min(lim, b.t)), u: Math.max(u0, Math.min(Math.max(u0, u1), b.u)) };
  });
}

