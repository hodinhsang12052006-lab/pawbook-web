import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { geminiEnabled, geminiVisionJson } from "@/lib/gemini";
import { cfTextEnabled, cfVisionJson } from "@/lib/cfText";
import { toPublic } from "@/lib/aiDesigns";
import { toPublicMenuItem } from "@/lib/menu";
import { VISION_SCHEMA, buildAdvice, sanitizePerception, sanitizePrefs, scoreDesign, scoreMenuItem, visionPrompt, type Part } from "@/lib/handConsult";

// POST /api/consult — "Soi tay tư vấn" (thợ / chủ tiệm).
//   { image: "data:image/jpeg;base64,…", part: "HAND"|"FOOT", prefs }  → AI nhìn ảnh rồi tính lời khuyên
//   { perception: {...}, part, prefs }                                 → thợ sửa kết quả / tự chọn: chỉ tính lại, KHÔNG gọi AI
// Ảnh KHÔNG được lưu ở đâu cả (chỉ gửi cho AI rồi bỏ) và không ghi vào log.
export const maxDuration = 60;
const DAY = 24 * 60 * 60 * 1000;
const SCANS_PER_DAY = Number(process.env.CONSULT_DAILY_LIMIT) || 40;
const MAX_B64 = 2_800_000; // ~2MB ảnh (client đã thu nhỏ còn ~200–400KB)

interface VisionOut { isTarget?: boolean; note?: string; [k: string]: unknown }

async function see(part: Part, image: { mimeType: string; base64: string }): Promise<{ out: VisionOut; provider: string }> {
  const prompt = visionPrompt(part);
  const errors: string[] = [];
  if (geminiEnabled()) {
    try { return { out: await geminiVisionJson<VisionOut>(prompt, image, VISION_SCHEMA), provider: "gemini" }; } catch (e) { errors.push((e as Error).message); }
  }
  if (cfTextEnabled()) {
    try { return { out: await cfVisionJson<VisionOut>(prompt, image, VISION_SCHEMA), provider: "cloudflare" }; } catch (e) { errors.push((e as Error).message); }
  }
  console.error("[consult] AI không trả lời:", errors.join(" | ").slice(0, 400));
  throw new Error("AI_UNAVAILABLE");
}

export async function POST(req: Request) {
  const me = ((await getServerSession(authOptions))?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: me }, select: { role: true } });
  if (!user || !["TECHNICIAN", "OWNER", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Tính năng dành cho thợ và chủ tiệm." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { image?: unknown; part?: unknown; prefs?: unknown; perception?: unknown };
  const part: Part = body.part === "FOOT" ? "FOOT" : "HAND";
  const prefs = sanitizePrefs(body.prefs);
  let provider = "manual";
  let note = "";
  let noteEn = "";
  let raw: unknown = body.perception;

  if (typeof body.image === "string") {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m) return NextResponse.json({ error: "Ảnh không hợp lệ (JPG / PNG / WebP)." }, { status: 400 });
    if (m[2].length > MAX_B64) return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 413 });
    const key = `consult:${me}`;
    if (isRateLimited(key, SCANS_PER_DAY, DAY)) return NextResponse.json({ error: `Bạn đã soi ${SCANS_PER_DAY} lần hôm nay — mai dùng tiếp nhé.` }, { status: 429 });
    recordAttempt(key, DAY);
    try {
      const r = await see(part, { mimeType: m[1], base64: m[2] });
      if (r.out?.isTarget === false) {
        return NextResponse.json({ error: part === "FOOT" ? "Chưa thấy rõ bàn chân / móng chân — chụp gần hơn, đủ sáng nhé." : "Chưa thấy rõ bàn tay / móng — chụp mu bàn tay, 5 ngón, đủ sáng nhé.", code: "NOT_TARGET" }, { status: 422 });
      }
      raw = r.out;
      provider = r.provider;
      note = typeof r.out?.note === "string" ? r.out.note.slice(0, 200) : "";
      noteEn = typeof r.out?.noteEn === "string" ? r.out.noteEn.slice(0, 200) : "";
    } catch {
      return NextResponse.json({ error: "AI đang bận — bạn có thể tự chọn tình trạng bên dưới để xem gợi ý.", code: "AI_UNAVAILABLE" }, { status: 503 });
    }
  } else if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Thiếu ảnh." }, { status: 400 });
  }

  const perception = sanitizePerception(raw, part);
  const advice = buildAdvice(perception, prefs);

  const [rows, mine] = await Promise.all([
    prisma.nailDesign.findMany({
      where: { status: "published", imageUrl: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 400,
      include: { _count: { select: { saves: true } } },
    }),
    prisma.menuItem.findMany({ where: { ownerId: me, active: true }, orderBy: { sortOrder: "asc" }, take: 120 }),
  ]);
  const designs = rows
    .map((r) => { const d = toPublic(r); return { d, s: scoreDesign(d, advice, perception) }; })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.d.saves - a.d.saves)
    .slice(0, 12)
    .map((x) => x.d);
  const menu = mine
    .map((r) => { const it = toPublicMenuItem(r, true); return { it, s: scoreMenuItem(it, advice, perception) }; })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.it);

  return NextResponse.json({ perception, note, noteEn, provider, advice, designs, menu, menuTotal: mine.length }, { headers: { "Cache-Control": "no-store" } });
}
