// Viết chữ bằng Cloudflare Workers AI (Llama 3.3 70B) — dùng chung hạn mức MIỄN PHÍ 10.000 neuron/ngày
// với phần vẽ ảnh (1 bài ~ vài trăm neuron). Dùng cho bài viết tin ngành khi không có / hỏng khoá Gemini.
// Cấu hình: CF_ACCOUNT_ID + CF_AI_TOKEN (như cfImage). Đổi model: CF_TEXT_MODEL.

const MODEL = () => process.env.CF_TEXT_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const cfTextEnabled = () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);

function apiBase() {
  if (process.env.CF_AI_ALLOW_TEST === "1" && process.env.CF_AI_TEST_BASE) return process.env.CF_AI_TEST_BASE;
  return "https://api.cloudflare.com/client/v4";
}

/** Lấy object JSON đầu tiên trong chữ trả về (model đôi khi bọc ```json …```). */
function firstJson(s: string): unknown {
  const t = s.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(t); } catch {}
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i >= 0 && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error("Cloudflare AI trả về không phải JSON.");
}

/** Gọi model chữ, yêu cầu trả JSON đúng schema (JSON Schema chuẩn). */
export async function cfJson<T>(prompt: string, schema: object, timeoutMs = 25_000): Promise<T> {
  if (!cfTextEnabled()) throw new Error("Chưa cấu hình Cloudflare Workers AI.");
  const res = await fetch(`${apiBase()}/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID!)}/ai/run/${MODEL()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "Bạn chỉ trả lời bằng MỘT object JSON hợp lệ đúng schema được yêu cầu, không thêm chữ nào khác." },
        { role: "user", content: `${prompt}\n\nTrả về JSON theo schema: ${JSON.stringify(schema)}` },
      ],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: 900,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = (await res.json().catch(() => null)) as { success?: boolean; result?: { response?: unknown }; errors?: { code?: number; message?: string }[] } | null;
  if (!res.ok || !j?.success) throw new Error(`Cloudflare AI: ${j?.errors?.[0]?.message || `HTTP ${res.status}`}`.slice(0, 200));
  const r = j.result?.response;
  return (typeof r === "string" ? firstJson(r) : r) as T;
}

/** Nhìn ảnh bằng Cloudflare Workers AI (Llama 4 Scout, hạn mức miễn phí) — dự phòng khi Gemini lỗi. */
export async function cfVisionJson<T>(prompt: string, image: { mimeType: string; base64: string }, schema: object, timeoutMs = 30_000): Promise<T> {
  if (!cfTextEnabled()) throw new Error("Chưa cấu hình Cloudflare Workers AI.");
  const model = process.env.CF_VISION_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  const res = await fetch(`${apiBase()}/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID!)}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You only answer with ONE valid JSON object matching the requested schema, no other text." },
        {
          role: "user",
          content: [
            { type: "text", text: `${prompt}\n\nJSON schema: ${JSON.stringify(schema)}` },
            { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: 700,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = (await res.json().catch(() => null)) as { success?: boolean; result?: { response?: unknown }; errors?: { message?: string }[] } | null;
  if (!res.ok || !j?.success) throw new Error(`Cloudflare AI: ${j?.errors?.[0]?.message || `HTTP ${res.status}`}`.slice(0, 200));
  const r = j.result?.response;
  return (typeof r === "string" ? firstJson(r) : r) as T;
}
