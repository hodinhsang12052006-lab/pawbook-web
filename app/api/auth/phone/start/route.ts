import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rateLimit";
import { sendCode, smsEnabled } from "@/lib/sms";
import { logSms, normalizePhone, smsQuota } from "@/lib/phoneLogin";

// POST { phone, market: "US"|"AU", locale? } — gửi mã đăng nhập bằng SĐT.
// (Giới hạn theo IP ở proxy.ts + theo số/IP/tổng ngày trong DB — xem lib/phoneLogin.ts.)
export async function POST(req: Request) {
  if (!smsEnabled()) return NextResponse.json({ error: "Đăng nhập bằng SĐT chưa bật." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { phone?: unknown; market?: unknown; locale?: unknown } | null;
  const phone = normalizePhone(body?.phone, body?.market);
  if (!phone) return NextResponse.json({ error: "Số điện thoại chưa đúng — chỉ nhận số Mỹ (+1) hoặc Úc (+61)." }, { status: 400 });
  const ip = getClientIp(req);
  const deny = await smsQuota(phone, ip);
  if (deny) return NextResponse.json({ error: deny }, { status: 429 });
  await logSms(phone, ip);
  const r = await sendCode(phone, body?.locale === "en" ? "en" : "vi");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ sent: true, to: phone.replace(/\d(?=\d{4})/g, "•") });
}
