import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { MAX_MENU_ITEMS, parseMenuItem, toPublicMenuItem } from "@/lib/menu";

// GET /api/menu?userId=… — menu mẫu nail của 1 thợ / tiệm (công khai: chỉ mẫu đang hiện, không có
// giá vật tư; chủ menu: tất cả + vật tư + chi phí).
// POST /api/menu — chủ menu thêm 1 mẫu (thợ / chủ tiệm / admin).
const viewerId = async () => ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id ?? null;

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") || "";
  if (!userId) return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, role: true, market: true, state: true, city: true, jobs: { select: { salonName: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!owner || (owner.role !== "TECHNICIAN" && owner.role !== "OWNER" && owner.role !== "ADMIN")) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const me = await viewerId();
  const isOwner = me === owner.id;
  const rows = await prisma.menuItem.findMany({
    where: { ownerId: owner.id, ...(isOwner ? {} : { active: true }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_MENU_ITEMS,
  });
  return NextResponse.json(
    {
      owner: { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl, role: owner.role, market: owner.market, state: owner.state, city: owner.city, salonName: owner.role === "OWNER" ? owner.jobs[0]?.salonName ?? null : null },
      isOwner,
      items: rows.map((r) => toPublicMenuItem(r, isOwner)),
    },
    // Không cache ở CDN: chủ menu và khách cùng 1 URL nhưng nhận dữ liệu khác nhau (vật tư, mẫu đang ẩn).
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const me = await viewerId();
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: me }, select: { role: true } });
  if (!user || !["TECHNICIAN", "OWNER", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Chỉ thợ và chủ tiệm có menu." }, { status: 403 });
  const key = `menu-write:${me}`;
  if (isRateLimited(key, 120, 60 * 60 * 1000)) return NextResponse.json({ error: "Bạn thao tác quá nhanh, thử lại sau." }, { status: 429 });
  recordAttempt(key, 60 * 60 * 1000);
  const count = await prisma.menuItem.count({ where: { ownerId: me } });
  if (count >= MAX_MENU_ITEMS) return NextResponse.json({ error: `Menu tối đa ${MAX_MENU_ITEMS} mẫu.` }, { status: 400 });
  const parsed = parseMenuItem((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const row = await prisma.menuItem.create({
    data: { ...v, images: JSON.stringify(v.images), materials: JSON.stringify(v.materials), ownerId: me, sortOrder: count },
  });
  return NextResponse.json({ item: toPublicMenuItem(row, true) }, { status: 201 });
}
