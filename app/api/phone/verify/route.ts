import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { checkCode, sendCode, smsEnabled, toE164 } from "@/lib/sms";

// /api/phone/verify — xác minh SĐT trong hồ sơ bằng mã SMS.
//   GET                      → { enabled, verified, phone }
//   POST { action: "send" }  → gửi mã tới SĐT ĐANG LƯU trong hồ sơ
//   POST { action: "check", code } → đúng mã → đánh dấu đã xác minh
// Chỉ xác minh số đang lưu trong hồ sơ (không nhận số tuỳ ý) → không ai dùng
// được API này để spam SMS tới số người khác.
const HOUR = 3_600_000;
const missing = (err: unknown) => /no such table|P2021/i.test(String((err as Error)?.message || err));

async function me() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, phone: true, market: true } });
}

async function verifiedPhone(userId: string): Promise<string | null> {
  try {
    return (await prisma.phoneVerification.findUnique({ where: { userId } }))?.phone ?? null;
  } catch (err) {
    if (missing(err)) return null;
    throw err;
  }
}

export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const phone = toE164(user.phone, user.market);
  const v = await verifiedPhone(user.id);
  return NextResponse.json({ enabled: smsEnabled(), verified: !!phone && v === phone, phone }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  if (!smsEnabled()) return NextResponse.json({ error: "Tính năng xác minh SMS chưa bật." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { action?: string; code?: string; locale?: string } | null;
  const phone = toE164(user.phone, user.market);
  if (!phone) return NextResponse.json({ error: "Số điện thoại trong hồ sơ chưa đúng định dạng Mỹ/Úc — sửa lại rồi lưu hồ sơ trước." }, { status: 400 });

  if (body?.action === "send") {
    // SMS tốn tiền + có thể bị lạm dụng: 3 lần/giờ mỗi tài khoản, 10 lần/giờ mỗi IP.
    const k1 = `sms-send:${user.id}`;
    const k2 = `sms-send-ip:${getClientIp(req)}`;
    if (isRateLimited(k1, 3, HOUR) || isRateLimited(k2, 10, HOUR)) {
      return NextResponse.json({ error: "Bạn đã yêu cầu mã quá nhiều lần — thử lại sau 1 giờ." }, { status: 429 });
    }
    recordAttempt(k1, HOUR);
    recordAttempt(k2, HOUR);
    const r = await sendCode(phone, body.locale === "en" ? "en" : "vi");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ sent: true, to: phone.replace(/\d(?=\d{4})/g, "•") });
  }

  if (body?.action === "check") {
    const code = String(body.code || "").trim();
    if (!/^\d{4,10}$/.test(code)) return NextResponse.json({ error: "Mã gồm 6 chữ số." }, { status: 400 });
    // Chống dò mã: tối đa 10 lần nhập/giờ.
    const k = `sms-check:${user.id}`;
    if (isRateLimited(k, 10, HOUR)) return NextResponse.json({ error: "Nhập sai quá nhiều lần — thử lại sau 1 giờ." }, { status: 429 });
    recordAttempt(k, HOUR);
    if (!(await checkCode(phone, code))) return NextResponse.json({ error: "Mã không đúng hoặc đã hết hạn." }, { status: 400 });
    try {
      await prisma.phoneVerification.upsert({ where: { userId: user.id }, update: { phone, verifiedAt: new Date() }, create: { userId: user.id, phone } });
    } catch (err) {
      if (missing(err)) return NextResponse.json({ error: "Tính năng đang được bật, thử lại sau ít phút." }, { status: 503 });
      throw err;
    }
    return NextResponse.json({ verified: true });
  }

  return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
}
