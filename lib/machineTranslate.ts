// Dịch máy chữ NGƯỜI DÙNG viết (tin nhắn, tên / mô tả mẫu trong menu, giới thiệu, mô tả tin tuyển) giữa
// tiếng Việt và tiếng Anh. CHỈ chạy trên máy chủ. Kết quả được lưu đệm theo từng nội dung + ngôn ngữ đích ở
// lib/contentTranslations.ts — mỗi đoạn chỉ dịch 1 lần.
//
// Nhà cung cấp: Cloudflare Workers AI (hạn mức miễn phí) → Gemini dự phòng. Không cấu hình gì → trả null
// (giao diện hiện bản gốc kèm nhãn ngôn ngữ, không bao giờ bịa bản dịch).
// Kiểm thử local: MT_ALLOW_TEST=1 MT_MOCK=1 → bản dịch giả có thể đoán trước (KHÔNG BAO GIỜ đặt trên Vercel).
import { cfJson, cfTextEnabled } from "@/lib/cfText";
import { geminiEnabled, geminiJson } from "@/lib/gemini";
import type { Locale } from "@/lib/i18n/config";

const MAX_ITEMS = 25;
const MAX_CHARS = 1200;

const mockOn = () => process.env.MT_ALLOW_TEST === "1" && process.env.MT_MOCK === "1";

export const machineTranslateEnabled = () => mockOn() || cfTextEnabled() || geminiEnabled();

// Bản dịch giả cho kiểm thử (câu mẫu của dữ liệu seed / QA); câu khác → "[EN] …" / "[VI] …".
const MOCK: Record<string, string> = {
  "Dạ chị ơi thứ 7 em còn trống lúc 2 giờ chiều nha, chị ghé được không ạ?": "Hi! I'm free this Saturday at 2 PM. Can you come in then?",
  "Sơn gel tay + vẽ hoa": "Gel manicure + floral art",
  "Bột nhúng SNS màu nude": "Nude SNS dip powder",
  "Thợ nail chuyên nghiệp, tay nghề chắc, làm việc nhanh gọn và cẩn thận.": "Professional nail tech with solid skills — quick, tidy and careful.",
  "Chuyên Design & Gel-X, phong cách hiện đại, khách hàng luôn hài lòng.": "Design and Gel-X specialist with a modern style.",
  "Luxe Nails & Spa tại Los Angeles, CA đang cần tuyển thợ nail có kinh nghiệm, môi trường làm việc thân thiện, khách sang, tip cao.":
    "Luxe Nails & Spa in Los Angeles, CA is hiring experienced nail technicians. Friendly team, upscale clients, great tips.",
  "Hi! Do you have time on Saturday afternoon?": "Chào bạn! Chiều thứ 7 bạn còn trống lịch không?",
};

function mock(texts: string[], to: Locale): string[] {
  return texts.map((t) => MOCK[t] ?? (to === "en" ? `[EN] ${t}` : `[VI] ${t}`));
}

function prompt(texts: string[], to: Locale) {
  const target = to === "en" ? "natural American/Australian English" : "natural, polite Vietnamese (as spoken by Vietnamese nail technicians in the US and Australia)";
  return `You translate short texts written by people on PawNail, a professional platform for nail technicians, nail salons and their clients in the US and Australia.
Translate EACH item into ${target}.
Rules:
- Keep the meaning, tone and politeness level. Do not add or remove information.
- Keep names, salon names, prices, phone numbers, dates, emoji, hashtags and line breaks as they are.
- Use standard nail-industry terms (gel manicure, dip powder/SNS, acrylic, Gel-X, BIAB, pedicure, nail art, full set, fill).
- If an item is already in the target language, return it unchanged.
- Return exactly ${texts.length} translations, in the same order.

Items (JSON array):
${JSON.stringify(texts)}`;
}

const CF_SCHEMA = { type: "object", properties: { translations: { type: "array", items: { type: "string" } } }, required: ["translations"] };
const GEMINI_SCHEMA = { type: "OBJECT", properties: { translations: { type: "ARRAY", items: { type: "STRING" } } }, required: ["translations"] };

function valid(out: unknown, n: number): string[] | null {
  const arr = (out as { translations?: unknown })?.translations;
  if (!Array.isArray(arr) || arr.length !== n) return null;
  return arr.map((s) => (typeof s === "string" ? s.trim() : ""));
}

/**
 * Dịch nhiều đoạn một lần sang `to`. Trả mảng cùng độ dài; phần tử null = không dịch được (giữ bản gốc).
 * Không ném lỗi.
 */
export async function machineTranslate(texts: string[], to: Locale): Promise<(string | null)[]> {
  const items = texts.slice(0, MAX_ITEMS).map((t) => String(t ?? "").slice(0, MAX_CHARS));
  const out: (string | null)[] = texts.map(() => null);
  if (!items.length) return out;
  if (mockOn()) {
    mock(items, to).forEach((t, i) => (out[i] = t));
    return out;
  }
  const p = prompt(items, to);
  let got: string[] | null = null;
  if (cfTextEnabled()) {
    try {
      got = valid(await cfJson(p, CF_SCHEMA, 20_000), items.length);
    } catch (e) {
      console.error("machineTranslate (cloudflare):", String((e as Error).message).slice(0, 160));
    }
  }
  if (!got && geminiEnabled()) {
    try {
      got = valid(await geminiJson(p, GEMINI_SCHEMA), items.length);
    } catch (e) {
      console.error("machineTranslate (gemini):", String((e as Error).message).slice(0, 160));
    }
  }
  if (got) got.forEach((t, i) => (out[i] = t || null));
  return out;
}
