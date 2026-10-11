// "4 mẫu nail hôm nay" — mỗi ngày 1 bài ẢNH từ tài khoản chính thức (ảnh minh hoạ AI có ghi nhãn),
// không lặp lại mẫu đã giới thiệu, ưu tiên mẫu theo dịp lễ sắp tới + mẫu được lưu nhiều. Link về /designs.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { upcomingThemes } from "@/lib/aiDesigns";
import { SITE_URL } from "@/lib/siteUrl";

const KEY = "gallery_featured_designs";
export const GALLERY_PREFIX = "✨ 4 mẫu nail";

export async function publishDesignGallery(now = new Date()): Promise<{ posted: boolean; ids?: string[]; reason?: string }> {
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId || process.env.OFFICIAL_DAILY_POST === "0" || process.env.DESIGN_GALLERY_DAILY === "0") return { posted: false, reason: "tắt" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (await prisma.post.count({ where: { authorId: officialId, createdAt: { gte: dayStart }, content: { startsWith: GALLERY_PREFIX } } })) return { posted: false, reason: "hôm nay đã có" };

  let featured: string[] = [];
  try { featured = JSON.parse((await getSetting(KEY)) || "[]"); } catch {}
  const theme = upcomingThemes("US", now)[0];
  const base = { status: "published", imageUrl: { startsWith: "https://" }, id: { notIn: featured } } as const;
  const pick = async (extra: object, n: number) =>
    prisma.nailDesign.findMany({ where: { ...base, ...extra }, orderBy: [{ saves: { _count: "desc" } }, { publishedAt: "desc" }], take: n, select: { id: true, title: true, imageUrl: true, occasion: true } });
  let list = theme ? await pick({ occasion: theme.id }, 2) : [];
  list = [...list, ...(await pick({ id: { notIn: [...featured, ...list.map((d) => d.id)] } }, 4 - list.length))];
  if (list.length < 4) return { posted: false, reason: "chưa đủ 4 mẫu mới có ảnh" };

  const lines = list.map((d, i) => `${i + 1}. ${d.title}`);
  const content = [
    `${GALLERY_PREFIX} đáng thử hôm nay${theme && list.some((d) => d.occasion === theme.id) ? ` — có mẫu ${theme.title} ${theme.emoji}` : ""}`,
    "",
    ...lines,
    "",
    `👉 Mỗi mẫu có sẵn vật tư, các bước làm và giá gợi ý: ${SITE_URL}/designs`,
    "Bạn thích mẫu số mấy? Làm xong nhớ đăng ảnh thật khoe tay nghề nhé 💅",
    "",
    "Ảnh minh hoạ AI · #MauNail #PawNail",
  ].join("\n");
  await prisma.post.create({
    data: { id: "c" + crypto.randomBytes(12).toString("hex"), authorId: officialId, content, postType: "GENERAL", mediaUrls: JSON.stringify(list.map((d) => d.imageUrl)), market: null, createdAt: now },
  });
  await setSetting(KEY, JSON.stringify([...featured, ...list.map((d) => d.id)].slice(-2000)));
  return { posted: true, ids: list.map((d) => d.id) };
}
