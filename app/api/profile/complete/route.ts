import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { needsOnboarding } from "@/lib/oauthUsers";

// POST /api/profile/complete — người đăng nhập bằng Google/Apple lần đầu chọn
// vai trò + khu vực + SĐT. Chỉ dùng được MỘT lần (khi tài khoản OAuth chưa có
// khu vực) — không ai dùng API này để tự đổi vai trò về sau.
const US = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, password: true, state: true } });
  if (!me || !needsOnboarding(me)) return NextResponse.json({ error: "Hồ sơ đã hoàn tất." }, { status: 409 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const role = b?.role === "OWNER" ? "OWNER" : b?.role === "TECHNICIAN" ? "TECHNICIAN" : null;
  const market = b?.market === "AU" ? "AU" : b?.market === "US" ? "US" : null;
  const state = typeof b?.state === "string" ? b.state : "";
  const city = typeof b?.city === "string" ? b.city.trim().slice(0, 100) : "";
  const phone = typeof b?.phone === "string" ? b.phone.trim().slice(0, 40) : "";
  const name = typeof b?.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : me.name;
  if (!role || !market || !(market === "US" ? US : AU).includes(state) || !city || phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "Vui lòng chọn vai trò, bang, thành phố và nhập số điện thoại." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { role, market, state, city, phone, name } });
  if (role === "TECHNICIAN") {
    await prisma.technicianProfile.upsert({
      where: { userId },
      update: { market, state, city },
      create: { userId, market, state, city, specialties: "", status: "AVAILABLE", portfolioImages: "[]" },
    });
  }
  return NextResponse.json({ ok: true, role });
}
