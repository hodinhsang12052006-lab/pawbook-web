import prisma from "@/lib/prisma";
import { verifyUnsub } from "@/lib/digest";

// Link "Hủy nhận" trong email (ký HMAC, không cần đăng nhập).
//   GET  = người bấm link → trang XÁC NHẬN có nút (không tự hủy: máy quét link của Outlook/Gmail/
//          antivirus tự mở mọi link trong thư — trước đây làm người dùng bị hủy mà không hay biết).
//   POST = bấm nút xác nhận, hoặc Gmail/Apple Mail "one-click" (header List-Unsubscribe-Post).
function parse(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u") || "";
  const s = sp.get("s") || "";
  return { u, s, ok: !!u && verifyUnsub(u, s) };
}
const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>PawNail Jobs</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b14;font-family:Arial,sans-serif;color:#e2e8f0;padding:16px">
<div style="max-width:420px;background:#12121f;border:1px solid #2a2a40;border-radius:16px;padding:28px;text-align:center">
<div style="font-size:20px;font-weight:800;color:#f472b6">PawNail Jobs</div>${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
const btn = "display:inline-block;margin-top:8px;border:0;cursor:pointer;background:#db2777;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:12px 24px;border-radius:12px";
const invalid = () => page(`<p style="font-size:15px;line-height:1.6">Link không hợp lệ. Bạn có thể tắt email trong mục <b>Hồ sơ</b>.</p><a href="/" style="${btn}">Về PawNail</a>`, 400);

export async function GET(req: Request) {
  const { u, s, ok } = parse(req);
  if (!ok) return invalid();
  return page(`<p style="font-size:15px;line-height:1.6">Bạn muốn ngừng nhận <b>email tóm tắt hằng tuần</b>?<br><i style="color:#94a3b8">Stop the weekly digest email?</i></p>
<form method="post" action="/api/email/unsubscribe?u=${encodeURIComponent(u)}&amp;s=${encodeURIComponent(s)}"><button type="submit" style="${btn}">Hủy nhận email</button></form>
<a href="/" style="display:inline-block;margin-top:14px;color:#94a3b8;font-size:13px">Không, giữ lại</a>`);
}

export async function POST(req: Request) {
  const { u, ok } = parse(req);
  if (!ok) return invalid();
  await prisma.user.update({ where: { id: u }, data: { emailDigest: false } }).catch(() => null);
  return page(`<p style="font-size:15px;line-height:1.6">Đã hủy nhận email tóm tắt hằng tuần. Bạn có thể bật lại bất cứ lúc nào trong <b>Hồ sơ</b>.<br><i style="color:#94a3b8">You've been unsubscribed from the weekly digest.</i></p><a href="/" style="${btn}">Về PawNail</a>`);
}
