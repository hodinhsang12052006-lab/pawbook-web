// Public design catalog query (GET /api/designs) — pure DB read, date-aware, testable with a forced `now`
// (scripts/qa/catalog_read_test.mjs).
//
// Theo NGÀY (lib/season.ts, ngày địa phương của thị trường): mẫu theo dịp (id trong THEMES) chỉ hiện khi dịp đó đang
// diễn ra hoặc bắt đầu trong ≤ 21 ngày ở thị trường của người xem (không có market → của Mỹ HOẶC Úc). Dịp đã nghỉ
// (Halloween) không bao giờ hiện. Mẫu không theo dịp / dịp lạ ngoài THEMES vẫn hiện. Giữ quy tắc bán cầu cũ: mẫu MÙA
// vẽ cho bán cầu kia không hiện (designFitsMarket).
// Thứ tự: ảnh Google Flow đã duyệt (prompt có "[flow:") trước, rồi phần còn lại — mỗi nhóm mới nhất trước (id tăng dần
// khi trùng giờ); phân trang xuyên 2 nhóm bằng 1 lần đếm + ≤ 2 lần đọc.
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { toPublic } from "@/lib/aiDesigns";
import { SEASONAL_THEMES, THEMES } from "@/lib/studioThemes";
import { RETIRED_OCCASIONS, activeOccasions, type Market } from "@/lib/season";
import { FLOW_WHERE } from "@/lib/flowMarks";

export interface CatalogQuery {
  occasion?: string | null;
  skill?: string | null;
  market?: Market | null;
  limit: number;
  offset: number;
  now?: Date;
}

const inWindow = (m: Market, now: Date) => {
  const o = activeOccasions(m, now, { upcomingDays: 21 });
  return [...o.active, ...o.upcoming.map((u) => u.id)];
};

/** Occasion values that must not appear right now for this viewer (retired + out-of-window THEMES ids + off-market). */
export function blockedOccasions(market: Market | null, now: Date): string[] {
  const allowed = new Set(market ? inWindow(market, now) : [...inWindow("US", now), ...inWindow("AU", now)]);
  const notInMarket = market ? THEMES.filter((t) => t.markets && !t.markets.includes(market)).map((t) => t.id) : [];
  return [...new Set([...RETIRED_OCCASIONS, ...THEMES.map((t) => t.id).filter((id) => !allowed.has(id)), ...notInMarket])];
}

export async function queryCatalog(q: CatalogQuery) {
  const now = q.now ?? new Date();
  const market = q.market ?? null;
  const blocked = blockedOccasions(market, now);
  if (q.occasion && blocked.includes(q.occasion)) return { designs: [] as ReturnType<typeof toPublic>[], hasMore: false };
  const where: Prisma.NailDesignWhereInput = {
    status: "published",
    // Chỉ hiện mẫu ĐÃ có ảnh thật — mẫu mới vẫn tự đăng (không chờ duyệt) nhưng chờ vẽ ảnh xong mới lộ ra.
    imageUrl: { not: null },
    ...(q.occasion ? { occasion: q.occasion } : {}),
    ...(q.skill ? { skills: { contains: q.skill } } : {}),
    AND: [
      { OR: [{ occasion: null }, { occasion: { notIn: blocked } }] },
      ...(market ? [{ OR: [{ market }, { occasion: null }, { occasion: { notIn: [...SEASONAL_THEMES] } }] } as Prisma.NailDesignWhereInput] : []),
    ],
  };
  const order: Prisma.NailDesignOrderByWithRelationInput[] = [{ publishedAt: "desc" }, { id: "asc" }];
  const include = { _count: { select: { saves: true } } } as const;
  const flowWhere: Prisma.NailDesignWhereInput = { AND: [where, FLOW_WHERE] };
  const restWhere: Prisma.NailDesignWhereInput = { AND: [where, { NOT: FLOW_WHERE }] };
  const flowCount = await prisma.nailDesign.count({ where: flowWhere });
  const want = q.limit + 1; // +1 để biết còn trang sau
  let rows = q.offset < flowCount ? await prisma.nailDesign.findMany({ where: flowWhere, orderBy: order, skip: q.offset, take: want, include }) : [];
  if (rows.length < want) {
    rows = rows.concat(await prisma.nailDesign.findMany({ where: restWhere, orderBy: order, skip: Math.max(0, q.offset - flowCount), take: want - rows.length, include }));
  }
  return { designs: rows.slice(0, q.limit).map(toPublic), hasMore: rows.length > q.limit };
}
