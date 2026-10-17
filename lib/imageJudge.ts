// "AI chấm ảnh" cho mẫu nail AI: mỗi mẫu vẽ vài ảnh, AI nhìn ảnh chấm điểm từng ảnh → chỉ giữ ảnh
// đẹp nhất. MIỄN PHÍ: Cloudflare Workers AI (Llama 4 Scout, chung hạn mức 10k neuron/ngày, ~70 neuron/lần)
// + Gemini (gói miễn phí) nếu có khoá. Có cả 2 → chấm SONG SONG, lấy điểm THẤP hơn (1 AI hay bỏ sót lỗi).
// 17/10/2026: soi tay 167 ảnh đã đăng → 101 ảnh lỗi mà AI vẫn cho qua (7 móng trên 1 bàn tay, lòng bàn tay
// mà vẫn thấy móng, móng rời bay lơ lửng, hình vẽ in lên da, chữ/watermark). Hỏi "có đủ 5 ngón không?"
// thì AI trả lời bừa "có" → giờ bắt AI ĐẾM (bàn tay / ngón / móng) và trả lời từng lỗi cụ thể; số đếm
// vô lý hoặc có bất kỳ lỗi nào → ép điểm thấp dù AI cho điểm cao.
import { cfTextEnabled, cfVisionJson } from "@/lib/cfText";
import { geminiEnabled, geminiVisionJson } from "@/lib/gemini";

export interface Verdict {
  score: number; // 0–10 sau khi áp lỗi cứng
  hand: boolean;
  fiveFingers: boolean; // giải phẫu bàn tay đúng (số đếm hợp lý, không dị dạng)
  textFree: boolean;
  nailsClear: boolean;
  matches: boolean;
  realistic: boolean;
  issues: string[];
  judge: string;
}

const DEFECTS = ["extraDigits", "fusedOrMelted", "palmSideNails", "floatingNail", "artOnSkin", "text"] as const;

const SCHEMA = {
  type: "object",
  properties: {
    hands: { type: "number" },
    fingers: { type: "number" },
    nails: { type: "number" },
    extraDigits: { type: "boolean" },
    fusedOrMelted: { type: "boolean" },
    palmSideNails: { type: "boolean" },
    floatingNail: { type: "boolean" },
    artOnSkin: { type: "boolean" },
    text: { type: "boolean" },
    nailsClear: { type: "boolean" },
    matches: { type: "boolean" },
    realistic: { type: "boolean" },
    score: { type: "number" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["hands", "fingers", "nails", ...DEFECTS, "nailsClear", "matches", "realistic", "score", "issues"],
};

const prompt = (subject: string) => `You are a very strict quality inspector for a premium nail-salon design catalogue.
AI image generators often draw broken hands. Your job is to catch them. When unsure, report the defect.
The photo is supposed to show: "${subject.slice(0, 600)}".
First COUNT carefully, one by one:
- hands: how many separate human hands are visible (0, 1, 2…).
- fingers: total visible fingers including thumbs, across all hands.
- nails: total visible painted fingernails, across all hands (count each nail once).
Then answer each defect question (true = the defect IS present):
- extraDigits: any hand has more than five digits, or more nails than fingers, or two nails on one finger.
- fusedOrMelted: fingers merge into each other, bend impossibly, have wrong length or melt into the background.
- palmSideNails: nails are visible on fingers seen from the palm side (nails grow only on the back of fingers).
- floatingNail: a nail or nail-art piece floats detached from any finger.
- artOnSkin: nail art (cats, eyes, lines, stickers) is printed on the skin instead of on a nail.
- text: any letters, words, numbers, signature, logo or watermark anywhere, even tiny or faint.
Then:
- nailsClear: the nails are sharp, fully visible and neatly finished.
- matches: the nails match the described shape, colours and nail art.
- realistic: it looks like a real photo, not a cartoon or 3D render.
- score: 0–10 as a premium salon portfolio photo of THIS design (10 flawless, 8 publishable, below 6 reject).
- issues: up to 3 short English phrases describing problems (empty if none).`;

interface Raw {
  hands?: number; fingers?: number; nails?: number;
  extraDigits?: boolean; fusedOrMelted?: boolean; palmSideNails?: boolean; floatingNail?: boolean; artOnSkin?: boolean; text?: boolean;
  hand?: boolean; fiveFingers?: boolean; textFree?: boolean; // dạng câu trả lời cũ — vẫn hiểu
  nailsClear?: boolean; matches?: boolean; realistic?: boolean; score?: number | string; issues?: unknown;
}

const num = (v: unknown) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

/** Giải phẫu bàn tay có ổn không (dựa trên số đếm + câu trả lời lỗi). */
export function anatomyOk(r: Raw): boolean {
  if (r.fiveFingers === false || r.extraDigits === true || r.fusedOrMelted === true || r.palmSideNails === true || r.floatingNail === true || r.artOnSkin === true) return false;
  const hands = num(r.hands), fingers = num(r.fingers), nails = num(r.nails);
  if (hands !== undefined && (hands < 1 || hands > 1)) return false; // ảnh mẫu chỉ nên có 1 bàn tay
  if (hands !== undefined && fingers !== undefined && fingers > hands * 5) return false;
  if (hands !== undefined && nails !== undefined && nails > hands * 5) return false;
  if (fingers !== undefined && nails !== undefined && nails > fingers) return false;
  return true;
}

/** Điểm cuối = điểm AI, bị ép xuống khi có lỗi cứng. */
export function finalScore(r: Raw): number {
  let s = Math.max(0, Math.min(10, Number(r.score) || 0));
  const hand = r.hand !== false && (num(r.hands) === undefined || num(r.hands)! >= 1);
  const textFree = r.textFree !== false && r.text !== true;
  if (!hand || !anatomyOk(r) || !textFree) s = Math.min(s, 3);
  if (r.nailsClear === false) s = Math.min(s, 5);
  if (r.matches === false) s = Math.min(s, 6);
  if (r.realistic === false) s = Math.max(0, s - 1);
  return Math.round(s * 10) / 10;
}

function toVerdict(r: Raw, judge: string): Verdict {
  return {
    score: finalScore(r),
    hand: r.hand !== false && (num(r.hands) === undefined || num(r.hands)! >= 1),
    fiveFingers: anatomyOk(r),
    textFree: r.textFree !== false && r.text !== true,
    nailsClear: r.nailsClear !== false, matches: r.matches !== false, realistic: r.realistic !== false,
    issues: (Array.isArray(r.issues) ? r.issues : []).map((x) => String(x).slice(0, 80)).slice(0, 3),
    judge,
  };
}

async function ask(who: "cloudflare" | "gemini", img: { mimeType: string; base64: string }, subject: string): Promise<Verdict | null> {
  try {
    const r = who === "cloudflare"
      ? await cfVisionJson<Raw>(prompt(subject), img, SCHEMA, 20_000)
      : await geminiVisionJson<Raw>(prompt(subject), img, SCHEMA, 20_000);
    if (typeof r?.score !== "number" && typeof r?.score !== "string") return null;
    return toVerdict(r, who);
  } catch {
    return null;
  }
}

/** Chấm 1 ảnh. null = không có AI chấm (khi đó giữ cách cũ: nhận ảnh đầu tiên).
 *  Có 2 AI → hỏi cả 2 cùng lúc, lấy kết quả KHẮT KHE hơn (điểm thấp hơn, gộp lỗi). */
export async function judgeImage(img: { mimeType: string; base64: string }, subject: string): Promise<Verdict | null> {
  const who: ("cloudflare" | "gemini")[] = [];
  if (cfTextEnabled()) who.push("cloudflare");
  if (geminiEnabled()) who.push("gemini");
  const got = (await Promise.all(who.map((w) => ask(w, img, subject)))).filter((v): v is Verdict => !!v);
  if (!got.length) return null;
  if (got.length === 1) return got[0];
  const worst = got.reduce((a, b) => (b.score < a.score ? b : a));
  return {
    ...worst,
    hand: got.every((v) => v.hand), fiveFingers: got.every((v) => v.fiveFingers), textFree: got.every((v) => v.textFree),
    nailsClear: got.every((v) => v.nailsClear), matches: got.every((v) => v.matches), realistic: got.every((v) => v.realistic),
    issues: [...new Set(got.flatMap((v) => v.issues))].slice(0, 3),
    judge: got.map((v) => v.judge).join("+"),
  };
}
