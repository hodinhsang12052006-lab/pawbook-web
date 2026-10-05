import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { fcmEnabled } from "@/lib/fcm";
import { apnsEnabled } from "@/lib/apns";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";

// POST   /api/push/native { token, platform }  — app Android/iOS đăng ký token FCM
// DELETE /api/push/native { token }            — huỷ (đăng xuất / tắt thông báo)
// Lưu chung bảng PushSubscription: Android "fcm:<token>", iPhone "apns:<token>" (không cần bảng mới).
const MAX_PER_USER = 10;
const validToken = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:_\-.]{20,4096}$/.test(v);

async function me() {
  return ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id ?? null;
}

export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `push-native:${getClientIp(req)}`;
  if (isRateLimited(key, 20, 600_000)) return NextResponse.json({ error: "Thử lại sau." }, { status: 429 });
  recordAttempt(key, 600_000);
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  if (!validToken(body.token)) return NextResponse.json({ error: "Token không hợp lệ." }, { status: 400 });
  const platform = body.platform === "ios" ? "ios" : "android";
  if (platform === "ios" ? !apnsEnabled() : !fcmEnabled()) return NextResponse.json({ error: "Thông báo app chưa bật trên máy chủ." }, { status: 503 });
  const endpoint = (platform === "ios" ? "apns:" : "fcm:") + body.token;
  try {
    // Token gắn với THIẾT BỊ: người khác đăng nhập trên máy này → token chuyển chủ.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, auth: platform },
      create: { userId, endpoint, p256dh: "native", auth: platform },
    });
    const extra = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: MAX_PER_USER, select: { id: true } });
    if (extra.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push native subscribe error:", err);
    return NextResponse.json({ error: "Chưa bật được thông báo." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (!validToken(body.token)) return NextResponse.json({ error: "Token không hợp lệ." }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: ["fcm:" + body.token, "apns:" + body.token] }, userId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
