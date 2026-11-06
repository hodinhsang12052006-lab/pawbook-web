// TIN NGÀNH NAIL (Mỹ / Úc) → BÀI VIẾT trên bảng tin, đăng từ TÀI KHOẢN CHÍNH THỨC PawNail.
//   - Nguồn: Google News + NAILS Magazine (lib/industryFeed.ts) — chỉ tiêu đề + tóm tắt ngắn của báo.
//   - AI viết lại bằng giọng chuyên nghiệp, gần gũi, HAI thứ tiếng (tiếng Việt + tiếng Anh, cùng nội dung).
//     Bản tiếng Anh lưu kèm bài (lib/postEn.ts) → người xem tiếng Anh thấy bản đó; thiếu / yếu → bài chỉ hiện
//     với người dùng tiếng Việt.
//   - CHỐNG BỊA: chỉ dựa trên tiêu đề + tóm tắt; con số nào không có trong nguồn → bỏ cả bài.
//   - Luôn ghi Nguồn + link bài gốc; không chép nguyên văn; không bịa trải nghiệm cá nhân.
//   - Mỗi ngày tối đa NEWS_POSTS_PER_DAY (mặc định 2), không đăng lại tin đã đăng.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { geminiEnabled, geminiJson } from "@/lib/gemini";
import { cfJson, cfTextEnabled } from "@/lib/cfText";
import { getIndustryNews, type NewsItem } from "@/lib/industryFeed";
import { getSetting, setSetting } from "@/lib/settings";
import { savePostEn } from "@/lib/postEn";

const KEY = "news_posted_links";
const DAY = 86_400_000;
export const newsPerDay = () => Math.min(4, Math.max(0, Number(process.env.NEWS_POSTS_PER_DAY ?? 2)));
const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

interface Written { hook: string; points: string[]; takeaway: string; hashtags: string[]; hookEn?: string; pointsEn?: string[]; takeawayEn?: string }

const FILLER = /(chi tiết (xem |có )?(trong|tại) bài gốc|xem thêm (trong|tại) bài gốc|đang cập nhật|không rõ|n\/a)/i;
/** Lý do bài viết yếu (để bỏ qua), hoặc null nếu đạt. */
export function weakWriting(w: Partial<Written>): string | null {
  const hook = String(w.hook || "").replace(/^\p{Extended_Pictographic}️?\s*/u, "").trim();
  if (hook.length < 25 || hook.split(/\s+/).length < 6) return "tiêu đề quá ngắn / cụt";
  const pts = (w.points || []).map((p) => String(p).trim()).filter(Boolean);
  if (pts.length < 2) return "ít hơn 2 ý";
  if (pts.some((p) => FILLER.test(p) || p.length < 15)) return "có ý rỗng";
  return null;
}
// JSON Schema chuẩn cho Cloudflare (Gemini dùng kiểu viết hoa ở SCHEMA bên dưới)
const CF_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    takeaway: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    hookEn: { type: "string" },
    pointsEn: { type: "array", items: { type: "string" } },
    takeawayEn: { type: "string" },
  },
  required: ["hook", "points", "takeaway", "hashtags"],
};
const SCHEMA = {
  type: "OBJECT",
  properties: {
    hook: { type: "STRING" },
    points: { type: "ARRAY", items: { type: "STRING" } },
    takeaway: { type: "STRING" },
    hashtags: { type: "ARRAY", items: { type: "STRING" } },
    hookEn: { type: "STRING" },
    pointsEn: { type: "ARRAY", items: { type: "STRING" } },
    takeawayEn: { type: "STRING" },
  },
  required: ["hook", "points", "takeaway", "hashtags"],
};

function prompt(n: NewsItem) {
  const where = n.market === "AU" ? "Úc" : "Mỹ";
  return `Bạn là người viết bài cho PawNail — nền tảng dành cho thợ nail và chủ tiệm nail tại Mỹ và Úc.
Viết lại TIN NGÀNH dưới đây thành 1 bài đăng ngắn bằng HAI thứ tiếng, cùng nội dung: tiếng Việt (hook, points, takeaway) và tiếng Anh Mỹ (hookEn, pointsEn, takeawayEn).
Giọng chuyên nghiệp, gần gũi, rõ ràng như một thương hiệu làm đẹp nói với người trong nghề. Tiếng Việt gọi người đọc là "bạn", không xưng "mình"; không văn mẫu, không giật tít, không viết hoa cả câu.

TIN (${where}) — từ ${n.source}:
Tiêu đề: ${n.title}
Tóm tắt của báo: ${n.summary || "(không có — chỉ dùng tiêu đề)"}

QUY TẮC BẮT BUỘC:
- CHỈ dùng thông tin có trong tiêu đề và tóm tắt ở trên. KHÔNG thêm sự kiện, con số, tên người, địa danh, ngày tháng không có trong đó.
- Thiếu chi tiết thì nói thẳng "chi tiết trong bài gốc" — không đoán.
- KHÔNG bịa trải nghiệm cá nhân ("hôm qua mình gặp…"), KHÔNG chép nguyên câu dài của báo.
- hook: 1 câu mở bài rõ ý, tối đa 120 ký tự, không emoji.
- points: 2–3 ý ngắn tóm tắt tin (mỗi ý ≤ 140 ký tự).
- takeaway: 1–2 câu "điều này có ý nghĩa gì với thợ nail / chủ tiệm ở ${where}" — lời khuyên chung, thận trọng, không khẳng định điều nguồn không nói.
- hookEn, pointsEn, takeawayEn: bản tiếng Anh của đúng 3 phần trên, cùng quy tắc (sentence case, không emoji, không "best", "#1", "guaranteed").
- hashtags: 2–3 hashtag tiếng Việt không dấu, không khoảng trắng (VD: TinNganhNail).`;
}

// Tin không đáng đăng cho thợ / chủ tiệm: chuyện vặt, người nổi tiếng, động vật, mục tư vấn ứng xử…
const OFF_TOPIC = /\b(cats?|kittens?|dogs?|pupp(y|ies)|animal|rescue|miss manners|dear abby|celebrit|star['’]?s?\b|royal|princess|kardashian|taylor swift|downton|horoscope|recipe|chisme)\b/i;
// Tin ngoài Mỹ / Úc lọt vào bộ lọc (Google News khớp lỏng)
const ELSEWHERE = /\b(toronto|ontario|canada|canadian|vancouver|montreal|calgary|london|england|scotland|ireland|singapore|india|philippines|new zealand|auckland|hong kong|mong kok|hdb|red dot|malaysia|china|chinese|taiwan|japan|korea|seoul|dubai)\b/i;
const postable = (n: NewsItem) => !OFF_TOPIC.test(n.title) && !ELSEWHERE.test(n.title);

/** Viết bài: Cloudflare Workers AI (miễn phí) trước, Gemini dự phòng. */
async function write(text: string): Promise<Written> {
  const errs: string[] = [];
  if (cfTextEnabled()) { try { return await cfJson<Written>(text, CF_SCHEMA); } catch (e) { errs.push(String((e as Error).message).slice(0, 80)); } }
  if (geminiEnabled()) { try { return await geminiJson<Written>(text, SCHEMA); } catch (e) { errs.push(String((e as Error).message).slice(0, 80)); } }
  throw new Error(errs.join(" | ") || "không có AI viết bài");
}

/** Con số trong bài viết phải xuất hiện trong nguồn (chống AI bịa số). */
function numbersSupported(written: string, n: NewsItem) {
  const src = `${n.title} ${n.summary || ""}`.replace(/[,.]/g, "");
  const nums = written.replace(/#[^\s]+/g, "").match(/\d[\d,.]*/g) || [];
  return nums.every((x) => src.includes(x.replace(/[,.]/g, "")));
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

const LEAD_EMOJI = /^\p{Extended_Pictographic}️?\s*/u;

export function composeNewsPost(n: NewsItem, w: Written) {
  const points = (Array.isArray(w.points) ? w.points : []).map((p) => clip(p, 160)).filter(Boolean).slice(0, 3);
  const tags = (Array.isArray(w.hashtags) ? w.hashtags : []).map((h) => clip(h, 30).replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean).slice(0, 2);
  if (!tags.includes("TinNganhNail")) tags.unshift("TinNganhNail");
  return [
    `📰 ${clip(w.hook, 140).replace(LEAD_EMOJI, "")}`,
    "",
    ...points.map((p) => `• ${p}`),
    "",
    clip(w.takeaway, 300),
    "",
    `Nguồn: ${n.source} — ${n.link}`,
    "",
    ["NailIndustry", "NailTech", ...tags].slice(0, 5).map((t) => `#${t}`).join(" "),
  ].join("\n");
}

/** Bản tiếng Anh (cùng khuôn) — null nếu AI không trả đủ / viết hụt. */
export function composeNewsPostEn(n: NewsItem, w: Written): string | null {
  const hook = clip(w.hookEn, 140).replace(LEAD_EMOJI, "");
  const points = (Array.isArray(w.pointsEn) ? w.pointsEn : []).map((p) => clip(p, 160)).filter(Boolean).slice(0, 3);
  const takeaway = clip(w.takeawayEn, 300);
  if (hook.length < 25 || points.length < 2 || points.some((p) => p.length < 15) || !takeaway) return null;
  return [`📰 ${hook}`, "", ...points.map((p) => `• ${p}`), "", takeaway, "", `Source: ${n.source} — ${n.link}`, "", "#NailIndustry #NailTech"].join("\n");
}

async function postedSet(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await getSetting(KEY)) || "[]")); } catch { return new Set(); }
}

/** Đăng tối đa `max` tin ngành mới. withTimeout: mỗi lần gọi Gemini tối đa ms. */
export async function publishNewsPosts(now = new Date(), opts: { max?: number; timeoutMs?: number; deadline?: number; news?: NewsItem[] } = {}): Promise<{ posted: string[]; skipped: string[] }> {
  const posted: string[] = [];
  const skipped: string[] = [];
  const officialId = process.env.OFFICIAL_ACCOUNT_ID;
  const max = opts.max ?? newsPerDay();
  if (!officialId || !max || process.env.OFFICIAL_DAILY_POST === "0") return { posted, skipped: ["tắt / chưa có tài khoản chính thức"] };
  if (!cfTextEnabled() && !geminiEnabled()) return { posted, skipped: ["chưa có Cloudflare AI / Gemini"] };
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = await prisma.post.count({ where: { authorId: officialId, createdAt: { gte: dayStart }, content: { startsWith: "📰" } } });
  let left = Math.max(0, max - today);
  if (!left) return { posted, skipped: ["hôm nay đã đủ tin ngành"] };

  const done = await postedSet();
  const news = (opts.news ?? (await getIndustryNews()))
    .filter((n) => n.market !== "VN" && n.lang === "en" && n.topic !== "other" && postable(n))
    .filter((n) => !n.publishedAt || now.getTime() - new Date(n.publishedAt).getTime() < 4 * DAY)
    .filter((n) => !done.has(hash(n.link)) && !done.has(hash(n.title.toLowerCase())));
  // Ưu tiên: luật/lao động/an toàn (ảnh hưởng túi tiền thợ) → xu hướng → kinh doanh; xen kẽ Mỹ/Úc
  const order = { law: 0, labor: 1, safety: 2, trend: 3, business: 4, other: 9 } as const;
  news.sort((a, b) => order[a.topic] - order[b.topic]);

  for (const n of news) {
    if (!left) break;
    if (opts.deadline && Date.now() > opts.deadline - 8000) { skipped.push("hết giờ"); break; }
    try {
      const w = await Promise.race([
        write(prompt(n)),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Gemini quá giờ")), opts.timeoutMs ?? 15_000)),
      ]);
      const text = composeNewsPost(n, w);
      if (!numbersSupported([w.hook, ...(w.points || []), w.takeaway].join(" "), n)) { skipped.push(`có số liệu không có trong nguồn: ${n.title.slice(0, 60)}`); done.add(hash(n.link)); continue; }
      if (text.length < 120) { skipped.push(`bài quá ngắn: ${n.title.slice(0, 60)}`); continue; }
      // Bài AI viết hụt (12/10/2026: tiêu đề "🚨 Một salon nail", ý "Chi tiết trong bài gốc") → không đăng.
      const weak = weakWriting(w);
      if (weak) { skipped.push(`bài viết yếu (${weak}): ${n.title.slice(0, 50)}`); done.add(hash(n.link)); continue; }
      const id = "c" + crypto.randomBytes(12).toString("hex");
      await prisma.post.create({
        data: { id, authorId: officialId, content: text, postType: "GENERAL", mediaUrls: "[]", market: n.market === "AU" ? "AU" : "US", createdAt: new Date(now.getTime() + posted.length * 1000) },
      });
      // Bản tiếng Anh: cùng kiểm tra chống bịa số như bản tiếng Việt.
      const en = composeNewsPostEn(n, w);
      if (en && numbersSupported([w.hookEn, ...(w.pointsEn || []), w.takeawayEn].join(" "), n)) await savePostEn(id, en);
      done.add(hash(n.link)); done.add(hash(n.title.toLowerCase()));
      posted.push(n.title);
      left--;
    } catch (e) {
      skipped.push(`${String((e as Error).message).slice(0, 80)}: ${n.title.slice(0, 50)}`);
    }
  }
  await setSetting(KEY, JSON.stringify([...done].slice(-3000)));
  return { posted, skipped };
}
