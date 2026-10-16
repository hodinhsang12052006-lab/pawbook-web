import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { MAX_MENU_ITEMS, toPublicMenuItem } from "@/lib/menu";

// POST /api/menu/from-design { designId } — "Thêm vào menu của tôi" từ kho Mẫu nail PawNail:
// chép tên, mô tả, kỹ thuật, độ khó, thời gian, giá gợi ý, vật tư, ảnh → thợ chỉ cần sửa giá / thay ảnh thật.
export async function POST(req: Request) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: me }, select: { role: true } });
  if (!user || !["TECHNICIAN", "OWNER", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Chỉ thợ và chủ tiệm có menu." }, { status: 403 });
  const { designId } = (await req.json().catch(() => ({}))) as { designId?: string };
  const d = designId ? await prisma.nailDesign.findUnique({ where: { id: String(designId) } }) : null;
  if (!d || d.status !== "published") return NextResponse.json({ error: "Không tìm thấy mẫu." }, { status: 404 });
  const count = await prisma.menuItem.count({ where: { ownerId: me } });
  if (count >= MAX_MENU_ITEMS) return NextResponse.json({ error: `Menu tối đa ${MAX_MENU_ITEMS} mẫu.` }, { status: 400 });
  const dup = await prisma.menuItem.findFirst({ where: { ownerId: me, sourceDesignId: d.id }, select: { id: true } });
  if (dup) return NextResponse.json({ error: "Mẫu này đã có trong menu của bạn.", itemId: dup.id }, { status: 409 });

  // "$60–75" / "$45-60" → 60, 75
  const nums = (d.priceHint || "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const priceFrom = nums[0] ?? 0;
  const priceTo = nums[1] && nums[1] > priceFrom ? nums[1] : null;
  let mats: { name: string; qty: string; cost: null }[] = [];
  try {
    mats = (JSON.parse(d.materials || "[]") as { vi?: string; en?: string; qty?: string }[]).map((m) => ({ name: String(m.vi || m.en || "").slice(0, 60), qty: String(m.qty || "").slice(0, 30), cost: null })).filter((m) => m.name).slice(0, 30);
  } catch {}
  const skills = (d.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
  const row = await prisma.menuItem.create({
    data: {
      ownerId: me,
      category: skills.includes("Chân tay nước") ? "FOOT" : "HAND",
      name: d.title.slice(0, 80),
      description: d.description?.slice(0, 500) || null,
      technique: skills[0]?.slice(0, 40) || null,
      priceFrom,
      priceTo,
      minutes: d.minutes || null,
      difficulty: d.difficulty || null,
      occasion: d.occasion,
      images: JSON.stringify(d.imageUrl && /^https:\/\/res\.cloudinary\.com\//.test(d.imageUrl) ? [d.imageUrl] : []),
      materials: JSON.stringify(mats),
      sourceDesignId: d.id,
      sortOrder: count,
    },
  });
  return NextResponse.json({ item: toPublicMenuItem(row, true) }, { status: 201 });
}
