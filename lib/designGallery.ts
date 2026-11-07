// "4 mẫu nail hôm nay" — mỗi ngày 1 bài ẢNH từ tài khoản chính thức (ảnh minh hoạ AI có ghi nhãn),
// không lặp lại mẫu đã giới thiệu, ưu tiên mẫu theo dịp lễ sắp tới + mẫu được lưu nhiều. Link về /designs.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { upcomingThemes } from "@/lib/aiDesigns";
import { SITE_URL } from "@/lib/siteUrl";
import { savePostEn } from "@/lib/postEn";
import { dtEn } from "@/lib/i18n/dtEn";
import { FLOW_WHERE } from "@/lib/flowMarks";
import { THEMES } from "@/lib/studioThemes";
import { RETIRED_OCCASIONS, activeOccasions } from "@/lib/season";

const KEY = "gallery_featured_designs";
export const GALLERY_PREFIX = "✨ 4 mẫu nail";

// Mỗi ngày tối đa GALLERY_PER_DAY bài (mỗi lượt cron 1 bài, cách nhau ≥ GALLERY_GAP_MS),
// mỗi bài 1 góc khác nhau để bảng tin không lặp: theo mùa → dễ làm cho thợ mới → quanh năm dễ bán.
export const GALLERY_PER_DAY = 3;
const GALLERY_GAP_MS = 4 * 3600_000;

export async function publishDesignGallery(now = new Date()): Promise<{ posted: boolean; ids?: string[]; reason?: string }> {
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  if (!officialId || process.env.OFFICIAL_DAILY_POST === "0" || process.env.DESIGN_GALLERY_DAILY === "0") return { posted: false, reason: "tắt" };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mine = { authorId: officialId, content: { startsWith: GALLERY_PREFIX } };
  const todayCount = await prisma.post.count({ where: { ...mine, createdAt: { gte: dayStart } } });
  if (todayCount >= GALLERY_PER_DAY) return { posted: false, reason: "hôm nay đã đủ" };
  if (await prisma.post.count({ where: { ...mine, createdAt: { gte: new Date(now.getTime() - GALLERY_GAP_MS) } } })) return { posted: false, reason: "vừa đăng, chờ lượt sau" };

  let featured: string[] = [];
  try { featured = JSON.parse((await getSetting(KEY)) || "[]"); } catch {}
  // Bài chung cho cả 2 thị trường (market: null) → dịp theo mùa chỉ khi dịp đó đang / sắp diễn ra ở CẢ Mỹ và Úc
  // (ngày địa phương, lib/season.ts); không có → góc quanh năm. Chỉ ảnh Google Flow đã duyệt (không ảnh máy vẽ),
  // không bao giờ dịp đã nghỉ (Halloween).
  const inWin = (m: "US" | "AU") => { const o = activeOccasions(m, now, { upcomingDays: 21 }); return new Set([...o.active, ...o.upcoming.map((u) => u.id)]); };
  const us = inWin("US"), au = inWin("AU");
  const shared = THEMES.map((t) => t.id).filter((id) => us.has(id) && au.has(id));
  const theme = upcomingThemes("US", now).find((t) => shared.includes(t.id)) ?? null;
  const base = {
    status: "published", imageUrl: { startsWith: "https://" }, id: { notIn: featured }, ...FLOW_WHERE,
    OR: [{ occasion: null }, { occasion: { in: shared } }, { occasion: { notIn: [...THEMES.map((t) => t.id), ...RETIRED_OCCASIONS] } }],
  };
  const pick = async (extra: object, n: number, skip: string[] = []) =>
    prisma.nailDesign.findMany({ where: { ...base, ...extra, ...(skip.length ? { AND: [{ id: { notIn: skip } }] } : {}) }, orderBy: [{ saves: { _count: "desc" } }, { publishedAt: "desc" }], take: n, select: { id: true, title: true, titleEn: true, imageUrl: true, occasion: true } });

  // Góc của bài hôm nay theo thứ tự lượt.
  const variant = todayCount % GALLERY_PER_DAY;
  const focus: object | null = variant === 0 ? (theme ? { occasion: theme.id } : { occasion: null }) : variant === 1 ? { difficulty: 1 } : { occasion: null };
  let list = focus ? await pick(focus, variant === 0 ? 2 : 4) : [];
  list = [...list, ...(await pick({}, 4 - list.length, list.map((d) => d.id)))];
  if (list.length < 4) return { posted: false, reason: "chưa đủ 4 mẫu Flow" };

  const seasonal = variant === 0 && theme && list.some((d) => d.occasion === theme.id);
  const head =
    variant === 1 ? `${GALLERY_PREFIX} dễ làm, lên đều tay — thợ mới cũng làm đẹp 🌱`
    : variant === 2 ? `${GALLERY_PREFIX} quanh năm, khách nào cũng hợp 💗`
    : `${GALLERY_PREFIX} đáng thử hôm nay${seasonal ? ` — có mẫu ${theme!.title} ${theme!.emoji}` : ""}`;
  const ask = variant === 1 ? "Mẫu nào bạn làm dưới 45 phút? Chia sẻ ảnh thật để thợ mới cùng học nhé 💅" : "Bạn thích mẫu số mấy? Làm xong, đăng ảnh thật ở mục Chia sẻ tác phẩm nhé 💅";
  const lines = list.map((d, i) => `${i + 1}. ${d.title}`);
  const content = [
    head,
    "",
    ...lines,
    "",
    `Mỗi mẫu có sẵn vật tư, các bước làm và giá gợi ý: ${SITE_URL}/designs`,
    ask,
    "",
    "Ảnh minh hoạ AI · #MauNail #PawNail",
  ].join("\n");
  // Bản tiếng Anh: tiêu đề mẫu lấy từ NailDesign.titleEn (mẫu nào cũng có sẵn 2 thứ tiếng).
  const headEn =
    variant === 1 ? "✨ 4 nail designs that are easy to get right — great for newer techs"
    : variant === 2 ? "✨ 4 nail designs for any season and any client"
    : `✨ 4 nail designs to try today${seasonal ? ` — including ${dtEn(theme!.title)} ${theme!.emoji}` : ""}`;
  const askEn = variant === 1 ? "Which one can you do in under 45 minutes? Share a photo of your version for newer techs." : "Which one is your favorite? Share a photo of your version when you're done.";
  const contentEn = [
    headEn,
    "",
    ...list.map((d, i) => `${i + 1}. ${d.titleEn || d.title}`),
    "",
    `Each design comes with materials, steps and a suggested price: ${SITE_URL}/designs`,
    askEn,
    "",
    "AI illustrations · #NailDesigns #PawNail",
  ].join("\n");
  const id = "c" + crypto.randomBytes(12).toString("hex");
  await prisma.post.create({
    data: { id, authorId: officialId, content, postType: "GENERAL", mediaUrls: JSON.stringify(list.map((d) => d.imageUrl)), market: null, createdAt: now },
  });
  await savePostEn(id, contentEn);
  await setSetting(KEY, JSON.stringify([...featured, ...list.map((d) => d.id)].slice(-2000)));
  return { posted: true, ids: list.map((d) => d.id) };
}
