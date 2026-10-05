// Xác minh số điện thoại qua SMS bằng Twilio Verify (Twilio tự sinh, gửi và
// kiểm tra mã 6 số — máy chủ mình KHÔNG lưu mã). Chưa cấu hình 3 biến
// TWILIO_* → tính năng tự ẩn, không làm hỏng gì.
//
// Biến môi trường (Vercel):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
// Kiểm thử local: SMS_ALLOW_TEST_BASE=1 + TWILIO_VERIFY_BASE=http://127.0.0.1:PORT

const DEFAULT_BASE = "https://verify.twilio.com";

function cfg() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !service) return null;
  const custom = process.env.TWILIO_VERIFY_BASE;
  // Chỉ cho đổi địa chỉ Twilio khi bật cờ kiểm thử — tránh cấu hình nhầm gửi
  // SĐT người dùng sang máy chủ lạ.
  const base = custom && process.env.SMS_ALLOW_TEST_BASE === "1" ? custom.replace(/\/$/, "") : DEFAULT_BASE;
  return { sid, token, service, base };
}

export const smsEnabled = () => cfg() !== null;

/** "+1 408 555 0199" / "(408) 555-0199" → "+14085550199". Chỉ nhận Mỹ (+1) và Úc (+61). */
export function toE164(raw: string | null | undefined, market: "US" | "AU" = "US"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) {
    // đã có mã quốc gia
  } else if (market === "AU") {
    digits = "61" + digits.replace(/^0/, "");
  } else {
    digits = digits.length === 11 && digits.startsWith("1") ? digits : "1" + digits;
  }
  const e164 = "+" + digits;
  if (/^\+1[2-9]\d{9}$/.test(e164)) return e164; // Mỹ/Canada: 10 số, đầu số vùng 2-9
  if (/^\+61[2-578]\d{8}$/.test(e164)) return e164; // Úc: 9 số sau 61
  return null;
}

async function call(path: string, form: Record<string, string>) {
  const c = cfg();
  if (!c) throw new Error("SMS chưa được cấu hình.");
  const res = await fetch(`${c.base}/v2/Services/${c.service}/${path}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${c.sid}:${c.token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { ok: res.ok, status: res.status, data };
}

/** Gửi mã. Trả về false nếu Twilio từ chối (số sai, bị chặn…). */
export async function sendCode(phone: string, locale: "vi" | "en" = "vi"): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await call("Verifications", { To: phone, Channel: "sms", Locale: locale === "vi" ? "vi" : "en" });
    if (r.ok) return { ok: true };
    return { ok: false, error: r.data.code === 60200 ? "Số điện thoại không hợp lệ." : r.status === 429 ? "Gửi quá nhiều lần, thử lại sau." : "Không gửi được mã, thử lại sau." };
  } catch (err) {
    console.error("sms sendCode error:", err);
    return { ok: false, error: "Không gửi được mã, thử lại sau." };
  }
}

/** Kiểm tra mã 6 số. */
export async function checkCode(phone: string, code: string): Promise<boolean> {
  try {
    const r = await call("VerificationCheck", { To: phone, Code: code });
    return r.ok && r.data.status === "approved";
  } catch (err) {
    console.error("sms checkCode error:", err);
    return false;
  }
}
