// Vẽ ảnh mẫu nail bằng Cloudflare Workers AI (FLUX.1 [schnell], giấy phép
// Apache-2.0 — dùng thương mại được).
//
// CHI PHÍ: gói Workers FREE cho 10.000 neuron/ngày. Một ảnh 1024×1024, 4 bước
// ≈ 4 ô 512 × 4,8 + 4 bước × 9,6 ≈ 58 neuron → ~170 ảnh/ngày miễn phí. Ở gói
// Free, hết hạn mức thì Cloudflare chỉ trả lỗi (không tự trừ tiền); app còn tự
// khoá ở AI_IMAGES_DAILY ảnh/ngày (mặc định 12, tối đa 120 — dưới hạn mức miễn phí) cho chắc.
//
// Cấu hình (Vercel): CF_ACCOUNT_ID + CF_AI_TOKEN (API token quyền "Workers AI: Read").

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

export const cfImageEnabled = () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);
export const cfDailyImages = () => Math.max(0, Math.min(120, Number(process.env.AI_IMAGES_DAILY ?? 12) || 0));

function apiBase() {
  // Máy chủ giả lập chỉ dùng khi chạy kiểm thử local (không bao giờ đặt trên Vercel).
  if (process.env.CF_AI_ALLOW_TEST === "1" && process.env.CF_AI_TEST_BASE) return process.env.CF_AI_TEST_BASE;
  return "https://api.cloudflare.com/client/v4";
}

// Bộ lọc NSFW của Cloudflare đôi khi chặn nhầm mô tả móng tay ("sheer", "woman's
// hand"…) — cùng 1 câu lúc qua lúc không. Bị chặn nhầm → thử lại tối đa 2 lần,
// lần cuối với câu mô tả "an toàn" hơn. Lỗi khác (hết lượt, sai khoá) → dừng ngay.
const NSFW = /NSFW/i;
const safer = (p: string) => p.replace(/\b(sheer|translucent|see-through)\b/gi, "glossy").replace(/a woman's hand/gi, "a hand");

/** Vẽ 1 ảnh từ mô tả tiếng Anh → { mimeType, base64 } (JPEG). */
export async function cfImage(prompt: string, timeoutMs = 45_000): Promise<{ mimeType: string; base64: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await cfImageOnce(attempt < 2 ? prompt : safer(prompt), timeoutMs);
    } catch (err) {
      if (attempt >= 2 || !NSFW.test((err as Error).message)) throw err;
    }
  }
}

async function cfImageOnce(prompt: string, timeoutMs: number): Promise<{ mimeType: string; base64: string }> {
  if (!cfImageEnabled()) throw new Error("Chưa cấu hình Cloudflare Workers AI (CF_ACCOUNT_ID / CF_AI_TOKEN).");
  const res = await fetch(`${apiBase()}/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID!)}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
    // 6 bước (tối đa 8): chi tiết hoạ tiết rõ hơn 4 bước, vẫn ~77 neuron/ảnh (~130 ảnh/ngày miễn phí).
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = (await res.json().catch(() => null)) as { success?: boolean; result?: { image?: string }; errors?: { message?: string }[] } | null;
  if (!res.ok || !j?.success || !j.result?.image) {
    const msg = j?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`Cloudflare AI: ${msg}`.slice(0, 200));
  }
  return { mimeType: "image/jpeg", base64: j.result.image };
}
