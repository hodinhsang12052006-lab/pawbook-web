// Mục SANG TIỆM — đọc / ghi bảng SalonSale (prisma/sql/2026-11-28_salon_sales.sql).
//   - Tin chủ tiệm tự đăng (source null) hoặc bài sang tiệm từ nhóm cộng đồng do bot gửi (source "ingest").
//   - Chống trùng bài từ nhóm: cùng SĐT / cùng nội dung / cùng Facebook người đăng → cập nhật hoặc đẩy lên đầu (như tin tuyển).
//   - Tin đã gỡ giữ dòng (status "removed") để bot gửi lại đúng bài đó thì không đăng lại.
//   - Bảng chưa tạo trên DB (chưa chạy file SQL): đọc → danh sách rỗng; bot gửi bài → lỗi 500 để bot GỬI LẠI sau
//     (không đánh dấu "đã xem" rồi mất bài).
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const SALE_INGEST_SOURCE = "ingest";
const DAY = 86_400_000;
/** Bài sang tiệm từ nhóm tự ẩn sau N ngày kể từ ngày đăng (mặc định 45 — bán tiệm lâu hơn tuyển thợ). */
export const saleIngestTtlDays = () => Math.min(120, Math.max(7, Number(process.env.SALE_INGEST_TTL_DAYS) || 45));
/** Tin chủ tiệm tự đăng tự ẩn sau N ngày nếu không gia hạn (mặc định 60). */
export const saleOwnTtlDays = () => Math.min(180, Math.max(14, Number(process.env.SALE_TTL_DAYS) || 60));
/** Tối đa tin sang tiệm đang hiện / tài khoản, và tin mới / ngày (chống rác). */
export const SALE_MAX_ACTIVE = 3;
export const SALE_MAX_PER_DAY = 3;
export const SALE_MAX_MEDIA = 10;

export type SaleStatus = "active" | "sold" | "removed";

export interface SaleIngestData {
  title: string; salonName: string; description: string; market: "US" | "AU"; state: string; city: string;
  address: string | null; zip: string | null; phone: string;
  askingPrice: number | null; monthlyRent: number | null; monthlyRevenue: number | null; chairs: number | null; tables: number | null; sqft: number | null;
  source: string; sourceUrl: string | null; sourceKey: string; sourcePostedAt: Date; expiresAt: Date;
}

/** Lỗi bảng chưa có (Prisma P2021 / SQLite "no such table"). */
export const isMissingTable = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === "P2021" || /no such table|does not exist/i.test(String(x?.message || ""));
};

/** Tin đang hiện công khai: còn hạn, chưa sang, chưa gỡ. */
export const activeSaleWhere = (now = new Date()): Prisma.SalonSaleWhereInput => ({ status: "active", expiresAt: { gt: now } });

export function parseMedia(json: string | null | undefined): string[] {
  try {
    const a = JSON.parse(json || "[]");
    return Array.isArray(a) ? a.filter((u): u is string => typeof u === "string").slice(0, SALE_MAX_MEDIA) : [];
  } catch {
    return [];
  }
}

type SaleRow = Prisma.SalonSaleGetPayload<{ include: { owner: { select: { id: true; name: true; avatarUrl: true; email: true } } } }>;

/** Dữ liệu công khai của 1 tin (không lộ khoá chống trùng / mã băm Facebook / email chủ tin). */
export function publicSale(s: SaleRow, viewerId?: string | null, viewerRole?: string | null) {
  const fromGroup = s.source === SALE_INGEST_SOURCE;
  return {
    id: s.id,
    title: s.title,
    salonName: s.salonName,
    description: s.description,
    market: s.market as "US" | "AU",
    state: s.state,
    city: s.city,
    address: s.address,
    zip: s.zip,
    askingPrice: s.askingPrice,
    monthlyRent: s.monthlyRent,
    monthlyRevenue: s.monthlyRevenue,
    chairs: s.chairs,
    tables: s.tables,
    sqft: s.sqft,
    phone: s.phone,
    media: parseMedia(s.mediaUrls),
    status: s.status as SaleStatus,
    fromGroup,
    // Link bài gốc chỉ khi là link Facebook https (như tin tuyển từ nhóm)
    sourceUrl: fromGroup && s.sourceUrl && /^https:\/\/(www\.|m\.)?facebook\.com\//.test(s.sourceUrl) ? s.sourceUrl : null,
    repostCount: s.repostCount,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    // Người bán tự đăng → nhắn tin được trong app; bài từ nhóm → chỉ gọi (tài khoản hệ thống không đọc tin nhắn)
    seller: fromGroup ? null : { id: s.owner.id, name: s.owner.name, avatarUrl: s.owner.avatarUrl },
    canManage: !!viewerId && (viewerId === s.ownerId || viewerRole === "ADMIN"),
  };
}
export type PublicSale = ReturnType<typeof publicSale>;

export const SALE_INCLUDE = { owner: { select: { id: true, name: true, avatarUrl: true, email: true } } } as const;

export type SaleCommitResult = { status: "created" | "bumped" | "updated" | "skipped"; reason?: string; saleId?: string; repostCount?: number };

/** Lưu bài sang tiệm từ nhóm (chống trùng như tin tuyển). dryRun → chỉ đọc. Bảng chưa có → NÉM lỗi (bot gửi lại sau). */
export async function commitSale(
  data: SaleIngestData,
  opts: { fbHash?: string | null; posted: Date; ownerId: () => Promise<string>; dryRun?: boolean },
): Promise<SaleCommitResult> {
  const { fbHash, posted } = opts;
  // Chủ tiệm đã TỰ đăng tin sang tiệm này (cùng SĐT, còn hiện) → không thêm bản trùng từ nhóm
  const own = await prisma.salonSale.findFirst({ where: { source: null, phone: data.phone, ...activeSaleWhere() }, select: { id: true } });
  if (own) return { status: "skipped", reason: "tiệm đã tự đăng tin sang tiệm trên PawNail", saleId: own.id };
  const same = await prisma.salonSale.findFirst({
    where: { source: SALE_INGEST_SOURCE, OR: [{ sourceKey: data.sourceKey }, { phone: data.phone }, ...(fbHash ? [{ sourceFbHash: fbHash }] : [])] },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, sourceUrl: true, sourceKey: true, repostCount: true },
  });
  if (same) {
    if (same.status === "removed") return { status: "skipped", reason: "tin sang tiệm này đã được gỡ", saleId: same.id };
    if (same.status === "sold") {
      // Đã đánh dấu "đã sang": bài CŨ gửi lại → bỏ qua; bài MỚI của cùng số → tin mới (tiệm khác của cùng người bán)
      if (same.sourceKey === data.sourceKey || (data.sourceUrl && same.sourceUrl === data.sourceUrl)) return { status: "skipped", reason: "tiệm này đã được đánh dấu đã sang", saleId: same.id };
    } else {
      const samePost = data.sourceUrl ? same.sourceUrl === data.sourceUrl : same.sourceKey === data.sourceKey;
      if (samePost) {
        if (!opts.dryRun) await prisma.salonSale.update({ where: { id: same.id }, data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}) } });
        return { status: "updated", saleId: same.id, repostCount: same.repostCount };
      }
      if (opts.dryRun) return { status: "bumped", saleId: same.id, repostCount: same.repostCount + 1 };
      const s = await prisma.salonSale.update({
        where: { id: same.id },
        data: { ...data, ...(fbHash ? { sourceFbHash: fbHash } : {}), createdAt: posted, lastRepostedAt: new Date(), repostCount: { increment: 1 } },
        select: { repostCount: true },
      });
      return { status: "bumped", saleId: same.id, repostCount: s.repostCount };
    }
  }
  if (opts.dryRun) return { status: "created", repostCount: 1 };
  const s = await prisma.salonSale.create({ data: { ...data, sourceFbHash: fbHash ?? null, repostCount: 1, ownerId: await opts.ownerId(), createdAt: posted }, select: { id: true } });
  return { status: "created", saleId: s.id, repostCount: 1 };
}

/** Gỡ tin: giữ dòng (chống đăng lại) nhưng xoá dữ liệu công khai. */
export async function removeSale(id: string) {
  await prisma.salonSale.update({
    where: { id },
    data: { status: "removed", description: "", address: null, zip: null, salonName: "", mediaUrls: "[]", sourceUrl: null, expiresAt: new Date() },
  });
}

export const saleExpiry = (from = Date.now()) => new Date(from + saleOwnTtlDays() * DAY);
