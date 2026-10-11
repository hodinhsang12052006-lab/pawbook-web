// Mỗi ngày 1 bài mới từ TÀI KHOẢN CHÍNH THỨC (bot nội dung: thuế, tip, an toàn, mẹo, hỏi đáp — có nguồn).
// Chạy trong cron sáng (/api/cron/designs). Không đăng trùng (so dòng đầu), không đăng 2 bài/ngày,
// xen kẽ Mỹ / Úc theo ngày. Tắt: đặt OFFICIAL_DAILY_POST=0 trên Vercel.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { buildBotDrafts, firstLine } from "@/lib/contentBot";
import { upcomingThemes } from "@/lib/aiDesigns";
import { GALLERY_PREFIX } from "@/lib/designGallery";

export async function publishDailyOfficialPost(now = new Date()): Promise<{ posted: boolean; title?: string; reason?: string }> {
  if (process.env.OFFICIAL_DAILY_POST === "0") return { posted: false, reason: "đã tắt" };
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId) return { posted: false, reason: "chưa có OFFICIAL_ACCOUNT_ID" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Chỉ đếm bài KIẾN THỨC hôm nay — bài ảnh mẫu nail, tin ngành, chủ đề nóng (có thăm dò) là loại khác,
  // trước đây đếm chung nên hễ sáng có chủ đề nóng là bài kiến thức buổi tối bị bỏ.
  const knowledgeToday = await prisma.post.count({
    where: { authorId: officialId, createdAt: { gte: dayStart }, poll: { is: null }, NOT: [{ content: { startsWith: GALLERY_PREFIX } }, { content: { startsWith: "📰" } }] },
  });
  if (knowledgeToday) return { posted: false, reason: "hôm nay đã có bài" };

  const mine = await prisma.post.findMany({ where: { authorId: officialId }, select: { content: true }, take: 1000 });
  const published = new Set(mine.map((p) => firstLine(p.content)));
  const day = Math.floor(now.getTime() / 86_400_000);
  const markets: ("US" | "AU")[] = day % 2 === 0 ? ["US", "AU"] : ["AU", "US"];
  for (const market of markets) {
    // Quảng bá bộ mẫu dịp lễ chỉ khi đã có ≥ 10 mẫu đăng (nói đúng sự thật)
    let theme: { title: string; emoji: string } | null = null;
    const t = upcomingThemes(market, now)[0];
    if (t && (await prisma.nailDesign.count({ where: { status: "published", occasion: t.id } }).catch(() => 0)) >= 10) theme = { title: t.title, emoji: t.emoji };
    const draft = buildBotDrafts({ market, now, theme, publishedTitles: published }).find((d) => !d.pinned && !published.has(firstLine(d.text)));
    if (!draft) continue;
    await prisma.post.create({
      data: { id: "c" + crypto.randomBytes(12).toString("hex"), authorId: officialId, content: draft.text, postType: "GENERAL", mediaUrls: "[]", market: draft.market === "ALL" ? null : draft.market, createdAt: now },
    });
    return { posted: true, title: firstLine(draft.text) };
  }
  return { posted: false, reason: "hết bài mới trong kho nội dung" };
}
