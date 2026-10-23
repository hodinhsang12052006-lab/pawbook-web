import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { realOnly } from "@/lib/demo";

// GET /api/salons?market=US&state=CA&limit=24 — "Tiệm & thợ quanh bạn" cho KHÁCH đi làm nail.
// Chỉ người có thứ khách cần xem trước khi chọn: menu dịch vụ có giá HOẶC ảnh tác phẩm thật.
// Ưu tiên đúng bang; thiếu thì bổ sung nơi khác (ghi rõ bang trên thẻ). Không lộ email / SĐT.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const market: "US" | "AU" = sp.get("market") === "AU" ? "AU" : "US";
  const state = (sp.get("state") || "").slice(0, 4).toUpperCase();
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit")) || 24));
  try {
    const base: Prisma.UserWhereInput = {
      role: { in: ["TECHNICIAN", "OWNER"] as ("TECHNICIAN" | "OWNER")[] },
      market,
      AND: [realOnly(), { NOT: { email: { endsWith: "@feed.pawnail.invalid" } } }],
      OR: [
        { menuItems: { some: { active: true } } },
        { technicianProfile: { portfolioImages: { not: "[]" } } },
      ],
    };
    const select = Prisma.validator<Prisma.UserSelect>()({
      id: true, name: true, avatarUrl: true, role: true, state: true, city: true,
      technicianProfile: { select: { portfolioImages: true, specialties: true, yearsOfExperience: true } },
      menuItems: { where: { active: true }, orderBy: { sortOrder: "asc" as const }, take: 3, select: { name: true, priceFrom: true, priceTo: true, images: true } },
      clientReviews: { where: { hidden: false }, select: { rating: true } },
    });
    const local = state ? await prisma.user.findMany({ where: { ...base, state }, select, take: limit }) : [];
    const more = local.length < limit
      ? await prisma.user.findMany({ where: { ...base, ...(state ? { NOT: { state } } : {}) }, select, take: limit - local.length, orderBy: { createdAt: "desc" } })
      : [];
    const parse = (s: string | null | undefined): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };
    const items = [...local, ...more].map((u) => {
      const ratings = u.clientReviews.map((r) => r.rating);
      const photos = [...u.menuItems.flatMap((m) => parse(m.images)), ...parse(u.technicianProfile?.portfolioImages)].filter((x) => /^https:\/\//.test(x)).slice(0, 4);
      return {
        id: u.id, name: u.name, avatarUrl: u.avatarUrl, kind: u.role === "OWNER" ? "salon" : "tech", state: u.state, city: u.city, local: !!state && u.state === state,
        photos,
        services: u.menuItems.map((m) => ({ name: m.name, priceFrom: m.priceFrom, priceTo: m.priceTo })),
        skills: (u.technicianProfile?.specialties || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3),
        rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        reviews: ratings.length,
      };
    });
    // Có ảnh + có giá lên trước (khách chọn bằng mắt + giá), rồi tới đánh giá.
    items.sort((a, b) => Number(b.local) - Number(a.local) || Number(b.photos.length > 0 && b.services.length > 0) - Number(a.photos.length > 0 && a.services.length > 0) || b.reviews - a.reviews);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    console.error("salons api error:", err);
    return NextResponse.json({ items: [] });
  }
}
