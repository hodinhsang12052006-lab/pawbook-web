// Brief ảnh cho Google Flow (Nano Banana): ảnh chụp portfolio tiệm nail, cận MỘT bàn tay, vuông 1:1.
// Bản TypeScript của bộ tạo brief đã dùng cho lô 2026-11 — admin bấm "Xuất brief" (components/designs/FlowImport)
// cho các mẫu chưa có ảnh Flow; mã brief = id mẫu, nên ảnh Flow đặt tên đúng mã là nhập được ngay.
// Xoay vòng trong MỖI lô 12 ảnh: màu da (≥ 60% da trung bình / sẫm), nền, tư thế tay. KHÔNG dùng nền len kem
// (khung ảnh cũ của máy vẽ) — ảnh mới phải khác hẳn ảnh cũ.

export const FLOW_BATCH_SIZE = 12;
export const FLOW_MODEL = "Nano Banana Pro";

export const ART_PATTERN: Record<string, string> = {
  solid: "a flawless solid one-colour manicure",
  velvet: "velvet magnetic cat-eye effect with a soft diffused shimmer band",
  foil: "delicate metallic foil flake accents",
  doublefrench: "double French tips: two fine parallel lines following the free edge",
  mixmatch: "a coordinated mix-and-match set, each nail a different but related design",
  french: "clean classic French tips",
  lines: "minimal hand-painted fine line art",
  ombre: "a seamless soft gradient ombre",
  jelly: "sheer translucent jelly polish",
  aura: "aura nails: a soft airbrushed glow blooming from the centre of each nail",
  droplet: "small clear 3D water-droplet gel accents",
  droplets: "small clear 3D water-droplet gel accents",
  chromefrench: "chrome French tips with a mirror finish",
  negative: "negative-space design with parts of the natural nail left bare",
  colorchrome: "a coloured chrome mirror-powder finish",
  "fr-micro": "ultra-thin micro French tips",
  stripes: "thin elegant hand-painted stripes",
  swirl: "flowing abstract hand-painted swirls",
  syrup: "syrup nails: sheer glossy layered colour like tinted glass",
  "mix-fall": "a mismatched autumn set, each nail a different fall design",
  chromeline: "raised 3D chrome line accents",
  dots: "small neat dotting-tool dots",
  "fr-skittle": "skittle French tips, each tip a different coordinated colour",
  glitterfade: "fine glitter fading from the tip toward the cuticle",
  marble: "realistic soft marble veining",
  gemcluster: "a small cluster of crystals near the cuticle on the accent nails",
  milkbath: "milk-bath nails: a milky translucent base with tiny suspended dried petals",
  chromedrops: "small chrome droplet accents",
  lace: "a fine hand-painted lace pattern",
  cleanmilky: "a clean milky sheer finish",
  blush: "a soft blush gradient",
  "fr-glitter": "glitter French tips",
  "fr-tortoise": "tortoiseshell French tips",
  "fr-halfmoon": "a half-moon manicure at the cuticle",
  "fr-deep": "deep French tips",
  "fr-pinkwhite": "classic pink-and-white French",
  tortoise: "a tortoiseshell pattern",
  chocodip: "a glossy chocolate-drip tip design",
  "fr-side": "side-swept asymmetric French tips",
  "fr-v": "V-shaped chevron French tips",
  leaf: "small hand-painted autumn leaves",
  leopard: "a soft hand-painted leopard print",
  checker: "a subtle checkerboard pattern",
  plaid: "a fine plaid pattern",
  stars: "tiny metallic star accents",
  charm3d: "small 3D charm accents",
  fawn: "soft fawn-spot print",
  // hoạ tiết lô 2026-11 chưa gặp — để brief lô sau vẫn có mô tả kỹ thuật
  babyboomer: "a soft baby-boomer fade from milky white to nude",
  pearls: "small pearl accents near the cuticle",
  gems: "a few small crystal accents",
  hearts: "tiny hand-painted hearts",
  floral: "delicate hand-painted flowers",
  blossom: "small hand-painted blossoms",
  gelflower: "small 3D gel flowers",
  polka: "neat polka dots",
  waves: "soft hand-painted waves",
  cherry: "tiny hand-painted cherries",
  auroracat: "an aurora magnetic cat-eye shimmer",
  snow: "fine hand-painted snowflakes",
  holly: "small hand-painted holly leaves and berries",
  ornament: "tiny hand-painted ornaments",
  candy: "sweet candy-stripe accents",
  "fr-wave": "wavy French tips",
};

export const ART_FINISH: Record<string, string> = {
  glossy: "high-gloss gel top coat",
  matte: "velvety matte top coat",
  chrome: "mirror chrome finish",
  cateye: "magnetic cat-eye shimmer",
  glitter: "fine glitter finish",
};

/** Màu da xoay vòng: 3/5 trung bình–sẫm, xếp để MỌI đoạn đầu ≥ 5 ảnh của một lô đều ≥ 60% da trung bình / sẫm. */
export const ART_SKIN: readonly { tone: string; deep: boolean }[] = [
  { tone: "medium tan", deep: true },
  { tone: "deep brown", deep: true },
  { tone: "fair", deep: false },
  { tone: "warm medium-brown", deep: true },
  { tone: "light olive", deep: false },
];
export const ART_BACKDROP: readonly string[] = [
  "a warm travertine stone surface",
  "soft natural linen fabric in oatmeal",
  "a light oak wooden tabletop",
  "smooth taupe satin",
  "a white marble tabletop with soft grey veining",
  "a matte sand-coloured ceramic tray",
  "a pale sage plaster background",
  "warm greige suede",
];
export const ART_POSE: readonly string[] = [
  "the hand rests naturally, fingers relaxed and slightly apart",
  "the hand is gently curved with the nails angled toward the camera",
  "a relaxed three-quarter view of the back of the hand",
  "the hand rests lightly with fingertips slightly raised",
];
export const ART_STYLE =
  "Soft natural window light, gentle realistic shadows, true-to-life colours, crisp focus on the nails, " +
  "shallow depth of field. Anatomically correct hand with five fingers and natural proportions, neat cuticles, " +
  "even nail length. Editorial salon portfolio quality. No text, no logo, no watermark, no rings or jewellery.";

export interface ArtDesign { code: string; titleEn: string; shape: string; pattern: string; finish: string }

const clean = (s: string) => String(s ?? "").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Phần riêng của 1 brief: "<da> hand with medium-length <dáng> nails: <mẫu>. <Tư thế>, on <nền>". `k` = vị trí trong lô. */
export function briefSubject(d: ArtDesign, k: number): string {
  const pat = ART_PATTERN[d.pattern] ?? "";
  const fin = ART_FINISH[d.finish] ?? "";
  const design = `${clean(d.titleEn) || "Custom nail design"}${pat ? ` (technique: ${pat})` : ""}${fin ? `, ${fin}` : ""}`;
  const shape = /^[a-z-]{2,20}$/.test(d.shape) ? d.shape : "almond";
  return `${ART_SKIN[k % ART_SKIN.length].tone} hand with medium-length ${shape} nails: ${design}. ` +
    `${cap(ART_POSE[k % ART_POSE.length])}, on ${ART_BACKDROP[k % ART_BACKDROP.length]}`;
}

/** Brief đầy đủ cho 1 ảnh (dán riêng lẻ vào Flow). */
export function briefPrompt(d: ArtDesign, k: number): string {
  return `Professional nail salon portfolio photograph, square format. Close-up of one ${briefSubject(d, k)}. ${ART_STYLE}`;
}

export interface FlowBatch { index: number; codes: string[]; text: string }

/** Chia lô 12 ảnh, mỗi lô 1 tin nhắn cho trợ lý Flow: vẽ đúng 1 ảnh / brief rồi ĐỔI TÊN ảnh đúng mã brief. */
export function flowBatches(list: readonly ArtDesign[], size = FLOW_BATCH_SIZE, model = FLOW_MODEL): FlowBatch[] {
  const out: FlowBatch[] = [];
  for (let i = 0; i < list.length; i += size) {
    const part = list.slice(i, i + size);
    const body = part.map((d, k) => `[${d.code}] ${briefSubject(d, k)}.`).join(" ");
    const text =
      `Create ${part.length} separate images with ${model}, square 1:1, exactly one image per brief, then rename each created image to exactly its brief code (e.g. ${part[0].code}). ` +
      `Every image is a professional nail salon portfolio photograph: a close-up of one hand as described in its brief. Shared style for every image: ${ART_STYLE} ` +
      `Briefs: ${body}`;
    out.push({ index: out.length, codes: part.map((d) => d.code), text });
  }
  return out;
}
