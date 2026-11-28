import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isMissingTable, publicSale, removeSale, SALE_INCLUDE, saleExpiry } from "@/lib/salonSale/store";

// GET    /api/salon-sales/:id — 1 tin (công khai; tin đã gỡ → 410)
// PATCH  /api/salon-sales/:id { action: "sold" | "relist" | "renew" } — người đăng / admin
// DELETE /api/salon-sales/:id — người đăng / admin (giữ dòng, xoá dữ liệu công khai → bot không đăng lại)
type Ctx = { params: Promise<{ id: string }> };

async function viewer() {
  const s = await getServerSession(authOptions).catch(() => null);
  return (s?.user ?? null) as { id?: string; role?: string } | null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const me = await viewer();
  try {
    const s = await prisma.salonSale.findUnique({ where: { id }, include: SALE_INCLUDE });
    if (!s) return NextResponse.json({ error: "Không tìm thấy tin.", errorEn: "Listing not found." }, { status: 404 });
    if (s.status === "removed") return NextResponse.json({ error: "Tin đã được gỡ.", errorEn: "This listing was removed." }, { status: 410 });
    return NextResponse.json(publicSale(s, me?.id, me?.role));
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: "Không tìm thấy tin.", errorEn: "Listing not found." }, { status: 404 });
    console.error("GET /api/salon-sales/:id error:", e);
    return NextResponse.json({ error: "Không tải được tin.", errorEn: "Couldn't load the listing." }, { status: 500 });
  }
}

async function owned(id: string) {
  const me = await viewer();
  if (!me?.id) return { error: NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 }) } as const;
  const s = await prisma.salonSale.findUnique({ where: { id }, select: { id: true, ownerId: true, status: true } });
  if (!s || s.status === "removed") return { error: NextResponse.json({ error: "Không tìm thấy tin.", errorEn: "Listing not found." }, { status: 404 }) } as const;
  if (s.ownerId !== me.id && me.role !== "ADMIN") return { error: NextResponse.json({ error: "Bạn không có quyền sửa tin này.", errorEn: "You can't change this listing." }, { status: 403 }) } as const;
  return { me, s } as const;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const o = await owned(id);
  if ("error" in o) return o.error;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  const data =
    b.action === "sold" ? { status: "sold" } :
    b.action === "relist" || b.action === "renew" ? { status: "active", expiresAt: saleExpiry() } :
    null;
  if (!data) return NextResponse.json({ error: "Thao tác không hợp lệ.", errorEn: "Invalid action." }, { status: 400 });
  const s = await prisma.salonSale.update({ where: { id }, data, include: SALE_INCLUDE });
  return NextResponse.json(publicSale(s, o.me.id, o.me.role));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const o = await owned(id);
  if ("error" in o) return o.error;
  await removeSale(id);
  return NextResponse.json({ ok: true });
}
