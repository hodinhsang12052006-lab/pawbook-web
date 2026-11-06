// Mỗi ngày 1 bài mới từ TÀI KHOẢN CHÍNH THỨC (bot nội dung: thuế, tip, an toàn, mẹo, hỏi đáp — có nguồn).
// Chạy trong cron sáng (/api/cron/designs). Không đăng trùng (so dòng đầu), không đăng 2 bài/ngày,
// xen kẽ Mỹ / Úc theo ngày. Tắt: đặt OFFICIAL_DAILY_POST=0 trên Vercel.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { buildBotDrafts, firstLine } from "@/lib/contentBot";
import { upcomingThemes } from "@/lib/aiDesigns";
import { GALLERY_PREFIX } from "@/lib/designGallery";
import { DIGEST_PREFIX } from "@/lib/jobDigestPost";
import { savePostEn } from "@/lib/postEn";

export const KNOWLEDGE_PER_DAY = 2;
const SHAPE_COOLDOWN_MS = 60 * 86_400_000;
/** Dòng đầu bỏ mọi chữ số — "còn 12 ngày" và "còn 11 ngày" là cùng 1 bài. */
export const titleShape = (content: string) => firstLine(content).replace(/\d+/g, "#");

export async function publishDailyOfficialPost(now = new Date()): Promise<{ posted: boolean; title?: string; reason?: string }> {
  if (process.env.OFFICIAL_DAILY_POST === "0") return { posted: false, reason: "đã tắt" };
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId) return { posted: false, reason: "chưa có OFFICIAL_ACCOUNT_ID" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Chỉ đếm bài KIẾN THỨC hôm nay — bài ảnh mẫu nail, tin ngành, chủ đề nóng (có thăm dò) là loại khác,
  // trước đây đếm chung nên hễ sáng có chủ đề nóng là bài kiến thức buổi tối bị bỏ.
  const knowledge = { authorId: officialId, poll: { is: null }, NOT: [{ content: { startsWith: GALLERY_PREFIX } }, { content: { startsWith: "📰" } }, { content: { startsWith: DIGEST_PREFIX } }] };
  // Tối đa KNOWLEDGE_PER_DAY bài/ngày (sáng + tối), cách nhau ≥ 5 giờ để không dồn 1 lúc.
  const [knowledgeToday, recent] = await Promise.all([
    prisma.post.count({ where: { ...knowledge, createdAt: { gte: dayStart } } }),
    prisma.post.count({ where: { ...knowledge, createdAt: { gte: new Date(now.getTime() - 5 * 3600_000) } } }),
  ]);
  if (knowledgeToday >= KNOWLEDGE_PER_DAY) return { posted: false, reason: "hôm nay đã có bài" };
  if (recent) return { posted: false, reason: "vừa đăng, chờ lượt sau" };

  const mine = await prisma.post.findMany({ where: { authorId: officialId }, select: { content: true, createdAt: true }, take: 1000 });
  const published = new Set(mine.map((p) => firstLine(p.content)));
  // Tiêu đề có số thay đổi theo ngày (VD "⏰ … hạn đóng thuế quý … (còn 12 ngày)") → so dòng đầu đã bỏ số: cùng chủ đề
  // đăng trong 60 ngày qua thì không đăng lại (trước đây mỗi ngày 1 bài gần y hệt suốt 3 tuần trước hạn thuế).
  const lastByShape = new Map<string, number>();
  for (const p of mine) {
    const k = titleShape(p.content);
    lastByShape.set(k, Math.max(lastByShape.get(k) ?? 0, p.createdAt.getTime()));
  }
  const recentShape = (text: string) => (lastByShape.get(titleShape(text)) ?? 0) > now.getTime() - SHAPE_COOLDOWN_MS;
  const day = Math.floor(now.getTime() / 86_400_000);
  const markets: ("US" | "AU")[] = day % 2 === 0 ? ["US", "AU"] : ["AU", "US"];
  for (const market of markets) {
    // Quảng bá bộ mẫu dịp lễ chỉ khi đã có ≥ 10 mẫu đăng (nói đúng sự thật)
    let theme: { title: string; emoji: string } | null = null;
    const t = upcomingThemes(market, now)[0];
    if (t && (await prisma.nailDesign.count({ where: { status: "published", occasion: t.id } }).catch(() => 0)) >= 10) theme = { title: t.title, emoji: t.emoji };
    const draft = buildBotDrafts({ market, now, theme, publishedTitles: published }).find((d) => !d.pinned && !published.has(firstLine(d.text)) && !recentShape(d.text));
    if (!draft) continue;
    const id = "c" + crypto.randomBytes(12).toString("hex");
    await prisma.post.create({
      data: { id, authorId: officialId, content: draft.text, postType: "GENERAL", mediaUrls: "[]", market: draft.market === "ALL" ? null : draft.market, createdAt: now },
    });
    // Bài có bản tiếng Anh → người xem tiếng Anh thấy bản đó; không có → bài chỉ hiện với người dùng tiếng Việt.
    if (draft.textEn) await savePostEn(id, draft.textEn);
    return { posted: true, title: firstLine(draft.text) };
  }
  return { posted: false, reason: "hết bài mới trong kho nội dung" };
}
