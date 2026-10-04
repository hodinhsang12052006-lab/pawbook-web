import { NextResponse } from "next/server";
import { getTrends } from "@/lib/trends";

// GET /api/trends?market=US|AU — bảng "Xu hướng tuần" (dữ liệu thật, công khai).
export async function GET(req: Request) {
  try {
    const market = new URL(req.url).searchParams.get("market") === "AU" ? "AU" : "US";
    const data = await getTrends(market);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("GET /api/trends error:", error);
    return NextResponse.json({ error: "Không tải được xu hướng." }, { status: 500 });
  }
}
