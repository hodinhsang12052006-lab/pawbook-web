// Dịch bài đăng tiếng Việt → tiếng Anh (bài chính thức lúc đăng + nút "Xem bản dịch" trên bảng tin).
// Cloudflare Workers AI (miễn phí) trước, Gemini dự phòng — như lib/newsPosts. Không có AI → null (giao diện ẩn nút).
// CHỐNG BỊA: mọi con số trong bản dịch phải có trong bản gốc; link giữ nguyên; không thêm câu mới.
import { cfJson, cfTextEnabled } from "@/lib/cfText";
import { geminiEnabled, geminiJson } from "@/lib/gemini";

export const translateEnabled = () => cfTextEnabled() || geminiEnabled();

const prompt = (text: string, to: "en" | "vi") => `Translate this social-media post from a nail-industry community app (salon owners and nail techs in the US and Australia) ${to === "en" ? "from Vietnamese into natural, friendly English" : "into natural Vietnamese"}.
Rules: translate faithfully, sentence by sentence; keep every emoji, line break, bullet, number, price, phone number and https:// link exactly; do not add, remove or explain anything; translate Vietnamese hashtags into short English hashtags without spaces (e.g. #ViecLamNail → #NailJobs).

POST:
${text}`;

const CF_SCHEMA = { type: "object", properties: { text: { type: "string" } }, required: ["text"] };
const G_SCHEMA = { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] };

/** Mọi con số trong bản dịch (bỏ hashtag, link) phải xuất hiện trong bản gốc. */
export function numbersKept(src: string, out: string): boolean {
  const strip = (s: string) => s.replace(/https?:\/\/\S+/g, "").replace(/#[^\s]+/g, "");
  const have = strip(src).replace(/[,.]/g, "");
  return (strip(out).match(/\d[\d,.]*/g) || []).every((n) => have.includes(n.replace(/[,.]/g, "").replace(/^0+(?=\d)/, "")) || have.includes(n.replace(/[,.]/g, "")));
}

export async function translatePost(text: string, to: "en" | "vi" = "en", timeoutMs = 15_000): Promise<string | null> {
  const src = text.slice(0, 2500);
  if (!src.trim() || !translateEnabled()) return null;
  const run = async (): Promise<string | null> => {
    if (cfTextEnabled()) { try { const r = await cfJson<{ text?: string }>(prompt(src, to), CF_SCHEMA, timeoutMs); if (r?.text) return r.text; } catch {} }
    if (geminiEnabled()) { try { const r = await geminiJson<{ text?: string }>(prompt(src, to), G_SCHEMA); if (r?.text) return r.text; } catch {} }
    return null;
  };
  const out = await Promise.race([run(), new Promise<null>((ok) => setTimeout(() => ok(null), timeoutMs + 2000))]);
  if (!out) return null;
  const clean = out.replace(/[<>]/g, "").trim();
  if (clean.length < Math.min(20, src.length / 4) || !numbersKept(src, clean)) return null;
  return clean.slice(0, 3000);
}
