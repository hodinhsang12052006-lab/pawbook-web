// Gửi email giao dịch (đặt lại mật khẩu…) qua Resend — gói miễn phí 3.000 thư/tháng.
// Cấu hình (Vercel): RESEND_API_KEY + EMAIL_FROM (VD "PawNail Jobs <no-reply@bitpawos.com>",
// tên miền phải được xác minh trong Resend). Chưa cấu hình → emailEnabled() = false.

export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

function apiBase() {
  // Máy chủ giả lập chỉ dùng khi kiểm thử local (không bao giờ đặt trên Vercel).
  if (process.env.RESEND_ALLOW_TEST === "1" && process.env.RESEND_TEST_BASE) return process.env.RESEND_TEST_BASE;
  return "https://api.resend.com";
}

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!emailEnabled()) throw new Error("Chưa cấu hình gửi email (RESEND_API_KEY / EMAIL_FROM).");
  const res = await fetch(`${apiBase()}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Resend ${res.status}: ${j?.message ?? "send failed"}`.slice(0, 200));
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Email đặt lại mật khẩu — song ngữ, nút bấm to, có đường link dự phòng. */
export function resetPasswordEmail(name: string, link: string) {
  const n = esc(name || "bạn");
  const subject = "Đặt lại mật khẩu PawNail Jobs / Reset your PawNail Jobs password";
  const html = `<!doctype html><html><body style="margin:0;background:#0b0b14;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#12121f;border-radius:16px;border:1px solid #2a2a40;padding:28px">
<tr><td style="font-size:20px;font-weight:800;color:#f472b6">PawNail Jobs</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.6">Chào ${n},<br>Có yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút dưới đây để đặt mật khẩu mới — link có hiệu lực <b>30 phút</b> và chỉ dùng được 1 lần.</td></tr>
<tr><td style="padding:22px 0" align="center"><a href="${esc(link)}" style="display:inline-block;background:#db2777;color:#fff;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:12px">Đặt lại mật khẩu</a></td></tr>
<tr><td style="font-size:13px;color:#94a3b8;line-height:1.6">Không phải bạn yêu cầu? Cứ bỏ qua email này — mật khẩu của bạn vẫn giữ nguyên.<br><br><i>Someone asked to reset your PawNail Jobs password. Use the button above within 30 minutes. Didn't ask? Just ignore this email.</i></td></tr>
<tr><td style="padding-top:18px;font-size:12px;color:#64748b;word-break:break-all">Nếu nút không bấm được, mở link: ${esc(link)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Chào ${name || "bạn"},\nĐặt lại mật khẩu PawNail Jobs (hiệu lực 30 phút, dùng 1 lần):\n${link}\n\nKhông phải bạn yêu cầu? Bỏ qua email này.\n\nReset your PawNail Jobs password (valid 30 minutes): ${link}`;
  return { subject, html, text };
}
