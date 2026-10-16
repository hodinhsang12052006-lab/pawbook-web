// "AI chấm ảnh" cho mẫu nail AI: mỗi mẫu vẽ vài ảnh, AI nhìn ảnh chấm điểm từng ảnh → chỉ giữ ảnh
// đẹp nhất. MIỄN PHÍ: mặc định dùng Cloudflare Workers AI (Llama 4 Scout, chung hạn mức 10k neuron/ngày,
// ~70 neuron/lần chấm); lỗi thì thử Gemini (gói miễn phí). IMAGE_JUDGE=gemini → Gemini trước.
// Lỗi cứng (thừa/thiếu ngón, có chữ, không thấy rõ móng) → ép điểm thấp dù AI cho điểm cao.
import { cfTextEnabled, cfVisionJson } from "@/lib/cfText";
import { geminiEnabled, geminiVisionJson } from "@/lib/gemini";

export interface Verdict {
  score: number; // 0–10 sau khi áp lỗi cứng
  hand: boolean;
  fiveFingers: boolean;
  textFree: boolean;
  nailsClear: boolean;
  matches: boolean;
  realistic: boolean;
  issues: string[];
  judge: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    hand: { type: "boolean" },
    fiveFingers: { type: "boolean" },
    textFree: { type: "boolean" },
    nailsClear: { type: "boolean" },
    matches: { type: "boolean" },
    realistic: { type: "boolean" },
    score: { type: "number" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["hand", "fiveFingers", "textFree", "nailsClear", "matches", "realistic", "score", "issues"],
};

const prompt = (subject: string) => `You are a strict quality inspector for a professional nail-salon design catalogue.
The photo is supposed to show: "${subject.slice(0, 600)}".
Inspect the image carefully and answer:
- hand: a human hand is the clear main subject.
- fiveFingers: every visible hand has normal anatomy — at most four fingers and one thumb, no extra, missing, fused, twisted or melted fingers or nails.
- textFree: there are NO letters, words, numbers, logos, labels or watermarks anywhere.
- nailsClear: the nails are in sharp focus, fully visible and neatly finished (no smudges on the skin).
- matches: the nails match the described shape, colours and nail art.
- realistic: it looks like a real photo, not a cartoon, 3D render or obvious AI artefacts.
- score: 0–10, how good this is as a premium salon portfolio photo of THIS design (10 = flawless, 7 = good enough to publish, below 5 = reject).
- issues: up to 3 short English phrases describing problems (empty if none).
Be strict: anatomy errors or any text must get a low score.`;

interface Raw { hand?: boolean; fiveFingers?: boolean; textFree?: boolean; nailsClear?: boolean; matches?: boolean; realistic?: boolean; score?: number; issues?: unknown }

/** Điểm cuối = điểm AI, bị ép xuống khi có lỗi cứng. */
export function finalScore(r: Raw): number {
  let s = Math.max(0, Math.min(10, Number(r.score) || 0));
  if (r.hand === false || r.fiveFingers === false || r.textFree === false) s = Math.min(s, 3);
  if (r.nailsClear === false) s = Math.min(s, 5);
  if (r.matches === false) s = Math.min(s, 6);
  if (r.realistic === false) s = Math.max(0, s - 1);
  return Math.round(s * 10) / 10;
}

/** Chấm 1 ảnh. null = không có AI chấm (khi đó giữ cách cũ: nhận ảnh đầu tiên). */
export async function judgeImage(img: { mimeType: string; base64: string }, subject: string): Promise<Verdict | null> {
  const order: ("cloudflare" | "gemini")[] = process.env.IMAGE_JUDGE === "gemini" ? ["gemini", "cloudflare"] : ["cloudflare", "gemini"];
  for (const who of order) {
    try {
      let r: Raw;
      if (who === "cloudflare") {
        if (!cfTextEnabled()) continue;
        r = await cfVisionJson<Raw>(prompt(subject), img, SCHEMA, 20_000);
      } else {
        if (!geminiEnabled()) continue;
        r = await geminiVisionJson<Raw>(prompt(subject), img, SCHEMA, 20_000);
      }
      if (typeof r?.score !== "number" && typeof r?.score !== "string") continue;
      return {
        score: finalScore(r),
        hand: r.hand !== false, fiveFingers: r.fiveFingers !== false, textFree: r.textFree !== false,
        nailsClear: r.nailsClear !== false, matches: r.matches !== false, realistic: r.realistic !== false,
        issues: (Array.isArray(r.issues) ? r.issues : []).map((x) => String(x).slice(0, 80)).slice(0, 3),
        judge: who,
      };
    } catch {
      // thử AI chấm còn lại
    }
  }
  return null;
}
