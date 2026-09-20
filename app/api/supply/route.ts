import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const PAGE_SIZE = 20;

function mapProduct(p: any) {
  const discountPercent =
    p.originalPrice && p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100)
      : null;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPercent,
    createdAt: p.createdAt.toISOString(),
    seller: p.seller,
  };
}

// GET /api/supply?sellerId=&cursor= — kho hàng supply, mới nhất trước.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");
    const cursor = searchParams.get("cursor");

    const where: any = {};
    if (sellerId) where.sellerId = sellerId;

    const products = await prisma.supplyProduct.findMany({
      where,
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { id: true, name: true, avatarUrl: true, city: true, state: true } },
      },
    });

    const nextCursor = products.length === PAGE_SIZE ? products[products.length - 1].id : null;

    return NextResponse.json({ products: products.map(mapProduct), nextCursor });
  } catch (error) {
    console.error("GET /api/supply error:", error);
    return NextResponse.json({ error: "Không thể tải kho hàng." }, { status: 500 });
  }
}

// POST /api/supply — đăng bán sỉ vật tư (chỉ Chủ tiệm — đúng đối tượng
// "Hàng Sỉ Tiệm Nail" bán/mua qua lại giữa các tiệm với nhau).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để đăng bán sản phẩm." }, { status: 401 });
    }
    if (session.user.role !== Role.OWNER) {
      return NextResponse.json({ error: "Chỉ tài khoản Chủ tiệm mới có thể đăng bán sỉ vật tư." }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, imageUrl, price, originalPrice } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên sản phẩm." }, { status: 400 });
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Vui lòng tải ảnh sản phẩm." }, { status: 400 });
    }
    const safePrice = Number(price);
    if (!Number.isFinite(safePrice) || safePrice <= 0) {
      return NextResponse.json({ error: "Giá bán không hợp lệ." }, { status: 400 });
    }
    const safeOriginalPrice = originalPrice !== undefined && originalPrice !== null && originalPrice !== ""
      ? Number(originalPrice)
      : null;
    if (safeOriginalPrice !== null && (!Number.isFinite(safeOriginalPrice) || safeOriginalPrice <= 0)) {
      return NextResponse.json({ error: "Giá gốc không hợp lệ." }, { status: 400 });
    }

    const product = await prisma.supplyProduct.create({
      data: {
        sellerId: session.user.id,
        title: title.trim(),
        description: description ? String(description).trim() : null,
        imageUrl,
        price: safePrice,
        originalPrice: safeOriginalPrice,
      },
      include: {
        seller: { select: { id: true, name: true, avatarUrl: true, city: true, state: true } },
      },
    });

    return NextResponse.json(mapProduct(product), { status: 201 });
  } catch (error) {
    console.error("POST /api/supply error:", error);
    return NextResponse.json({ error: "Không thể đăng bán sản phẩm." }, { status: 500 });
  }
}
