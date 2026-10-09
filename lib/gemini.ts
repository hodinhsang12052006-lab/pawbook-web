// Gọi Google Gemini API (REST) — viết ý tưởng mẫu nail (JSON) và vẽ ảnh minh hoạ.
// Biến môi trường:
//   GEMINI_API_KEY        — khoá từ Google AI Studio / Vertex AI (bắt buộc)
//   GEMINI_TEXT_MODEL     — mặc định "gemini-2.5-flash"
//   GEMINI_IMAGE_MODEL    — mặc định "gemini-2.5-flash-image"
// Kiểm thử local: GEMINI_ALLOW_TEST=1 + GEMINI_TEST_BASE=http://127.0.0.1:PORT (máy chủ giả).
//
// Google có nhiều kiểu khoá (khoá AI Studio "AIza…", khoá mới "AQ.…", khoá
// Vertex AI express) và mỗi kiểu nhận ở chỗ khác nhau. Thử lần lượt 3 cách,
// nhớ cách nào chạy được cho các lần sau:
//   1. generativelanguage.googleapis.com + header x-goog-api-key
//   2. generativelanguage.googleapis.com + ?key=
//   3. aiplatform.googleapis.com (Vertex AI express) + ?key=

const AI_STUDIO = "https://generativelanguage.googleapis.com/v1beta/models";
const VERTEX = "https://aiplatform.googleapis.com/v1/publishers/google/models";

type Mode = "header" | "query" | "vertex";
let workingMode: Mode | null = null;

function cfg() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const test = process.env.GEMINI_ALLOW_TEST === "1" && process.env.GEMINI_TEST_BASE ? process.env.GEMINI_TEST_BASE.replace(/\/$/, "") : null;
  return {
    key,
    test,
    textModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
    imageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
  };
}

export const geminiEnabled = () => cfg() !== null;

interface Part { text?: string; inlineData?: { mimeType: string; data: string } }
interface GenResponse { candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; error?: { message?: string } }

function request(mode: Mode, c: NonNullable<ReturnType<typeof cfg>>, model: string) {
  const m = encodeURIComponent(model);
  if (c.test) return { url: `${c.test}/v1beta/models/${m}:generateContent`, headers: { "x-goog-api-key": c.key } };
  if (mode === "header") return { url: `${AI_STUDIO}/${m}:generateContent`, headers: { "x-goog-api-key": c.key } };
  if (mode === "query") return { url: `${AI_STUDIO}/${m}:generateContent?key=${encodeURIComponent(c.key)}`, headers: {} };
  return { url: `${VERTEX}/${m}:generateContent?key=${encodeURIComponent(c.key)}`, headers: {} };
}

async function generate(model: string, body: unknown, timeoutMs: number): Promise<GenResponse> {
  const c = cfg();
  if (!c) throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  const modes: Mode[] = c.test ? ["header"] : workingMode ? [workingMode] : ["header", "query", "vertex"];
  let lastErr = "";
  for (const mode of modes) {
    const { url, headers } = request(mode, c, model);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as GenResponse;
    if (res.ok) {
      workingMode = mode;
      return data;
    }
    lastErr = `Gemini ${res.status} (${mode}): ${data.error?.message?.slice(0, 200) ?? "lỗi không rõ"}`;
    // Chỉ thử cách khác khi lỗi XÁC THỰC; lỗi khác (quota, nội dung…) báo luôn.
    if (res.status !== 401 && res.status !== 403) break;
  }
  throw new Error(lastErr);
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
