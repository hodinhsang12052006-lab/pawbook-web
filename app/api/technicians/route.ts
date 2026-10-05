import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Market } from "@prisma/client";

// GET /api/technicians?market=US&state=CA&city=... — lưới portfolio thợ đang rảnh
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const city = searchParams.get("city");

    // Lọc "có ảnh portfolio" NGAY trong query — trước đây lấy 100 hồ sơ mới
    // nhất rồi mới lọc ở JS: chỉ cần >100 thợ mới đăng ký chưa up ảnh là cả
    // lưới thợ trống trơn dù vẫn còn nhiều thợ có ảnh phía sau.
    const where: any = { NOT: [{ portfolioImages: "[]" }, { portfolioImages: "" }] };
    if (market === "US" || market === "AU") where.market = market as Market;
    if (state) where.state = state;
    if (city) where.city = { contains: city };

    const profiles = await prisma.technicianProfile.findMany({
      where,
      // KHÔNG select `phone` ở đây — đây là endpoint danh sách công khai,
      // không cần đăng nhập. Số điện thoại thợ chỉ được lộ ra sau khi chủ
      // tiệm hoàn tất "Mở khóa liên hệ" (xem app/api/unlock/route.ts); trả
      // thẳng phone ở đây từng làm tính năng trả phí đó vô nghĩa và phát tán
      // SĐT hàng loạt (tối đa 100 thợ/request) cho bất kỳ ai gọi API.
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    });

    const safeProfiles = profiles
      .map((p) => ({
        ...p,
        specialties: p.specialties ? p.specialties.split(",").filter(Boolean) : [],
        portfolioImages: (() => {
          try {
            return JSON.parse(p.portfolioImages || "[]");
          } catch {
            return [];
          }
        })(),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
      // Chỉ hiển thị thợ đã có ít nhất 1 ảnh portfolio
      .filter((p) => p.portfolioImages.length > 0);

    // Công khai, không cá nhân hoá → CDN giữ 30 giây (xem app/api/jobs).
    return NextResponse.json(safeProfiles, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch (error: any) {
    console.error("Fetch technicians API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách thợ." },
      { status: 500 }
    );
  }
}
