// TIN NGÀNH NAIL (Mỹ / Úc) → BÀI VIẾT trên bảng tin, đăng từ TÀI KHOẢN CHÍNH THỨC PawNail.
//   - Nguồn: Google News + NAILS Magazine (lib/industryFeed.ts) — chỉ tiêu đề + tóm tắt ngắn của báo.
//   - Gemini viết lại bằng giọng tự nhiên, thân thiện như người trong nghề ("mình"), tiếng Việt.
//   - CHỐNG BỊA: chỉ dựa trên tiêu đề + tóm tắt; con số nào không có trong nguồn → bỏ cả bài.
//   - Luôn ghi Nguồn + link bài gốc; không chép nguyên văn; không bịa trải nghiệm cá nhân.
//   - Mỗi ngày tối đa NEWS_POSTS_PER_DAY (mặc định 2), không đăng lại tin đã đăng.
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { geminiEnabled, geminiJson } from "@/lib/gemini";
import { cfJson, cfTextEnabled } from "@/lib/cfText";
import { getIndustryNews, type NewsItem } from "@/lib/industryFeed";
import { getSetting, setSetting } from "@/lib/settings";

const KEY = "news_posted_links";
const DAY = 86_400_000;
export const newsPerDay = () => Math.min(4, Math.max(0, Number(process.env.NEWS_POSTS_PER_DAY ?? 2)));
const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

interface Written { hook: string; points: string[]; takeaway: string; hashtags: string[] }
// JSON Schema chuẩn cho Cloudflare (Gemini dùng kiểu viết hoa ở SCHEMA bên dưới)
const CF_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    takeaway: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
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
  },
  required: ["hook", "points", "takeaway", "hashtags"],
};

function prompt(n: NewsItem) {
  const where = n.market === "AU" ? "Úc" : "Mỹ";
  return `Bạn là người viết bài cho PawNail Jobs — cộng đồng thợ nail và chủ tiệm nail người Việt ở Mỹ và Úc.
Viết lại TIN NGÀNH dưới đây thành 1 bài đăng mạng xã hội bằng TIẾNG VIỆT, giọng tự nhiên, gần gũi như người trong nghề chia sẻ (xưng "mình", gọi "các bạn"), không văn mẫu, không giật tít quá đà.

TIN (${where}) — từ ${n.source}:
Tiêu đề: ${n.title}
Tóm tắt của báo: ${n.summary || "(không có — chỉ dùng tiêu đề)"}

QUY TẮC BẮT BUỘC:
- CHỈ dùng thông tin có trong tiêu đề và tóm tắt ở trên. KHÔNG thêm sự kiện, con số, tên người, địa danh, ngày tháng không có trong đó.
- Thiếu chi tiết thì nói thẳng "chi tiết trong bài gốc" — không đoán.
- KHÔNG bịa trải nghiệm cá nhân ("hôm qua mình gặp…"), KHÔNG chép nguyên câu dài của báo.
- hook: 1 câu mở bài gây tò mò, có 1 emoji phù hợp ở đầu, tối đa 120 ký tự.
- points: 2–3 ý ngắn tóm tắt tin (mỗi ý ≤ 140 ký tự).
- takeaway: 1–2 câu "điều này có ý nghĩa gì với thợ nail / chủ tiệm ở ${where}" — lời khuyên chung, thận trọng, không khẳng định điều nguồn không nói.
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

export function composeNewsPost(n: NewsItem, w: Written) {
  const points = (Array.isArray(w.points) ? w.points : []).map((p) => clip(p, 160)).filter(Boolean).slice(0, 3);
  const tags = (Array.isArray(w.hashtags) ? w.hashtags : []).map((h) => clip(h, 30).replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean).slice(0, 3);
  if (!tags.includes("TinNganhNail")) tags.unshift("TinNganhNail");
  return [
    `📰 ${clip(w.hook, 140).replace(/^📰\s*/, "")}`,
    "",
    ...points.map((p) => `• ${p}`),
    "",
    `👉 ${clip(w.takeaway, 300)}`,
    "",
    `Nguồn: ${n.source} — ${n.link}`,
    "",
    tags.slice(0, 4).map((t) => `#${t}`).join(" "),
  ].join("\n");
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
      await prisma.post.create({
        data: { id: "c" + crypto.randomBytes(12).toString("hex"), authorId: officialId, content: text, postType: "GENERAL", mediaUrls: "[]", market: n.market === "AU" ? "AU" : "US", createdAt: new Date(now.getTime() + posted.length * 1000) },
      });
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
