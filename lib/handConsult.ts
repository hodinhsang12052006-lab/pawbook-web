// "Soi tay tư vấn" — bộ quy tắc chuyên môn của PawNail (dùng chung máy chủ + client).
// AI CHỈ "nhìn" (màu da, dáng / độ dài móng, tình trạng thấy được). Quy trình làm, dáng + màu hợp,
// cảnh báo ngừng làm… đều tính TỪ BỘ QUY TẮC NÀY → lời khuyên nhất quán, không bịa, và thợ sửa lại
// được những gì AI nhìn sai (bấm bật / tắt tình trạng → kết quả tính lại ngay).

export type Part = "HAND" | "FOOT";
export const SKIN_TONES = ["fair", "light", "medium", "tan", "deep"] as const;
export const UNDERTONES = ["cool", "neutral", "warm"] as const;
export const FINGER_LENGTHS = ["short", "medium", "long"] as const;
export const BED_WIDTHS = ["narrow", "medium", "wide"] as const;
export const NAIL_LENGTHS = ["bitten", "short", "medium", "long"] as const;
export const SHAPES = ["round", "oval", "squoval", "square", "almond", "coffin", "stiletto"] as const;
export type SkinTone = (typeof SKIN_TONES)[number];
export type Undertone = (typeof UNDERTONES)[number];
export type FingerLength = (typeof FINGER_LENGTHS)[number];
export type BedWidth = (typeof BED_WIDTHS)[number];
export type NailLength = (typeof NAIL_LENGTHS)[number];
export type Shape = (typeof SHAPES)[number];
type L = [string, string]; // [vi, en]

export const LABELS = {
  skinTone: { fair: ["Rất sáng", "Fair"], light: ["Sáng", "Light"], medium: ["Trung bình", "Medium"], tan: ["Ngăm", "Tan"], deep: ["Sẫm", "Deep"] } as Record<SkinTone, L>,
  undertone: { cool: ["Tông lạnh (ánh hồng)", "Cool (pink)"], neutral: ["Trung tính", "Neutral"], warm: ["Tông ấm (ánh vàng)", "Warm (golden)"] } as Record<Undertone, L>,
  fingerLength: { short: ["Ngón ngắn", "Short fingers"], medium: ["Ngón vừa", "Medium fingers"], long: ["Ngón dài", "Long fingers"] } as Record<FingerLength, L>,
  bedWidth: { narrow: ["Lòng móng hẹp", "Narrow nail beds"], medium: ["Lòng móng vừa", "Medium nail beds"], wide: ["Lòng móng rộng", "Wide nail beds"] } as Record<BedWidth, L>,
  nailLength: { bitten: ["Móng cắn / sát thịt", "Bitten / very short"], short: ["Móng ngắn", "Short"], medium: ["Móng vừa", "Medium"], long: ["Móng dài", "Long"] } as Record<NailLength, L>,
  shape: { round: ["Tròn", "Round"], oval: ["Oval", "Oval"], squoval: ["Vuông bo góc", "Squoval"], square: ["Vuông", "Square"], almond: ["Hạnh nhân (almond)", "Almond"], coffin: ["Coffin / ballerina", "Coffin"], stiletto: ["Nhọn (stiletto)", "Stiletto"] } as Record<Shape, L>,
};

export interface ConditionDef {
  part: "BOTH" | "HAND" | "FOOT";
  label: L;
  /** Giải thích ngắn cho khách hiểu */
  what: L;
  /** Thợ làm gì ở bước xử lý */
  todo: L;
  minutes: number;
  /** Khách tự chăm ở nhà */
  care?: L;
  /** true → KHÔNG làm dịch vụ trên vùng đó, khuyên gặp bác sĩ */
  redFlag?: boolean;
}

export const CONDITIONS: Record<string, ConditionDef> = {
  dry_cuticles: {
    part: "BOTH", label: ["Da viền móng khô", "Dry cuticles"], minutes: 5,
    what: ["Da quanh móng khô, dễ bong và xước.", "Skin around the nails is dry and flaky."],
    todo: ["Làm mềm da bằng dầu / cuticle remover, đẩy nhẹ, chỉ cắt phần da chết đã rời — không cắt sâu vào da sống.", "Soften with oil / cuticle remover, push gently and only trim lifted dead skin — never cut live skin."],
    care: ["Thoa dầu dưỡng viền móng mỗi tối.", "Apply cuticle oil every night."],
  },
  cracked_skin: {
    part: "BOTH", label: ["Da tay nứt nẻ, khô ráp", "Cracked, rough skin"], minutes: 10,
    what: ["Da mu tay / ngón khô ráp, có vết nứt nhỏ.", "Skin on the hands / fingers is rough with small cracks."],
    todo: ["Tẩy da chết thật nhẹ, ủ kem dưỡng hoặc paraffin 5–10 phút. Tránh ngâm acetone lâu (dùng cách bọc foil từng ngón).", "Very gentle exfoliation, then a hydrating mask or paraffin for 5–10 min. Avoid long acetone soaks (wrap each finger in foil)."],
    care: ["Thoa kem dưỡng tay sau mỗi lần rửa tay, đeo găng khi rửa chén / dùng hoá chất.", "Use hand cream after every wash; wear gloves for dishes and cleaning products."],
  },
  hangnails: {
    part: "HAND", label: ["Xước măng rô", "Hangnails"], minutes: 3,
    what: ["Có mảnh da nhỏ xước ra ở khoé móng.", "Small torn bits of skin at the nail sides."],
    todo: ["Cắt gọn sát gốc bằng kềm đã tiệt trùng, không giật; thoa dầu dưỡng.", "Clip cleanly at the base with sterilised nippers (never pull), then apply oil."],
    care: ["Đừng cắn hay giật măng rô — dễ nhiễm trùng.", "Don't bite or pull hangnails — they get infected easily."],
  },
  thin_peeling: {
    part: "BOTH", label: ["Móng mỏng, tách lớp", "Thin, peeling nails"], minutes: 5,
    what: ["Mặt móng mỏng, đầu móng tách lớp, dễ gãy.", "Nail plates are thin and the tips peel and break easily."],
    todo: ["Không giũa mặt móng nhiều (chỉ buffer rất nhẹ). Gia cố bằng builder gel / BIAB lớp mỏng, giữ móng ngắn–vừa. Tránh bột acrylic dày.", "Minimal buffing only. Reinforce with a thin builder gel / BIAB layer and keep nails short–medium. Avoid thick acrylic."],
    care: ["Giữ móng ngắn vừa phải, không dùng móng cạy đồ.", "Keep nails at a moderate length and don't use them as tools."],
  },
  ridges: {
    part: "BOTH", label: ["Móng có gờ sọc", "Ridged nails"], minutes: 3,
    what: ["Mặt móng có đường gờ dọc, không phẳng.", "The nail surface has vertical ridges."],
    todo: ["Buffer rất nhẹ, dùng base gel làm phẳng (ridge filler) trước khi lên màu.", "Light buffing and a ridge-filling base gel before colour."],
  },
  bitten: {
    part: "HAND", label: ["Móng bị cắn, ngắn sát", "Bitten nails"], minutes: 10,
    what: ["Móng ngắn sát đầu ngón, viền không đều.", "Nails are bitten down to the fingertip with uneven edges."],
    todo: ["Giũa đều, dưỡng da đầu ngón. Nếu khách muốn dài hơn: nối Gel-X ngắn hoặc đắp builder gel tạo form — vừa đẹp vừa giúp bỏ tật cắn móng.", "File even and treat the fingertip skin. For more length: short Gel-X extensions or a builder-gel overlay — looks great and helps stop biting."],
    care: ["Lớp gel cứng giúp khó cắn hơn — giữ lịch dặm 2–3 tuần.", "A hard gel layer makes biting harder — keep 2–3 week fills."],
  },
  uneven: {
    part: "HAND", label: ["Móng dài ngắn không đều / gãy", "Uneven or broken nails"], minutes: 5,
    what: ["Có móng gãy hoặc dài ngắn khác nhau.", "Some nails are broken or at different lengths."],
    todo: ["Cắt về cùng độ dài, hoặc nối 1–2 móng gãy bằng tip / Gel-X cho đều.", "Cut to an even length, or extend the broken ones with tips / Gel-X."],
  },
  old_product_lifting: {
    part: "BOTH", label: ["Lớp gel / bột cũ bị hở", "Old gel / acrylic lifting"], minutes: 15,
    what: ["Lớp làm cũ đã hở chân, nước và vi khuẩn dễ lọt vào.", "The old set is lifting — water and bacteria can get underneath."],
    todo: ["Tháo sạch đúng cách (bọc foil acetone 10–15 phút, đẩy nhẹ) — không cạy, không giũa mạnh xuống mặt móng thật.", "Remove properly (acetone foil wraps 10–15 min, gentle push) — never pry or file hard into the natural nail."],
    care: ["Đừng để quá 3–4 tuần mới tháo / dặm.", "Don't go more than 3–4 weeks between removals / fills."],
  },
  yellow_stain: {
    part: "BOTH", label: ["Móng ố vàng", "Yellow staining"], minutes: 3,
    what: ["Móng ố vàng nhẹ, thường do sơn màu đậm không lót base.", "Light yellowing, usually from dark polish worn without a base coat."],
    todo: ["Buffer nhẹ, luôn lót base coat. Màu sữa / nude phủ đẹp; móng khoẻ dần sẽ hết ố.", "Light buffing and always a base coat. Milky / nude shades cover nicely; it fades as the nail grows."],
  },
  white_spots: {
    part: "BOTH", label: ["Đốm trắng trên móng", "White spots"], minutes: 0,
    what: ["Đốm trắng nhỏ thường do va chạm nhẹ — vô hại, sẽ mọc ra theo móng.", "Small white spots are usually from minor knocks — harmless and grow out."],
    todo: ["Làm bình thường; màu thạch / sữa che đẹp.", "Work as normal; jelly / milky shades cover them nicely."],
  },
  calluses: {
    part: "FOOT", label: ["Da chai", "Calluses"], minutes: 10,
    what: ["Da dày, chai ở gót / lòng bàn chân.", "Thick, hard skin on the heels / soles."],
    todo: ["Ngâm chân, chà bằng bàn chà / giũa chân và dung dịch làm mềm chai. KHÔNG dùng dao cạo (nhiều bang cấm, dễ chảy máu).", "Soak, then use a foot file and callus softener. NO razor blades (banned in many states and easily cuts)."],
    care: ["Thoa kem dưỡng chân có urea mỗi tối, mang vớ.", "Use a urea foot cream every night and wear socks."],
  },
  cracked_heels: {
    part: "FOOT", label: ["Nứt gót chân", "Cracked heels"], minutes: 8,
    what: ["Gót chân khô, có vết nứt.", "Heels are dry with fissures."],
    todo: ["Làm mềm, chà nhẹ — không chà vào vết nứt sâu đang rướm máu; ủ kem / paraffin.", "Soften and file gently — never into deep or bleeding cracks; finish with cream / paraffin."],
    care: ["Kem urea 10–25% mỗi tối; nứt sâu, đau → gặp bác sĩ.", "10–25% urea cream nightly; deep painful cracks → see a doctor."],
  },
  ingrown_risk: {
    part: "FOOT", label: ["Khoé móng chân đâm vào da", "Ingrown toenail risk"], minutes: 3,
    what: ["Khoé móng chân cong, có xu hướng đâm vào da.", "The toenail edge curves into the skin."],
    todo: ["Cắt THẲNG ngang, không khoét sâu khoé. Nếu sưng, đỏ, đau → không xử lý, khuyên khách gặp bác sĩ.", "Cut STRAIGHT across, never dig into the corners. If swollen, red or painful → don't treat, refer to a doctor."],
    care: ["Mang giày rộng mũi, cắt móng thẳng ngang.", "Wear roomy shoes and cut straight across."],
  },
  // ---- Dấu hiệu phải NGỪNG — thợ nail không được chữa ----
  possible_fungus: {
    part: "BOTH", label: ["Nghi nấm móng", "Possible nail fungus"], minutes: 0, redFlag: true,
    what: ["Móng dày, vàng / nâu, mủn hoặc bong khỏi nền móng.", "Thick, yellow / brown, crumbly or detached nail."],
    todo: ["KHÔNG làm dịch vụ trên móng này (dễ lây sang móng khác và khách khác). Khuyên khách gặp bác sĩ da liễu; khử trùng dụng cụ đã chạm vào.", "Do NOT service this nail (it spreads to other nails and clients). Refer to a dermatologist and disinfect any tools that touched it."],
  },
  inflammation: {
    part: "BOTH", label: ["Sưng đỏ quanh móng", "Redness / swelling"], minutes: 0, redFlag: true,
    what: ["Viền móng sưng, đỏ, đau hoặc có mủ — có thể nhiễm trùng.", "Swollen, red, painful or pus around the nail — possible infection."],
    todo: ["KHÔNG làm trên ngón đó. Khuyên khách đi khám; hẹn lại khi đã lành.", "Do NOT work on that finger/toe. Advise a doctor visit and rebook once healed."],
  },
  open_wound: {
    part: "BOTH", label: ["Vết thương hở", "Open cut / wound"], minutes: 0, redFlag: true,
    what: ["Có vết đứt / trầy đang hở hoặc rướm máu.", "There is an open or bleeding cut."],
    todo: ["Không ngâm, không dùng hoá chất lên vùng đó. Dán băng; làm các ngón khác nếu khách đồng ý.", "No soaking or chemicals on that area. Cover it; service other nails only if the client agrees."],
  },
  skin_rash: {
    part: "BOTH", label: ["Mẩn đỏ / nghi dị ứng gel", "Rash / possible gel allergy"], minutes: 0, redFlag: true,
    what: ["Da quanh móng mẩn đỏ, ngứa, nổi mụn nước — có thể dị ứng gel / acrylic.", "Red, itchy or blistering skin around the nails — possible gel / acrylic allergy."],
    todo: ["Ngừng gel / bột trên khách này. Khuyên gặp bác sĩ; lần sau chỉ dùng sơn thường hoặc gel HEMA-free, không để sản phẩm chạm da.", "Stop gel / acrylic for this client. Refer to a doctor; next time use regular polish or HEMA-free gel and keep product off the skin."],
  },
};
export const CONDITION_IDS = Object.keys(CONDITIONS);

export interface Perception {
  part: Part;
  skinTone: SkinTone;
  undertone: Undertone;
  fingerLength: FingerLength;
  bedWidth: BedWidth;
  nailLength: NailLength;
  currentShape: Shape | null;
  hasProduct: boolean;
  conditions: string[];
}

export interface Prefs {
  occasion?: "work" | "party" | "wedding" | "daily" | "vacation" | null;
  length?: "short" | "medium" | "long" | null;
  vibe?: "natural" | "cute" | "bold" | null;
}

export interface Swatch { hex: string; name: L }
export interface PlanStep { title: L; detail: L; minutes: number; flag?: boolean }
export interface Advice {
  redFlags: string[];
  conditions: string[];
  shapes: { id: Shape; why: L }[];
  avoidShapes: Shape[];
  length: L;
  technique: { id: string; why: L };
  finishes: string[];
  palette: Swatch[];
  steps: PlanStep[];
  totalMinutes: number;
  care: L[];
}

const PALETTES: Record<Undertone, Swatch[]> = {
  cool: [
    { hex: "#F4C2C2", name: ["Hồng baby", "Baby pink"] }, { hex: "#C8A2C8", name: ["Tím lavender", "Lavender"] }, { hex: "#8E2443", name: ["Đỏ mận", "Plum red"] },
    { hex: "#1F3A93", name: ["Xanh cobalt", "Cobalt"] }, { hex: "#C9CCD3", name: ["Bạc chrome", "Silver chrome"] }, { hex: "#F7F3F0", name: ["Trắng sữa", "Milky white"] },
  ],
  neutral: [
    { hex: "#E6C7B8", name: ["Nude hồng", "Rosy nude"] }, { hex: "#9E2B3A", name: ["Đỏ rượu", "Wine red"] }, { hex: "#F5F1EC", name: ["Trắng sữa", "Milky white"] },
    { hex: "#9CAF88", name: ["Xanh sage", "Sage"] }, { hex: "#1E1E1E", name: ["Đen bóng", "Glossy black"] }, { hex: "#B08A78", name: ["Mocha", "Mocha"] },
  ],
  warm: [
    { hex: "#E8B796", name: ["Nude đào", "Peach nude"] }, { hex: "#C65D3B", name: ["Cam đất", "Terracotta"] }, { hex: "#A0322A", name: ["Đỏ gạch", "Brick red"] },
    { hex: "#D4AF37", name: ["Vàng gold", "Gold"] }, { hex: "#6B7B3A", name: ["Xanh olive", "Olive"] }, { hex: "#F3E5AB", name: ["Kem bơ", "Butter cream"] },
  ],
};
const TONE_EXTRA: Record<SkinTone, Swatch[]> = {
  fair: [{ hex: "#FADADD", name: ["Hồng thạch", "Sheer pink"] }, { hex: "#B7C9E2", name: ["Xanh pastel", "Pastel blue"] }],
  light: [{ hex: "#F2C6B4", name: ["Hồng đào", "Peach pink"] }, { hex: "#D2042D", name: ["Đỏ cherry", "Cherry red"] }],
  medium: [{ hex: "#C08081", name: ["Hồng đất", "Dusty rose"] }, { hex: "#E2725B", name: ["Coral", "Coral"] }],
  tan: [{ hex: "#E2725B", name: ["Coral", "Coral"] }, { hex: "#FFC72C", name: ["Vàng nắng", "Sunny yellow"] }],
  deep: [{ hex: "#6F4E37", name: ["Nude chocolate", "Chocolate nude"] }, { hex: "#E5B80B", name: ["Gold chrome", "Gold chrome"] }],
};
// Phong cách khách thích → ưu tiên tông
const VIBE_PICK: Record<NonNullable<Prefs["vibe"]>, (s: Swatch) => number> = {
  natural: (s) => (lightness(s.hex) > 0.75 ? 2 : lightness(s.hex) > 0.55 ? 1 : 0),
  cute: (s) => (lightness(s.hex) > 0.7 && saturation(s.hex) > 0.2 ? 2 : 0),
  bold: (s) => (saturation(s.hex) > 0.45 || lightness(s.hex) < 0.25 ? 2 : 0),
};

const has = (p: Perception, id: string) => p.conditions.includes(id);

/** Tính toàn bộ lời khuyên từ những gì AI (hoặc thợ) nhìn thấy + sở thích của khách. */
export function buildAdvice(p: Perception, prefs: Prefs = {}): Advice {
  const conds = p.conditions.filter((c) => CONDITIONS[c] && (CONDITIONS[c].part === "BOTH" || CONDITIONS[c].part === p.part));
  const q: Perception = { ...p, conditions: conds };
  const redFlags = conds.filter((c) => CONDITIONS[c].redFlag);
  const weak = has(q, "thin_peeling") || has(q, "bitten");
  const foot = p.part === "FOOT";

  // ---- Dáng móng ----
  const shapes: { id: Shape; why: L }[] = [];
  const add = (id: Shape, why: L) => { if (!shapes.some((s) => s.id === id)) shapes.push({ id, why }); };
  const avoid = new Set<Shape>();
  if (foot) {
    add("square", ["Cắt thẳng ngang — chuẩn cho móng chân, tránh đâm khoé.", "Straight across — right for toenails, prevents ingrowns."]);
    add("squoval", ["Vuông bo nhẹ góc, gọn và không cấn giày.", "Softened square — neat and comfortable in shoes."]);
    avoid.add("stiletto"); avoid.add("almond"); avoid.add("coffin");
  } else {
    if (weak) {
      add("squoval", ["Móng yếu: vuông bo góc chịu lực tốt nhất, ít gãy.", "Weak nails: squoval spreads stress best and breaks least."]);
      add("oval", ["Oval ngắn mềm mại, nhìn sạch và khoẻ.", "A short oval looks clean and healthy."]);
      avoid.add("stiletto");
    }
    if (p.fingerLength === "short" || p.bedWidth === "wide") {
      add("almond", ["Hạnh nhân giúp ngón trông thon và dài hơn.", "Almond makes fingers look slimmer and longer."]);
      add("oval", ["Oval kéo dài ngón, hợp lòng móng rộng.", "Oval elongates fingers and suits wide nail beds."]);
      avoid.add("square");
    }
    if (p.fingerLength === "long" && p.bedWidth !== "wide") {
      add("coffin", ["Ngón dài hợp coffin — sang và nổi bật.", "Long fingers carry coffin beautifully."]);
      add("square", ["Vuông hiện đại, hợp ngón thon dài.", "Modern square suits long slim fingers."]);
    }
    add("almond", ["Hạnh nhân hợp hầu hết dáng tay, thanh lịch.", "Almond flatters almost every hand."]);
    add("squoval", ["Vuông bo góc gọn gàng, dễ giữ.", "Squoval is tidy and easy to maintain."]);
    if (p.bedWidth === "narrow") avoid.add("stiletto");
  }
  const shapeList = shapes.filter((s) => !avoid.has(s.id)).slice(0, 3);

  // ---- Độ dài ----
  const length: L = foot
    ? ["Ngắn, ngang đầu ngón chân", "Short, level with the toe tip"]
    : has(q, "bitten")
      ? ["Ngắn — muốn dài hơn thì nối Gel-X ngắn", "Short — add short Gel-X if more length is wanted"]
      : has(q, "thin_peeling")
        ? ["Ngắn đến vừa (để móng khoẻ lại)", "Short to medium (let the nails recover)"]
        : prefs.length === "long"
          ? ["Dài — nên nối Gel-X / bột cho chắc", "Long — use Gel-X / acrylic for strength"]
          : prefs.length === "short"
            ? ["Ngắn gọn, sạch sẽ", "Short and clean"]
            : ["Vừa — dài hơn đầu ngón 2–4 mm", "Medium — 2–4 mm past the fingertip"];

  // ---- Kỹ thuật ----
  const technique: Advice["technique"] = has(q, "skin_rash")
    ? { id: "Sơn thường", why: ["Nghi dị ứng gel → chỉ sơn thường / gel HEMA-free.", "Possible gel allergy → regular polish or HEMA-free gel only."] }
    : has(q, "bitten") && !foot
      ? { id: "Gel-X", why: ["Nối Gel-X tạo độ dài đều, nhẹ, không hại móng thật.", "Gel-X adds even, lightweight length without harming the natural nail."] }
      : has(q, "thin_peeling")
        ? { id: "Builder gel", why: ["Builder gel / BIAB gia cố móng mỏng, giúp móng mọc khoẻ.", "Builder gel / BIAB reinforces thin nails while they grow out."] }
        : prefs.length === "long" && !foot
          ? { id: "Gel-X", why: ["Móng dài nên nối để bền, đều.", "Long sets last better as extensions."] }
          : { id: "Gel", why: ["Móng khoẻ → sơn gel bóng đẹp 2–3 tuần.", "Healthy nails → gel polish lasts 2–3 weeks."] };

  // ---- Hiệu ứng ----
  const finishes = prefs.occasion === "party" || prefs.vibe === "bold" ? ["chrome", "cateye", "glitter"]
    : prefs.occasion === "wedding" ? ["glossy", "chrome", "glitter"]
      : prefs.occasion === "work" || prefs.vibe === "natural" ? ["glossy", "matte"]
        : ["glossy", "cateye", "chrome"];

  // ---- Bảng màu ----
  let palette = [...PALETTES[p.undertone], ...TONE_EXTRA[p.skinTone]];
  palette = palette.filter((s, i) => palette.findIndex((x) => x.hex === s.hex) === i);
  if (prefs.vibe) { const f = VIBE_PICK[prefs.vibe]; palette = [...palette].sort((a, b) => f(b) - f(a)); }
  if (prefs.occasion === "work") palette = [...palette].sort((a, b) => lightness(b.hex) - lightness(a.hex));
  palette = palette.slice(0, 8);

  // ---- Quy trình ----
  const steps: PlanStep[] = [];
  const S = (title: L, detail: L, minutes: number, flag = false) => steps.push({ title, detail, minutes, flag });
  for (const c of redFlags) S(CONDITIONS[c].label, CONDITIONS[c].todo, 0, true);
  if (has(q, "old_product_lifting") || p.hasProduct) S(["Tháo lớp cũ", "Remove old product"], CONDITIONS.old_product_lifting.todo, 15);
  S(["Sát khuẩn", "Sanitise"], ["Sát khuẩn tay thợ và tay khách, dụng cụ đã tiệt trùng.", "Sanitise your hands and the client's; use sterilised tools."], 2);
  if (foot) S(["Ngâm chân", "Foot soak"], ["Ngâm nước ấm 5–8 phút trong bồn đã khử trùng (lót túi dùng 1 lần).", "Warm soak 5–8 min in a disinfected tub (single-use liner)."], 8);
  const shapeName = shapeList[0] ? LABELS.shape[shapeList[0].id] : (["", ""] as L);
  S(["Cắt & giũa dáng", "Cut & shape"], [`Cắt đều, giũa dáng ${shapeName[0].toLowerCase()} — giũa 1 chiều, không cưa qua lại.`, `Even length, file into ${shapeName[1].toLowerCase()} — one direction, no sawing.`], 6);
  if (!has(q, "dry_cuticles")) S(["Làm da", "Cuticle care"], ["Đẩy da, làm sạch mặt móng, chỉ cắt da chết đã rời.", "Push back cuticles, clean the plate, trim only lifted dead skin."], 6);
  for (const c of conds) if (!CONDITIONS[c].redFlag && c !== "old_product_lifting" && CONDITIONS[c].minutes > 0) S(CONDITIONS[c].label, CONDITIONS[c].todo, CONDITIONS[c].minutes);
  if (technique.id === "Gel-X") S(["Nối Gel-X", "Gel-X extensions"], ["Chọn size tip vừa khít từng móng, lót primer + gel dán, chiếu đèn từng ngón.", "Size tips per nail, prime, apply extend gel and cure finger by finger."], 30);
  if (technique.id === "Builder gel") S(["Gia cố builder gel", "Builder-gel overlay"], ["Đắp 1 lớp builder gel mỏng, tạo apex nhẹ để chịu lực.", "Apply a thin builder-gel layer with a soft apex for strength."], 15);
  S(["Lên màu & hoàn thiện", "Colour & finish"], technique.id === "Sơn thường"
    ? ["Base coat → 2 lớp màu → top coat, không để sơn dính da.", "Base → two colour coats → top coat, keeping product off the skin."]
    : ["Base gel → 2 lớp màu mỏng → top gel, chiếu đèn đủ thời gian, lau lớp dính.", "Base gel → two thin colour coats → top gel, full cure, wipe the inhibition layer."], technique.id === "Sơn thường" ? 15 : 20);
  S(["Dưỡng", "Hydrate"], has(q, "cracked_skin") || has(q, "cracked_heels")
    ? ["Thoa dầu viền móng + ủ kem / paraffin cho vùng da nứt nẻ.", "Cuticle oil plus cream / paraffin for the cracked skin."]
    : ["Thoa dầu viền móng và kem dưỡng.", "Cuticle oil and lotion."], has(q, "cracked_skin") || has(q, "cracked_heels") ? 8 : 3);

  const care: L[] = [];
  for (const c of conds) { const k = CONDITIONS[c].care; if (k && !care.some((x) => x[0] === k[0])) care.push(k); }
  care.push(technique.id === "Gel-X" || technique.id === "Builder gel"
    ? ["Hẹn dặm sau 2–3 tuần, đừng tự gỡ.", "Book a fill in 2–3 weeks — don't peel it off."]
    : ["Hẹn làm lại sau 2–3 tuần.", "Rebook in 2–3 weeks."]);

  return {
    redFlags,
    conditions: conds,
    shapes: shapeList,
    avoidShapes: [...avoid],
    length,
    technique,
    finishes,
    palette,
    steps,
    totalMinutes: steps.reduce((a, s) => a + s.minutes, 0),
    care: care.slice(0, 5),
  };
}

// ---------- So khớp mẫu ----------
function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lightness(hex: string) { const c = rgb(hex); if (!c) return 0.5; return (Math.max(...c) + Math.min(...c)) / 510; }
function saturation(hex: string) {
  const c = rgb(hex); if (!c) return 0;
  const mx = Math.max(...c) / 255, mn = Math.min(...c) / 255, l = (mx + mn) / 2;
  return mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
}
/** Khoảng cách màu (có trọng số theo cảm nhận mắt người), 0 = trùng. */
function colorDist(a: string, b: string) {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return 999;
  const rm = (x[0] + y[0]) / 2, dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export interface MatchableDesign { shape?: string | null; finish?: string | null; palette?: string[] | null; skills?: string[] | null; difficulty?: number | null; title?: string; occasion?: string | null }

/** Điểm hợp của 1 mẫu với lời khuyên (cao = hợp). */
export function scoreDesign(d: MatchableDesign, a: Advice, p: Perception): number {
  let s = 0;
  const si = a.shapes.findIndex((x) => x.id === d.shape);
  if (si === 0) s += 4; else if (si > 0) s += 3;
  if (d.shape && a.avoidShapes.includes(d.shape as Shape)) s -= 4;
  const fi = d.finish ? a.finishes.indexOf(d.finish) : -1;
  if (fi === 0) s += 2; else if (fi > 0) s += 1.5;
  const pal = (d.palette ?? []).filter((h) => rgb(h));
  if (pal.length) {
    let best = 999;
    for (const h of pal) for (const sw of a.palette) best = Math.min(best, colorDist(h, sw.hex));
    s += Math.max(0, 5 * (1 - best / 260)); // ~0–5 điểm theo độ gần bảng màu hợp da
  }
  const skills = d.skills ?? [];
  if (skills.includes(a.technique.id)) s += 2;
  if ((p.conditions.includes("thin_peeling") || p.conditions.includes("bitten")) && skills.includes("Bột/Acrylic")) s -= 2;
  if (p.conditions.includes("skin_rash") && skills.some((k) => k !== "Sơn thường")) s -= 3;
  if (p.part === "FOOT") s += skills.includes("Chân tay nước") ? 4 : -3;
  else if (skills.length === 1 && skills[0] === "Chân tay nước") s -= 2;
  if ((p.nailLength === "bitten" || p.nailLength === "short") && (d.difficulty ?? 2) === 3 && !skills.includes("Gel-X")) s -= 1;
  return Math.round(s * 100) / 100;
}

const SHAPE_WORDS: Record<Shape, RegExp> = {
  round: /tròn|round/i, oval: /oval/i, squoval: /squoval|vuông bo/i, square: /vuông|square/i,
  almond: /almond|hạnh nhân/i, coffin: /coffin|ballerina/i, stiletto: /stiletto|nhọn/i,
};
/** Điểm cho mẫu trong menu của thợ (chưa có dữ liệu dáng / màu → so tên, kỹ thuật, nhóm). */
export function scoreMenuItem(it: { name: string; description?: string | null; technique?: string | null; category: string }, a: Advice, p: Perception): number {
  if (it.category === "ADDON") return -99;
  let s = 0;
  if (p.part === "FOOT") s += it.category === "FOOT" || it.category === "COMBO" ? 4 : -4;
  else s += it.category === "HAND" ? 2 : it.category === "COMBO" ? 1 : -4;
  if (it.technique === a.technique.id) s += 3;
  const text = `${it.name} ${it.description ?? ""}`;
  a.shapes.forEach((x, i) => { if (SHAPE_WORDS[x.id].test(text)) s += i === 0 ? 3 : 2; });
  for (const x of a.avoidShapes) if (SHAPE_WORDS[x].test(text)) s -= 3;
  for (const sw of a.palette) if (new RegExp(sw.name[0].split(" ").slice(-1)[0], "i").test(text)) s += 1;
  if ((p.conditions.includes("thin_peeling") || p.conditions.includes("bitten")) && it.technique === "Bột/Acrylic") s -= 2;
  return s;
}

/** Làm sạch kết quả AI (hoặc thợ sửa) về đúng giá trị cho phép. */
export function sanitizePerception(raw: unknown, part: Part): Perception {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  const conds = Array.isArray(o.conditions)
    ? (o.conditions as unknown[])
        .map((c) => (typeof c === "string" ? { id: c, confidence: 1 } : (c as { id?: unknown; confidence?: unknown })))
        .filter((c) => typeof c?.id === "string" && CONDITIONS[c.id as string] && (typeof c.confidence !== "number" || c.confidence >= 0.5))
        .map((c) => c.id as string)
    : [];
  return {
    part,
    skinTone: pick(o.skinTone, SKIN_TONES, "medium"),
    undertone: pick(o.undertone, UNDERTONES, "neutral"),
    fingerLength: pick(o.fingerLength, FINGER_LENGTHS, "medium"),
    bedWidth: pick(o.bedWidth, BED_WIDTHS, "medium"),
    nailLength: pick(o.nailLength, NAIL_LENGTHS, "short"),
    currentShape: (SHAPES as readonly string[]).includes(String(o.currentShape)) ? (o.currentShape as Shape) : null,
    hasProduct: o.hasProduct === true,
    conditions: Array.from(new Set(conds)).filter((c) => CONDITIONS[c].part === "BOTH" || CONDITIONS[c].part === part),
  };
}

export function sanitizePrefs(raw: unknown): Prefs {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);
  return {
    occasion: pick(o.occasion, ["work", "party", "wedding", "daily", "vacation"] as const),
    length: pick(o.length, ["short", "medium", "long"] as const),
    vibe: pick(o.vibe, ["natural", "cute", "bold"] as const),
  };
}

/** Lời dặn cho AI: chỉ quan sát, trả đúng mã. */
export function visionPrompt(part: Part): string {
  const list = CONDITION_IDS.filter((c) => CONDITIONS[c].part === "BOTH" || CONDITIONS[c].part === part)
    .map((c) => `- ${c}: ${CONDITIONS[c].label[1]} — ${CONDITIONS[c].what[1]}`)
    .join("\n");
  return `You are assisting a licensed nail technician. Look ONLY at the ${part === "FOOT" ? "feet / toenails" : "hands / fingernails"} in this photo and report what is visible. Do not guess what you cannot see.
Return JSON:
- isTarget: true only if the photo clearly shows ${part === "FOOT" ? "a foot with toenails" : "a hand with fingernails"} (false for faces, objects, blurry or very dark photos).
- skinTone: fair | light | medium | tan | deep
- undertone: cool | neutral | warm (veins / skin hue)
- fingerLength: short | medium | long (relative to palm${part === "FOOT" ? "; use medium for feet" : ""})
- bedWidth: narrow | medium | wide (nail bed width vs length)
- nailLength: bitten | short | medium | long (free edge length)
- currentShape: round | oval | squoval | square | almond | coffin | stiletto
- hasProduct: true if gel / acrylic / polish is currently on the nails
- conditions: array of {id, confidence 0–1} using ONLY these ids, include an id only when clearly visible:
${list}
- note: one short neutral sentence in Vietnamese describing the nails (no medical diagnosis, no judgement about the person).
- noteEn: the same sentence in English.`;
}

export const VISION_SCHEMA = {
  type: "object",
  properties: {
    isTarget: { type: "boolean" },
    skinTone: { type: "string", enum: [...SKIN_TONES] },
    undertone: { type: "string", enum: [...UNDERTONES] },
    fingerLength: { type: "string", enum: [...FINGER_LENGTHS] },
    bedWidth: { type: "string", enum: [...BED_WIDTHS] },
    nailLength: { type: "string", enum: [...NAIL_LENGTHS] },
    currentShape: { type: "string", enum: [...SHAPES] },
    hasProduct: { type: "boolean" },
    conditions: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: CONDITION_IDS }, confidence: { type: "number" } }, required: ["id", "confidence"] } },
    note: { type: "string" },
    noteEn: { type: "string" },
  },
  required: ["isTarget", "skinTone", "undertone", "fingerLength", "bedWidth", "nailLength", "currentShape", "hasProduct", "conditions", "note"],
};

/** Tin nhắn TƯ VẤN gửi khách ngay trong chat (thợ bấm "Gửi tư vấn cho khách"): ngắn, gạch đầu dòng, đúng ngôn ngữ khách,
 *  giá lấy từ menu thật của thợ. */
export function consultSummary(a: Advice, menu: { name: string; priceFrom: number; priceTo: number | null }[], market: "US" | "AU", vi: boolean): string {
  const k = vi ? 0 : 1;
  const L = (x: L) => x[k];
  const money = (n: number) => `${market === "AU" ? "A$" : "$"}${Math.round(n)}`;
  const lines = [vi ? "💅 Tư vấn cho tay chị/anh (PawNail):" : "💅 Your nail consult (PawNail):"];
  if (a.redFlags.length) lines.push(`⚠️ ${vi ? "Cần lưu ý" : "Please note"}: ${a.redFlags.map((c) => (CONDITIONS[c] ? L(CONDITIONS[c].label) : c)).join(", ")}`);
  if (a.shapes[0]) lines.push(`• ${vi ? "Dáng hợp" : "Best shape"}: ${L(LABELS.shape[a.shapes[0].id])} — ${L(a.shapes[0].why)}`);
  lines.push(`• ${vi ? "Độ dài" : "Length"}: ${L(a.length)}`);
  lines.push(`• ${vi ? "Kỹ thuật" : "Technique"}: ${a.technique.id} — ${L(a.technique.why)}`);
  if (a.palette.length) lines.push(`• ${vi ? "Màu hợp tông" : "Colours that suit you"}: ${a.palette.slice(0, 4).map((p) => L(p.name)).join(", ")}`);
  const priced = menu.filter((m) => m.priceFrom > 0).slice(0, 3);
  if (priced.length) lines.push(`• ${vi ? "Gợi ý từ menu tiệm" : "From our menu"}: ${priced.map((m) => `${m.name} ${money(m.priceFrom)}${m.priceTo && m.priceTo > m.priceFrom ? `–${Math.round(m.priceTo)}` : ""}`).join(", ")}`);
  if (a.care[0]) lines.push(`• ${vi ? "Dặn dò" : "Aftercare"}: ${L(a.care[0])}`);
  return lines.join("\n");
}
