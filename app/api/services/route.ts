export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let province = searchParams.get("province");

    // Default to 'TP. Hồ Chí Minh' if not specified
    if (!province) {
      province = "TP. Hồ Chí Minh";
    }

    const whereClause: any = {};
    if (province && province !== "all") {
      whereClause.city = province;
    }

    // 1. Fetch user registered services
    const services = await prisma.service.findMany({
      where: whereClause,
      orderBy: [
        { isBoosted: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
            isVerified: true,
          },
        },
      },
    });

    // 2. Fetch crawled stores
    const storeWhereClause: any = {};
    if (province && province !== "all") {
      // Normalize search query for common spelling variations
      let citySearch = province;
      if (province === "TP.HCM" || province === "TP. Hồ Chí Minh") {
        citySearch = "Hồ Chí Minh";
      }
      storeWhereClause.address = {
        contains: citySearch,
      };
    }

    const stores = await prisma.store.findMany({
      where: storeWhereClause,
      orderBy: {
        rating: "desc",
      },
    });

    // 3. Map stores to standard service schema
    const mappedStores = stores.map((store) => ({
      id: store.id,
      name: store.name,
      category: store.category,
      description: `Cửa hàng định vị tự động qua Google Maps • ${store.reviewCount || 0} đánh giá`,
      location: store.latitude && store.longitude ? `${store.latitude},${store.longitude}` : "12.245,109.195",
      city: province === "all" ? "Toàn quốc" : province,
      contactInfo: "0900 123 456",
      rating: store.rating || 4.5,
      imageUrl: null,
      priceRange: "Liên hệ thỏa thuận",
      vehicleInfo: null,
      isEmergency: false,
      workType: "Toàn thời gian",
      isBoosted: false,
      owner: {
        id: "crawled-google-maps",
        name: "Google Maps Verified",
        email: "crawled@pawbook.com",
        avatarUrl: null,
        role: "EMPLOYER",
        bio: "Thông tin vị trí tự động từ Google Maps",
        isVerified: true,
      },
    }));

    // Merge both lists, placing user services first
    const combined = [...services, ...mappedStores];

    return NextResponse.json(combined);
  } catch (error: any) {
    console.error("Fetch services API error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách dịch vụ." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng ký dịch vụ." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin người dùng." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, category, description, location, contactInfo, priceRange, vehicleInfo, isEmergency, workType } = body;

    if (!name || !category || !description || !location || !contactInfo) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ các thông tin bắt buộc." },
        { status: 400 }
      );
    }

    const city = location.split(",")[0].trim();

    const newService = await prisma.service.create({
      data: {
        name,
        category,
        description,
        location,
        city,
        contactInfo,
        ownerId: userId,
        priceRange,
        vehicleInfo,
        isEmergency: !!isEmergency,
        workType,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error: any) {
    console.error("Create service API error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi thêm dịch vụ." },
      { status: 500 }
    );
  }
}
