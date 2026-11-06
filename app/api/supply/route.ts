import { NextRequest, NextResponse, after } from "next/server";
import { getTranslations, translateEntries } from "@/lib/contentTranslations";
import { dtEn } from "@/lib/i18n/dtEn";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
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
    // Tên tiếng Anh / tiếng Việt cho người xem ngôn ngữ còn lại (ảnh alt + tiêu đề): bảng dtEn hoặc dịch máy.
    titleEn: p.titleEn ?? null,
    titleVi: p.titleVi ?? null,
  };
}

// GET /api/supply?sellerId=&cursor= — kho hàng supply, mới nhất trước.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");
    const cursor = searchParams.get("cursor");
    // Thị trường của người xem: người mua ở Dallas không cần (và không đọc được giá tiền của) hàng ở Footscray.
    const market = searchParams.get("market") === "AU" ? "AU" : searchParams.get("market") === "US" ? "US" : null;

    const where: any = {};
    if (sellerId) where.sellerId = sellerId;
    else where.seller = { ...realOnly(), ...(market ? { market } : {}) }; // danh sách chung: không hiện hàng của tài khoản mẫu

    const products = await prisma.supplyProduct.findMany({
      where,
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { id: true, name: true, avatarUrl: true, city: true, state: true, market: true } },
      },
    });

    const nextCursor = products.length === PAGE_SIZE ? products[products.length - 1].id : null;
    const entries = products.map((p) => ({ id: p.id, src: p.title }));
    const [en, vi] = await Promise.all([getTranslations("supply.title", entries, "en"), getTranslations("supply.title", entries, "vi")]);
    // Tên chưa có bản dịch → dịch sau khi trả lời (lần tải sau có ngay).
    const missing = entries.filter((e) => !en.has(e.id) && !vi.has(e.id) && dtEn(e.src) === e.src);
    if (missing.length) {
      after(async () => {
        await translateEntries("supply.title", missing, "en", { maxNew: 10 }).catch(() => undefined);
        await translateEntries("supply.title", missing, "vi", { maxNew: 10 }).catch(() => undefined);
      });
    }
    const withTx = products.map((p) => ({ ...p, titleEn: en.get(p.id)?.text ?? (dtEn(p.title) !== p.title ? dtEn(p.title) : null), titleVi: vi.get(p.id)?.text ?? null }));

    return NextResponse.json({ products: withTx.map(mapProduct), nextCursor });
  } catch (error) {
    console.error("GET /api/supply error:", error);
    return NextResponse.json({ error: "Không thể tải kho hàng.", errorEn: "Couldn't load supplies." }, { status: 500 });
  }
}

// POST /api/supply — đăng bán sỉ vật tư (chỉ Chủ tiệm — đúng đối tượng
// "Hàng Sỉ Tiệm Nail" bán/mua qua lại giữa các tiệm với nhau).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để đăng bán sản phẩm.", errorEn: "Log in to list a product." }, { status: 401 });
    }
    if (session.user.role !== Role.OWNER) {
      return NextResponse.json({ error: "Chỉ tài khoản Chủ tiệm mới có thể đăng bán sỉ vật tư.", errorEn: "Only salon owner accounts can list supplies." }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, imageUrl, price, originalPrice } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên sản phẩm.", errorEn: "Enter a product name." }, { status: 400 });
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Vui lòng tải ảnh sản phẩm.", errorEn: "Please add a product photo." }, { status: 400 });
    }
    // Ảnh chỉ đến từ /api/upload (URL https Cloudinary hoặc data URL ảnh khi
    // chưa cấu hình Cloudinary) — chặn scheme lạ và chuỗi khổng lồ.
    if (imageUrl.length > 2_000_000 || !/^(https:\/\/|data:image\/)/.test(imageUrl)) {
      return NextResponse.json({ error: "Ảnh sản phẩm không hợp lệ.", errorEn: "Invalid product photo." }, { status: 400 });
    }
    if (title.length > 200 || (description !== undefined && description !== null && (typeof description !== "string" || description.length > 5000))) {
      return NextResponse.json({ error: "Tên hoặc mô tả sản phẩm quá dài.", errorEn: "The product name or description is too long." }, { status: 400 });
    }
    const safePrice = Number(price);
    if (!Number.isFinite(safePrice) || safePrice <= 0) {
      return NextResponse.json({ error: "Giá bán không hợp lệ.", errorEn: "Invalid price." }, { status: 400 });
    }
    const safeOriginalPrice = originalPrice !== undefined && originalPrice !== null && originalPrice !== ""
      ? Number(originalPrice)
      : null;
    if (safeOriginalPrice !== null && (!Number.isFinite(safeOriginalPrice) || safeOriginalPrice <= 0)) {
      return NextResponse.json({ error: "Giá gốc không hợp lệ.", errorEn: "Invalid original price." }, { status: 400 });
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
    return NextResponse.json({ error: "Không thể đăng bán sản phẩm.", errorEn: "Couldn't list the product." }, { status: 500 });
  }
}
