import prisma from "@/lib/prisma";
import { verifyUnsub } from "@/lib/digest";
import { localeFromRequest } from "@/lib/i18n/server";
import { getUserLocale } from "@/lib/userLocale";
import type { Locale } from "@/lib/i18n/config";

// Link "Hủy nhận" trong email (ký HMAC, không cần đăng nhập).
//   GET  = người bấm link → trang XÁC NHẬN có nút (không tự hủy: máy quét link của Outlook/Gmail/
//          antivirus tự mở mọi link trong thư — trước đây làm người dùng bị hủy mà không hay biết).
//   POST = bấm nút xác nhận, hoặc Gmail/Apple Mail "one-click" (header List-Unsubscribe-Post).
// Ngôn ngữ: theo người nhận email (đã lưu) — link không có cookie khi mở từ ứng dụng thư.
function parse(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u") || "";
  const s = sp.get("s") || "";
  return { u, s, ok: !!u && verifyUnsub(u, s) };
}
const page = (lang: Locale, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>PawNail</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b14;font-family:Arial,sans-serif;color:#e2e8f0;padding:16px">
<div style="max-width:420px;background:#12121f;border:1px solid #2a2a40;border-radius:16px;padding:28px;text-align:center">
<div style="font-size:20px;font-weight:800;color:#f472b6">PawNail</div>${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
const btn = "display:inline-block;margin-top:8px;border:0;cursor:pointer;background:#db2777;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:12px 24px;border-radius:12px";
const home = (l: Locale) => (l === "vi" ? "/vi" : "/");
const invalid = (l: Locale) =>
  page(
    l,
    l === "vi"
      ? `<p style="font-size:15px;line-height:1.6">Link không hợp lệ. Bạn có thể tắt email trong mục <b>Hồ sơ</b>.</p><a href="${home(l)}" style="${btn}">Về PawNail</a>`
      : `<p style="font-size:15px;line-height:1.6">This link isn't valid. You can turn off emails in your <b>Profile</b>.</p><a href="${home(l)}" style="${btn}">Go to PawNail</a>`,
    400,
  );

export async function GET(req: Request) {
  const { u, s, ok } = parse(req);
  if (!ok) return invalid(localeFromRequest(req));
  const l = await getUserLocale(u);
  const action = `/api/email/unsubscribe?u=${encodeURIComponent(u)}&amp;s=${encodeURIComponent(s)}`;
  return page(
    l,
    l === "vi"
      ? `<p style="font-size:15px;line-height:1.6">Bạn muốn ngừng nhận <b>email cập nhật hằng tuần</b>?</p>
<form method="post" action="${action}"><button type="submit" style="${btn}">Hủy nhận email</button></form>
<a href="${home(l)}" style="display:inline-block;margin-top:14px;color:#94a3b8;font-size:13px">Không, giữ lại</a>`
      : `<p style="font-size:15px;line-height:1.6">Stop receiving the <b>weekly update email</b>?</p>
<form method="post" action="${action}"><button type="submit" style="${btn}">Unsubscribe</button></form>
<a href="${home(l)}" style="display:inline-block;margin-top:14px;color:#94a3b8;font-size:13px">No, keep it</a>`,
  );
}

export async function POST(req: Request) {
  const { u, ok } = parse(req);
  if (!ok) return invalid(localeFromRequest(req));
  const l = await getUserLocale(u);
  await prisma.user.update({ where: { id: u }, data: { emailDigest: false } }).catch(() => null);
  return page(
    l,
    l === "vi"
      ? `<p style="font-size:15px;line-height:1.6">Đã hủy nhận email cập nhật hằng tuần. Bạn có thể bật lại bất cứ lúc nào trong <b>Hồ sơ</b>.</p><a href="${home(l)}" style="${btn}">Về PawNail</a>`
      : `<p style="font-size:15px;line-height:1.6">You've been unsubscribed from the weekly update. You can turn it back on anytime in your <b>Profile</b>.</p><a href="${home(l)}" style="${btn}">Go to PawNail</a>`,
  );
}
