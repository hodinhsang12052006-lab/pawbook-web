// Gửi email giao dịch (đặt lại mật khẩu…) qua Resend — gói miễn phí 3.000 thư/tháng.
// Cấu hình (Vercel): RESEND_API_KEY + EMAIL_FROM (VD "PawNail <no-reply@bitpawos.com>",
// tên miền phải được xác minh trong Resend). Chưa cấu hình → emailEnabled() = false.

export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

function apiBase() {
  // Máy chủ giả lập chỉ dùng khi kiểm thử local (không bao giờ đặt trên Vercel).
  if (process.env.RESEND_ALLOW_TEST === "1" && process.env.RESEND_TEST_BASE) return process.env.RESEND_TEST_BASE;
  return "https://api.resend.com";
}

export async function sendEmail(to: string, subject: string, html: string, text: string, headers?: Record<string, string>): Promise<void> {
  if (!emailEnabled()) throw new Error("Chưa cấu hình gửi email (RESEND_API_KEY / EMAIL_FROM).");
  const res = await fetch(`${apiBase()}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text, ...(headers ? { headers } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Resend ${res.status}: ${j?.message ?? "send failed"}`.slice(0, 200));
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Email đặt lại mật khẩu theo ngôn ngữ người yêu cầu (mặc định tiếng Anh) — nút bấm to, có link dự phòng. */
export function resetPasswordEmail(name: string, link: string, locale: "en" | "vi" = "en") {
  const vi = locale === "vi";
  const n = esc(name || (vi ? "bạn" : "there"));
  const subject = vi ? "Đặt lại mật khẩu PawNail" : "Reset your PawNail password";
  const body = vi
    ? `Chào ${n},<br>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút dưới đây trong vòng <b>30 phút</b> để đặt mật khẩu mới; link chỉ dùng được 1 lần.`
    : `Hi ${n},<br>We received a request to reset your password. Use the button below within <b>30 minutes</b>; the link works once.`;
  const button = vi ? "Đặt lại mật khẩu" : "Reset password";
  const footer = vi ? "Không phải bạn yêu cầu? Bạn có thể bỏ qua email này, mật khẩu sẽ không thay đổi." : "Didn't request this? You can ignore this email. Your password won't change.";
  const fallback = vi ? "Nếu nút không bấm được, mở link:" : "If the button doesn't work, open this link:";
  const html = `<!doctype html><html lang="${vi ? "vi" : "en"}"><body style="margin:0;background:#0b0b14;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#12121f;border-radius:16px;border:1px solid #2a2a40;padding:28px">
<tr><td style="font-size:20px;font-weight:800;color:#f472b6">PawNail</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:22px 0" align="center"><a href="${esc(link)}" style="display:inline-block;background:#db2777;color:#fff;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:12px">${button}</a></td></tr>
<tr><td style="font-size:13px;color:#94a3b8;line-height:1.6">${footer}</td></tr>
<tr><td style="padding-top:18px;font-size:12px;color:#64748b;word-break:break-all">${fallback} ${esc(link)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = vi
    ? `Chào ${name || "bạn"},\nĐặt lại mật khẩu PawNail (hiệu lực 30 phút, dùng 1 lần):\n${link}\n\n${footer}`
    : `Hi ${name || "there"},\nReset your PawNail password (valid for 30 minutes, works once):\n${link}\n\n${footer}`;
  return { subject, html, text };
}
