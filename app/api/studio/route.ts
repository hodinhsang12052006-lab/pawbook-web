import { NextResponse } from "next/server";
import { getStudio, tipOfDay } from "@/lib/contentEngine";

// GET /api/studio?market=US|AU&role=OWNER|TECHNICIAN — nội dung "PawNail
// Studio" theo thời điểm (chủ đề tuần, thử thách hashtag, mẹo hôm nay, tổng
// kết thị trường). Công khai, không có dữ liệu cá nhân.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market") === "AU" ? "AU" : "US";
    const role = searchParams.get("role") === "OWNER" ? "OWNER" : "TECHNICIAN";
    const now = new Date();
    const data = await getStudio(market, now);
    return NextResponse.json(
      { ...data, tip: tipOfDay(now, role) },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } }
    );
  } catch (error) {
    console.error("GET /api/studio error:", error);
    return NextResponse.json({ error: "Không tải được nội dung." }, { status: 500 });
  }
}
