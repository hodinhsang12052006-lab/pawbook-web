// Gọi Google Gemini API (REST) — viết ý tưởng mẫu nail (JSON) và vẽ ảnh minh hoạ.
// Biến môi trường:
//   GEMINI_API_KEY        — khoá từ Google AI Studio (bắt buộc)
//   GEMINI_TEXT_MODEL     — mặc định "gemini-2.5-flash"
//   GEMINI_IMAGE_MODEL    — mặc định "gemini-2.5-flash-image"
// Kiểm thử local: GEMINI_ALLOW_TEST=1 + GEMINI_TEST_BASE=http://127.0.0.1:PORT (máy chủ giả).

const BASE = "https://generativelanguage.googleapis.com";

function cfg() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const base = process.env.GEMINI_ALLOW_TEST === "1" && process.env.GEMINI_TEST_BASE ? process.env.GEMINI_TEST_BASE.replace(/\/$/, "") : BASE;
  return {
    key,
    base,
    textModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    imageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
  };
}

export const geminiEnabled = () => cfg() !== null;

interface Part { text?: string; inlineData?: { mimeType: string; data: string } }
interface GenResponse { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; error?: { message?: string } }

async function generate(model: string, body: unknown, timeoutMs: number): Promise<GenResponse> {
  const c = cfg();
  if (!c) throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  const res = await fetch(`${c.base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    // Khoá đi trong header (không nằm trên URL → không lọt vào log truy cập).
    headers: { "Content-Type": "application/json", "x-goog-api-key": c.key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as GenResponse;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message?.slice(0, 200) ?? "lỗi không rõ"}`);
  return data;
}

/** Gọi model chữ, bắt trả JSON đúng schema. */
export async function geminiJson<T>(prompt: string, schema: object): Promise<T> {
  const c = cfg()!;
  const data = await generate(
    c.textModel,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 1 },
    },
    60_000
  );
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini trả về không phải JSON hợp lệ.");
  }
}

/** Vẽ 1 ảnh → { mimeType, base64 }. */
export async function geminiImage(prompt: string): Promise<{ mimeType: string; base64: string }> {
  const c = cfg()!;
  const data = await generate(
    c.imageModel,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    },
    90_000
  );
  const img = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!img) throw new Error(`Gemini không trả ảnh (${data.candidates?.[0]?.finishReason ?? "không rõ lý do"}).`);
  return { mimeType: img.mimeType || "image/png", base64: img.data };
}
