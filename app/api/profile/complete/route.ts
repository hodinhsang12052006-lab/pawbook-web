import { NextResponse } from "next/server";
import { openWelcomeChat } from "@/lib/welcomeChat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { needsOnboarding } from "@/lib/oauthUsers";
import { attachReferral, readRef } from "@/lib/referral";
import { US_ALL_CODES, AU_ALL_CODES } from "@/lib/stateNames";

// POST /api/profile/complete — người đăng nhập bằng Google/Apple lần đầu chọn
// vai trò + khu vực + SĐT. Chỉ dùng được MỘT lần (khi tài khoản OAuth chưa có
// khu vực) — không ai dùng API này để tự đổi vai trò về sau.
// Đủ 50 bang + DC (trước đây chỉ 10 bang → thợ ở MN, MT… không hoàn tất được hồ sơ).
const US = US_ALL_CODES;
const AU = AU_ALL_CODES;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, password: true, state: true, email: true } });
  if (!me || !needsOnboarding(me)) return NextResponse.json({ error: "Hồ sơ đã hoàn tất." }, { status: 409 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const role = b?.role === "OWNER" ? "OWNER" : b?.role === "TECHNICIAN" ? "TECHNICIAN" : b?.role === "CLIENT" ? "CLIENT" : null;
  const market = b?.market === "AU" ? "AU" : b?.market === "US" ? "US" : null;
  const state = typeof b?.state === "string" ? b.state : "";
  const city = typeof b?.city === "string" ? b.city.trim().slice(0, 100) : "";
  const phone = typeof b?.phone === "string" ? b.phone.trim().slice(0, 40) : "";
  const name = typeof b?.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : me.name;
  // Khách đi làm nail: chỉ cần tên + khu vực (SĐT / thành phố không bắt buộc — bớt cản trở lúc đăng ký).
  const isClient = role === "CLIENT";
  if (!role || !market || !(market === "US" ? US : AU).includes(state) || (!isClient && (!city || phone.replace(/\D/g, "").length < 8))) {
    return NextResponse.json({ error: isClient ? "Vui lòng chọn khu vực của bạn." : "Vui lòng chọn vai trò, bang, thành phố và nhập số điện thoại." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { role, market, state, city: city || null, phone: phone.replace(/\D/g, "").length >= 8 ? phone : null, name } });
  if (role === "TECHNICIAN") {
    await prisma.technicianProfile.upsert({
      where: { userId },
      update: { market, state, city },
      create: { userId, market, state, city, specialties: "", status: "AVAILABLE", portfolioImages: "[]" },
    });
  }
  // Đăng ký bằng Google/Apple qua link mời bạn bè (cookie pn_ref) → tính cho người mời như đăng ký thường.
  await attachReferral(userId, name, readRef(req, null));
  // Admin (tài khoản chính thức) tự nhắn: thông tin đăng ký + lời chào.
  await openWelcomeChat({ userId, name, role, email: me.email, phone, market, state, city, via: "social" }).catch((e) => console.error("welcome chat error:", e));
  return NextResponse.json({ ok: true, role });
}
