import { NextResponse } from "next/server";
import { communityShowcase } from "@/lib/designsShowcase";

// GET /api/designs/community?limit=&offset= — ẢNH THẬT thợ & tiệm đăng (bài "Khoe tay nghề" có ảnh),
// hiện ở trang Mẫu nail cạnh ý tưởng PawNail. Chỉ lấy ảnh (bỏ video), mới nhất trước. Truy vấn: lib/designsShowcase.ts
// (dùng chung với trang /designs dựng sẵn ở máy chủ).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit")) || 24));
  const offset = Math.min(5000, Math.max(0, Math.floor(Number(sp.get("offset")) || 0)));
  try {
    const { items, hasMore } = await communityShowcase(limit, offset);
    return NextResponse.json({ items, hasMore }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    console.error("GET /api/designs/community error:", err);
    return NextResponse.json({ items: [], hasMore: false });
  }
}
