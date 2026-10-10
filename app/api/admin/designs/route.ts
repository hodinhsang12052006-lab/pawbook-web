import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { geminiEnabled } from "@/lib/gemini";
import { cfDailyImages, cfImageEnabled } from "@/lib/cfImage";
import { dailyLimit, generateDesigns, generateEngine, generateOccasion, generateSamples, imagesDrawnToday, OCCASION_BATCH_MAX, redrawImage, storageReady, textOnly, toPublic, upcomingThemes } from "@/lib/aiDesigns";

// Mẫu nail AI — chỉ ADMIN (xác minh trong DB):
//   GET                         — nháp chờ duyệt + mẫu đã đăng gần đây + trạng thái cấu hình
//   POST  { count?, market?, mode? } — tạo mẫu nháp: mode "engine" (máy tạo mẫu PawNail, 0đ),
//                                    "ai" (Gemini, trong giới hạn/ngày) hoặc "sample" (mẫu soạn sẵn)
//   PATCH { id, status }        — duyệt ("published") hoặc bỏ ("rejected")
//   PATCH { id, action: "redraw" } — vẽ lại ảnh (Cloudflare miễn phí, tối đa 3 lần/mẫu)
//   PATCH { ids: [...], status }    — duyệt / bỏ hàng loạt (tối đa 200)
//   POST  { mode: "occasion", occasion, count } — tạo CẢ BỘ mẫu cho 1 dịp lễ (tối đa 150)
export const maxDuration = 60; // vẽ ảnh mất 10–30 giây

const missing = (err: unknown) => /no such table|P2021/i.test(String((err as Error)?.message || err));

async function admin() {
  const id = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!id) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  const me = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (me?.role !== "ADMIN") return { error: NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 }) };
  return { id };
}

export async function GET() {
  const a = await admin();
  if (a.error) return a.error;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const [drafts, published, madeToday] = await Promise.all([
      prisma.nailDesign.findMany({ where: { status: "draft" }, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { saves: true } } } }),
      prisma.nailDesign.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 12, include: { _count: { select: { saves: true } } } }),
      prisma.nailDesign.count({ where: { day } }),
    ]);
    return NextResponse.json({
      enabled: geminiEnabled(),
      storage: storageReady(),
      textOnly: textOnly(),
      cfImages: cfImageEnabled() && storageReady() ? cfDailyImages() : 0,
      imagesToday: await imagesDrawnToday().catch(() => 0),
      nextOccasion: (() => { const t = upcomingThemes("US", new Date())[0]; return t ? { id: t.id, title: t.title, emoji: t.emoji } : null; })(),
      dailyLimit: dailyLimit(),
      madeToday,
      drafts: drafts.map(toPublic),
      published: published.map(toPublic),
    });
  } catch (err) {
    if (missing(err)) return NextResponse.json({ enabled: geminiEnabled(), storage: storageReady(), dailyLimit: dailyLimit(), madeToday: 0, drafts: [], published: [], needsSql: true });
    throw err;
  }
}

export async function POST(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { count?: number; market?: string; mode?: string; occasion?: string };
  const market0 = body.market === "AU" ? "AU" : "US";
  if (body.mode === "occasion") {
    const n = Math.min(OCCASION_BATCH_MAX, Math.max(1, Math.round(Number(body.count) || 50)));
    try {
      const r = await generateOccasion(market0, String(body.occasion ?? ""), n);
      return NextResponse.json(r, { status: r.created.length ? 201 : 200 });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message.slice(0, 300) }, { status: 502 });
    }
  }
  const count = Math.min(6, Math.max(1, Math.round(Number(body.count) || 3)));
  const market = body.market === "AU" ? "AU" : "US";
  const local = body.mode === "sample" || body.mode === "engine";
  if (!local && !geminiEnabled()) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ." }, { status: 503 });
  try {
    const r = body.mode === "engine" ? await generateEngine(market, count) : body.mode === "sample" ? await generateSamples(market, count) : await generateDesigns(market, count);
    return NextResponse.json(r, { status: r.created.length ? 201 : 200 });
  } catch (err) {
    if (missing(err)) return NextResponse.json({ error: "Chưa tạo bảng NailDesign — chạy prisma/sql/2026-10-09_nail_designs.sql." }, { status: 503 });
    return NextResponse.json({ error: (err as Error).message.slice(0, 300) }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const a = await admin();
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; ids?: string[]; status?: string; action?: string };
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((x) => typeof x === "string").slice(0, 200);
    if (!ids.length || !["published", "rejected"].includes(body.status ?? "")) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    const r = await prisma.nailDesign.updateMany({ where: { id: { in: ids }, status: "draft" }, data: { status: body.status, publishedAt: body.status === "published" ? new Date() : null } });
    return NextResponse.json({ ok: true, count: r.count });
  }
  if (body.id && body.action === "redraw") {
    const r = await redrawImage(body.id);
    return NextResponse.json(r, { status: r.imageUrl ? 200 : r.error === "Không tìm thấy mẫu." ? 404 : 422 });
  }
  if (!body.id || !["published", "rejected", "draft"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  const r = await prisma.nailDesign.updateMany({
    where: { id: body.id },
    data: { status: body.status, publishedAt: body.status === "published" ? new Date() : null },
  });
  return NextResponse.json({ ok: r.count > 0 }, { status: r.count ? 200 : 404 });
}
