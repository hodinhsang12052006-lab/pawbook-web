import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { pushEnabled } from "@/lib/push";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rateLimit";

// POST   /api/push/subscribe  { endpoint, keys: { p256dh, auth } } — lưu thiết bị
// DELETE /api/push/subscribe  { endpoint }                         — huỷ
// GET    /api/push/subscribe                                       — máy chủ đã bật push chưa
const MAX_PER_USER = 10;

async function me() {
  return ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id ?? null;
}

// Chỉ chấp nhận endpoint của dịch vụ push thật (chống lưu URL tuỳ ý → SSRF).
const ALLOWED_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.windows\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];
function validEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 1000) return false;
  try {
    const u = new URL(v);
    // Chỉ để bộ kiểm thử local trỏ vào máy chủ push giả — production không đặt biến này.
    if (process.env.PUSH_ALLOW_TEST_ENDPOINT === "1" && u.hostname === "127.0.0.1") return true;
    return u.protocol === "https:" && ALLOWED_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}
const validKey = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{10,200}={0,2}$/.test(v);

export async function GET() {
  return NextResponse.json({ enabled: pushEnabled() });
}

export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = `push:${getClientIp(req)}`;
  if (isRateLimited(key, 20, 10 * 60 * 1000)) return NextResponse.json({ error: "Thử lại sau." }, { status: 429 });
  recordAttempt(key, 10 * 60 * 1000);

  const body = await req.json().catch(() => ({}));
  if (!validEndpoint(body.endpoint) || !validKey(body.keys?.p256dh) || !validKey(body.keys?.auth)) {
    return NextResponse.json({ error: "Đăng ký không hợp lệ." }, { status: 400 });
  }
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { userId, p256dh: body.keys.p256dh, auth: body.keys.auth },
      create: { userId, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });
    // Giữ tối đa N thiết bị gần nhất / người.
    const extra = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: MAX_PER_USER, select: { id: true } });
    if (extra.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push subscribe error:", err);
    return NextResponse.json({ error: "Chưa bật được thông báo." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.endpoint !== "string") return NextResponse.json({ error: "Thiếu endpoint." }, { status: 400 });
  try {
    // Chỉ xoá được thiết bị của CHÍNH MÌNH.
    await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId } });
  } catch {}
  return NextResponse.json({ ok: true });
}
