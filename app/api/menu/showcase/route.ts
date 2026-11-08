import { NextResponse } from "next/server";
import { menuShowcase } from "@/lib/designsShowcase";

// GET /api/menu/showcase — mẫu có ẢNH THẬT trong menu của thợ / tiệm (trang Mẫu nail). Truy vấn: lib/designsShowcase.ts
// (dùng chung với trang /designs dựng sẵn ở máy chủ).
export async function GET(req: Request) {
  const limit = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 12));
  try {
    const items = await menuShowcase(limit);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (err) {
    if (/no such table|P2021/i.test(String((err as Error)?.message))) return NextResponse.json({ items: [] });
    throw err;
  }
}
