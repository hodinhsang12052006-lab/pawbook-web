import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Market, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { realOnly } from "@/lib/demo";
import { cleanJobMedia } from "@/lib/jobMedia";
import { marketPhoneError, parseMarketPhone } from "@/lib/phoneFormat";
import { AU_ALL_CODES, US_ALL_CODES } from "@/lib/stateNames";
import { activeSaleWhere, isMissingTable, publicSale, SALE_INCLUDE, SALE_MAX_ACTIVE, SALE_MAX_MEDIA, SALE_MAX_PER_DAY, saleExpiry } from "@/lib/salonSale/store";

// GET  /api/salon-sales?market=US&state=TX&maxPrice=150000&sort=new|price&cursor=  — tin SANG TIỆM đang hiện (công khai)
// POST /api/salon-sales — chủ tiệm đăng sang / bán tiệm (OWNER · ADMIN)
const PAGE = 24;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const market: Market | null = sp.get("market") === "AU" ? "AU" : sp.get("market") === "US" ? "US" : null;
  const state = String(sp.get("state") || "").trim().toUpperCase().slice(0, 3);
  const maxPrice = Number(sp.get("maxPrice"));
  const sort = sp.get("sort") === "price" ? "price" : "new";
  const cursor = sp.get("cursor");
  const session = await getServerSession(authOptions).catch(() => null);
  const me = session?.user as { id?: string; role?: string } | undefined;
  const where: Prisma.SalonSaleWhereInput = {
    AND: [
      activeSaleWhere(),
      { owner: realOnly() },
      ...(market ? [{ market }] : []),
      ...(state ? [{ state }] : []),
      // Lọc giá: tin không ghi giá ("thương lượng") vẫn hiện
      ...(Number.isFinite(maxPrice) && maxPrice > 0 ? [{ OR: [{ askingPrice: null }, { askingPrice: { lte: Math.round(maxPrice) } }] }] : []),
    ],
  };
  try {
    const [rows, total, byState] = await Promise.all([
      prisma.salonSale.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: sort === "price" ? [{ askingPrice: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.salonSale.count({ where }),
      prisma.salonSale.groupBy({ by: ["state"], where: { AND: [activeSaleWhere(), { owner: realOnly() }, ...(market ? [{ market }] : [])] }, _count: { _all: true }, orderBy: { state: "asc" } }),
    ]);
    return NextResponse.json({
      sales: rows.map((r) => publicSale(r, me?.id, me?.role)),
      total,
      nextCursor: rows.length === PAGE ? rows[rows.length - 1].id : null,
      states: byState.map((r) => ({ state: r.state, n: (r._count as { _all: number })._all })).sort((a, b) => b.n - a.n),
    });
  } catch (e) {
    // Bảng chưa tạo (chưa chạy prisma/sql/2026-11-28_salon_sales.sql) → danh sách trống, không lỗi trang
    if (isMissingTable(e)) return NextResponse.json({ sales: [], total: 0, nextCursor: null, states: [], pending: true });
    console.error("GET /api/salon-sales error:", e);
    return NextResponse.json({ error: "Không tải được tin sang tiệm.", errorEn: "Couldn't load salons for sale." }, { status: 500 });
  }
}

const int = (v: unknown, max: number): number | null | "bad" => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > max) return "bad";
  return Math.round(n);
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "");

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (!me?.id) return NextResponse.json({ error: "Vui lòng đăng nhập để đăng tin sang tiệm.", errorEn: "Log in to list your salon." }, { status: 401 });
  if (me.role !== "OWNER" && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ tài khoản Chủ tiệm mới đăng được tin sang tiệm.", errorEn: "Only salon owner accounts can list a salon for sale." }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Dữ liệu không hợp lệ.", errorEn: "Invalid request." }, { status: 400 });

  const market: Market = b.market === "AU" ? "AU" : "US";
  const state = str(b.state, 3).toUpperCase();
  if (!(market === "AU" ? AU_ALL_CODES : US_ALL_CODES).includes(state)) return NextResponse.json({ error: "Chọn bang của tiệm.", errorEn: "Choose the salon's state." }, { status: 400 });
  const city = str(b.city, 60);
  const title = str(b.title, 120);
  const description = typeof b.description === "string" ? b.description.replace(/[<>]/g, "").trim().slice(0, 5000) : "";
  if (!city) return NextResponse.json({ error: "Nhập thành phố của tiệm.", errorEn: "Enter the salon's city." }, { status: 400 });
  if (title.length < 4) return NextResponse.json({ error: "Nhập tiêu đề (VD: Sang tiệm 8 ghế khu Mỹ trắng).", errorEn: "Add a title (e.g. 8-chair salon in a busy plaza)." }, { status: 400 });
  if (description.length < 20) return NextResponse.json({ error: "Mô tả tiệm ít nhất 20 ký tự (khách, vị trí, lý do sang…).", errorEn: "Describe the salon in at least 20 characters (clients, location, reason for selling…)." }, { status: 400 });
  const contact = parseMarketPhone(b.phone, market);
  if (!contact) {
    const msg = marketPhoneError(market);
    return NextResponse.json({ error: msg.vi, errorEn: msg.en, code: "PHONE_INVALID" }, { status: 400 });
  }
  const nums = {
    askingPrice: int(b.askingPrice, 10_000_000),
    monthlyRent: int(b.monthlyRent, 200_000),
    monthlyRevenue: int(b.monthlyRevenue, 5_000_000),
    chairs: int(b.chairs, 60),
    tables: int(b.tables, 60),
    sqft: int(b.sqft, 50_000),
  };
  const bad = Object.entries(nums).find(([, v]) => v === "bad");
  if (bad) return NextResponse.json({ error: `Số không hợp lệ: ${bad[0]}`, errorEn: `Invalid number: ${bad[0]}` }, { status: 400 });
  const media = cleanJobMedia(b.mediaUrls).slice(0, SALE_MAX_MEDIA);

  try {
    // Chống rác: tối đa SALE_MAX_ACTIVE tin đang hiện và SALE_MAX_PER_DAY tin mới / 24 giờ mỗi tài khoản (admin không giới hạn)
    if (me.role !== "ADMIN") {
      const [active, today] = await Promise.all([
        prisma.salonSale.count({ where: { ownerId: me.id, ...activeSaleWhere() } }),
        prisma.salonSale.count({ where: { ownerId: me.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } }),
      ]);
      if (active >= SALE_MAX_ACTIVE) return NextResponse.json({ error: `Bạn đang có ${active} tin sang tiệm. Đánh dấu "Đã sang" hoặc xoá bớt trước khi đăng thêm.`, errorEn: `You already have ${active} active listings. Mark one as sold or delete it first.`, code: "SALE_LIMIT" }, { status: 429 });
      if (today >= SALE_MAX_PER_DAY) return NextResponse.json({ error: "Bạn đã đăng đủ số tin hôm nay, thử lại ngày mai.", errorEn: "You've reached today's listing limit. Try again tomorrow.", code: "SALE_LIMIT" }, { status: 429 });
    }
    const s = await prisma.salonSale.create({
      data: {
        ownerId: me.id, title, description, salonName: str(b.salonName, 60), market, state, city,
        address: str(b.address, 160) || null, zip: str(b.zip, 10) || null,
        askingPrice: nums.askingPrice as number | null, monthlyRent: nums.monthlyRent as number | null, monthlyRevenue: nums.monthlyRevenue as number | null,
        chairs: nums.chairs as number | null, tables: nums.tables as number | null, sqft: nums.sqft as number | null,
        phone: contact.display, mediaUrls: JSON.stringify(media), expiresAt: saleExpiry(),
      },
      include: SALE_INCLUDE,
    });
    return NextResponse.json(publicSale(s, me.id, me.role), { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: "Mục Sang tiệm đang được bật, thử lại sau ít phút.", errorEn: "Salons for sale is being switched on. Try again in a few minutes." }, { status: 503 });
    console.error("POST /api/salon-sales error:", e);
    return NextResponse.json({ error: "Không đăng được tin sang tiệm.", errorEn: "Couldn't post the listing." }, { status: 500 });
  }
}
