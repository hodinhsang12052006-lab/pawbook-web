// Tin ngành nail công khai — CHỈ lấy tiêu đề + nguồn + link + ngày (không chép
// nội dung bài). Nguồn: tạp chí ngành (NAILS Magazine, NAILPRO, Scratch, American
// Spa, Professional Beauty AU) + Google News (Anh, Việt) nhưng chỉ giữ báo lớn có
// uy tín. Phân loại theo từ khoá để làm "radar nỗi đau ngành": luật & giấy phép,
// lao động & lương, an toàn hoá chất, kinh doanh, xu hướng mẫu.
//
// PawNail là nền tảng nghề nghiệp, không phải báo lá cải: bỏ tin tai nạn / cháy /
// hình sự, trang gây tranh cãi chính trị, nguồn hoặc tiêu đề không phải chữ Latin,
// và gộp các bài nhiều báo đăng lại về CÙNG một sự việc.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  lang: "en" | "vi";
  topic: NewsTopic;
  market: "US" | "AU" | "VN";
  summary: string | null; // đoạn tóm tắt ngắn của báo trong RSS (nếu có) — KHÔNG chép nội dung bài
}
export type NewsTopic = "law" | "labor" | "safety" | "business" | "trend" | "other";

export const TOPIC_LABEL: Record<NewsTopic, string> = {
  law: "Luật & giấy phép",
  labor: "Lao động & lương",
  safety: "An toàn & sức khoẻ",
  business: "Kinh doanh tiệm",
  trend: "Xu hướng mẫu",
  other: "Tin ngành",
};

// Tạp chí ngành qua Google News "site:" (không phụ thuộc đường dẫn RSS riêng của từng báo).
const gnSite = (site: string, hl = "en-US", gl = "US") =>
  `https://news.google.com/rss/search?q=site:${site}+when:30d&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;

const FEEDS: { url: string; source?: string; trade?: boolean; lang: "en" | "vi"; market: "US" | "AU" | "VN" }[] = [
  { url: gnSite("nailpro.com"), trade: true, lang: "en", market: "US" },
  { url: gnSite("americanspa.com"), trade: true, lang: "en", market: "US" },
  { url: gnSite("scratchmagazine.co.uk"), trade: true, lang: "en", market: "US" },
  { url: gnSite("professionalbeauty.com.au", "en-AU", "AU"), trade: true, lang: "en", market: "AU" },
  { url: "https://news.google.com/rss/search?q=%22nail+salon%22+OR+%22nail+technician%22+when:14d&hl=en-US&gl=US&ceid=US:en", lang: "en", market: "US" },
  { url: "https://news.google.com/rss/search?q=%22nail+salon%22+australia+when:30d&hl=en-AU&gl=AU&ceid=AU:en", lang: "en", market: "AU" },
  { url: "https://news.google.com/rss/search?q=%22nail+technician%22+OR+%22nail+tech%22+australia+when:30d&hl=en-AU&gl=AU&ceid=AU:en", lang: "en", market: "AU" },
  { url: "https://news.google.com/rss/search?q=%22ti%E1%BB%87m+nail%22+OR+%22th%E1%BB%A3+nail%22+OR+%22ngh%E1%BB%81+nail%22+when:60d&hl=vi&gl=VN&ceid=VN:vi", lang: "vi", market: "VN" },
  { url: "https://www.nailsmag.com/rss", source: "NAILS Magazine", trade: true, lang: "en", market: "US" },
];

// Google News khớp lỏng (trả cả tin không liên quan) → tiêu đề BẮT BUỘC nhắc
// tới nghề nail; tin từ tạp chí ngành thì luôn liên quan.
const RELEVANT = /\bnails?\b|manicur|pedicur|gel-?x|acrylic|nail tech|tiệm nail|thợ nail|nghề nail|làm móng|móng tay/i;

// Truy vấn chung của Google News chỉ giữ báo ngành / báo lớn có uy tín.
const TRUSTED_SOURCES =
  /^(NAILS Magazine|Nailpro|NAILPRO|Scratch( Magazine)?|American Spa|Professional Beauty|Salon Today|Modern Salon|Beauty Independent|WWD|Glossy|Allure|Vogue|Byrdie|Glamour|ELLE|Harper's BAZAAR|InStyle|Cosmopolitan|Refinery29|Who What Wear|Forbes|Business Insider|CNBC|Bloomberg|Reuters|Associated Press|AP News|NPR|NBC News|CBS News|ABC News|CNN|USA Today|The New York Times|The Washington Post|Los Angeles Times|The Guardian|ABC \(Australia\)|ABC News \(Australia\)|SBS|SBS News|news\.com\.au|The Sydney Morning Herald|The Age|The Conversation|VnExpress|Tuổi Trẻ|Thanh Niên|Người Việt|Người Việt Tây Bắc|SBS Tiếng Việt|VOA Tiếng Việt|BBC Tiếng Việt|Saigon Nhỏ|Việt Báo)\b/i;
const BLOCKED_SOURCES = /breitbart|gateway pundit|daily wire|daily caller|newsmax|oann|infowars|fox news|new york post|daily mail|the sun\b|tmz|the blaze|epoch times/i;
// Tai nạn, cháy nổ, hình sự — không phải "tin ngành".
const INCIDENT =
  /\b(crash(es|ed)?|car (into|through)|plow(s|ed)? into|drove into|vehicle|fire|blaze|burn(ing|ed)?|explosion|shoot(ing|er)?|shot|stab(bed|bing)?|kill(ed|s|ing)?|dies|died|dead|death|murder|homicide|arrest(ed|s)?|police|robb(ery|ed)|burglar|assault|kidnap|trafficking|brothel|raid(ed)?|charged|sentenced|jail|prison|fugitive|rescue[sd]?|trapped)\b|tai nạn|cháy|hỏa hoạn|bắt giữ|cướp|đâm|tử vong|thiệt mạng|cảnh sát|truy nã/i;
// Chữ không phải Latin (Hàn, Nhật, Trung, Thái, Kirin, Ả Rập…) ở tiêu đề hoặc tên nguồn → bỏ.
const NON_LATIN = /[Ͱ-ϿЀ-ӿ֐-ۿऀ-෿฀-๿ᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/;

const TOPIC_RULES: { topic: NewsTopic; re: RegExp }[] = [
  { topic: "law", re: /licen[cs]|law|bill|regulat|legislat|inspection|fine[sd]?\b|ban\b|immigra|visa|giấy phép|luật|kiểm tra|phạt/i },
  { topic: "labor", re: /wage|labor|labour|worker|employee|staff shortage|overtime|pay\b|tip|lương|thợ|lao động/i },
  { topic: "safety", re: /chemical|fume|toxic|safety|health|ventilat|osha|cancer|infection|hoá chất|hóa chất|an toàn|sức khỏe|sức khoẻ/i },
  { topic: "trend", re: /trend|design|color|colour|manicure|chrome|gel-?x|aura|season|mẫu|xu hướng/i },
  // KHÔNG khớp chữ "salon" (tin nào cũng có) — tin chưa phân loại để "Tin ngành", không gán bừa "Kinh doanh tiệm".
  { topic: "business", re: /business|owners?\b|opening|opens|closing|closes|price|pricing|cost|tariff|franchise|revenue|kinh doanh|giá|chủ tiệm/i },
];

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];

/** Tin có đáng hiện cho thợ / chủ tiệm không (nguồn, nội dung, chữ viết). */
export function acceptNews(title: string, source: string, trade: boolean): boolean {
  if (BLOCKED_SOURCES.test(source) || NON_LATIN.test(source) || NON_LATIN.test(title) || INCIDENT.test(title)) return false;
  return trade || TRUSTED_SOURCES.test(source.trim());
}

function parse(xml: string, feed: (typeof FEEDS)[number]): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 40).flatMap(([, item]) => {
    let title = decode(tag(item, "title") || "");
    const link = decode(tag(item, "link") || "");
    if (!title || !/^https:\/\//.test(link)) return [];
    if (!feed.trade && !RELEVANT.test(title)) return [];
    // Google News: "Tiêu đề - Nguồn"
    let source = feed.source || decode(tag(item, "source") || "");
    if (!feed.source && !source) {
      const m = title.match(/^(.*) - ([^-]{2,60})$/);
      if (m) { title = m[1]; source = m[2]; }
    } else if (!feed.source) {
      title = title.replace(new RegExp(` - ${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    }
    if (!acceptNews(title, source, !!feed.trade)) return [];
    const pub = tag(item, "pubDate");
    const date = pub ? new Date(decode(pub)) : null;
    const topic = TOPIC_RULES.find((r) => r.re.test(title))?.topic ?? "other";
    // Tóm tắt của báo (RSS description). Google News chỉ lặp lại tiêu đề → bỏ.
    let summary: string | null = decode(tag(item, "description") || "").replace(/\s+/g, " ").slice(0, 500) || null;
    if (summary && summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = null;
    return [{ title: title.slice(0, 200), link, source: (source || "Google News").slice(0, 60), publishedAt: date && !isNaN(date.getTime()) ? date.toISOString() : null, lang: feed.lang, topic, market: feed.market, summary }];
  });
}

const STOP = new Set(
  "nail nails salon salons the and for with from that this into after over amid says said will have has new news what your their about more than when where which while they them were been being local state city area near tiem tho nghe".split(" "),
);
/** Từ khoá có nghĩa của tiêu đề (bỏ dấu, chữ thường, ≥ 4 ký tự, bỏ từ chung chung). */
export function storyKeys(title: string): Set<string> {
  return new Set(
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}
/** Hai tiêu đề nói cùng 1 chuyện: trùng ≥ 3 từ khoá, hoặc ≥ 50% từ khoá của tiêu đề ngắn hơn. */
export function sameStory(a: string, b: string): boolean {
  const A = storyKeys(a), B = storyKeys(b);
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared >= 3 || shared / Math.min(A.size, B.size) >= 0.5;
}
const isTrade = (source: string) => /nails magazine|nailpro|scratch|american spa|professional beauty/i.test(source);
/** Gộp các bài về cùng 1 sự việc — ưu tiên bài của tạp chí ngành, còn lại giữ bài đến trước. */
export function dedupeStories<T extends { title: string; source: string }>(list: T[]): T[] {
  const out: T[] = [];
  for (const it of list) {
    const i = out.findIndex((o) => sameStory(o.title, it.title));
    if (i < 0) out.push(it);
    else if (isTrade(it.source) && !isTrade(out[i].source)) out[i] = it;
  }
  return out;
}

let cache: { at: number; items: NewsItem[] } | null = null;
const CACHE_MS = 3 * 60 * 60 * 1000; // 3 giờ — không gọi nguồn ngoài liên tục

export async function getIndustryNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: { "User-Agent": "PawNailTrendRadar/1.0 (+https://www.bitpawos.com)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        return parse(await res.text(), f);
      } catch {
        return [];
      }
    })
  );
  const items = dedupeStories(results.flat().sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")))
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 60);
  // Nguồn ngoài lỗi hết → giữ bản cũ thay vì trả rỗng.
  if (items.length || !cache) cache = { at: Date.now(), items };
  return cache.items;
}
