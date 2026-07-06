export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const province = searchParams.get("province");

    const whereClause: any = {};
    if (province && province !== "all") {
      let citySearch = province;
      if (province === "TP.HCM" || province === "TP. Hồ Chí Minh") {
        citySearch = "Hồ Chí Minh";
      }
      whereClause.address = {
        contains: citySearch,
      };
    }

    const stores = await prisma.store.findMany({
      where: whereClause,
      orderBy: {
        rating: "desc",
      },
    });

    return NextResponse.json(stores);
  } catch (error: any) {
    console.error("Fetch stores error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách cửa hàng từ Database." },
      { status: 500 }
    );
  }
}
