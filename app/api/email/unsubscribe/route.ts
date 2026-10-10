import prisma from "@/lib/prisma";
import { verifyUnsub } from "@/lib/digest";

// Link "Hủy nhận" trong email (ký HMAC, không cần đăng nhập). GET = bấm link, POST = Gmail one-click.
async function unsub(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u") || "";
  const ok = !!u && verifyUnsub(u, sp.get("s") || "");
  if (ok) await prisma.user.update({ where: { id: u }, data: { emailDigest: false } }).catch(() => null);
  return ok;
}
const page = (ok: boolean) =>
  new Response(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PawNail Jobs</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b14;font-family:Arial,sans-serif;color:#e2e8f0;padding:16px">
<div style="max-width:420px;background:#12121f;border:1px solid #2a2a40;border-radius:16px;padding:28px;text-align:center">
<div style="font-size:20px;font-weight:800;color:#f472b6">PawNail Jobs</div>
<p style="font-size:15px;line-height:1.6">${ok ? "Đã hủy nhận email tóm tắt hằng tuần. Bạn có thể bật lại bất cứ lúc nào trong <b>Hồ sơ</b>.<br><i style=\"color:#94a3b8\">You've been unsubscribed from the weekly digest.</i>" : "Link không hợp lệ. Bạn có thể tắt email trong mục Hồ sơ."}</p>
<a href="/" style="display:inline-block;margin-top:8px;background:#db2777;color:#fff;text-decoration:none;font-weight:800;padding:11px 22px;border-radius:12px">Về PawNail</a></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
export async function GET(req: Request) { return page(await unsub(req)); }
export async function POST(req: Request) { return page(await unsub(req)); }
