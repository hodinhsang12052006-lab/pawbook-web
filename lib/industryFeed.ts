// Tin ngành nail công khai — CHỈ lấy tiêu đề + nguồn + link + ngày (không chép
// nội dung bài). Nguồn: RSS công khai của Google News (Anh, Việt) và NAILS
// Magazine. Phân loại theo từ khoá để làm "radar nỗi đau ngành": luật & giấy
// phép, lao động & lương, an toàn hoá chất, kinh doanh, xu hướng mẫu.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  lang: "en" | "vi";
  topic: NewsTopic;
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

const FEEDS: { url: string; source?: string; lang: "en" | "vi" }[] = [
  { url: "https://news.google.com/rss/search?q=%22nail+salon%22+OR+%22nail+technician%22+when:14d&hl=en-US&gl=US&ceid=US:en", lang: "en" },
  { url: "https://news.google.com/rss/search?q=%22nail+salon%22+australia+when:30d&hl=en-AU&gl=AU&ceid=AU:en", lang: "en" },
  { url: "https://news.google.com/rss/search?q=%22ti%E1%BB%87m+nail%22+OR+%22th%E1%BB%A3+nail%22+OR+%22ngh%E1%BB%81+nail%22+when:60d&hl=vi&gl=VN&ceid=VN:vi", lang: "vi" },
  { url: "https://www.nailsmag.com/rss", source: "NAILS Magazine", lang: "en" },
];

// Google News khớp lỏng (trả cả tin không liên quan) → tiêu đề BẮT BUỘC nhắc
// tới nghề nail; tin từ NAILS Magazine thì luôn liên quan.
const RELEVANT = /\bnails?\b|manicur|pedicur|gel-?x|acrylic|nail tech|tiệm nail|thợ nail|nghề nail|làm móng|móng tay/i;

const TOPIC_RULES: { topic: NewsTopic; re: RegExp }[] = [
  { topic: "law", re: /licen[cs]|law|bill|regulat|legislat|inspection|fine[sd]?\b|ban\b|immigra|visa|giấy phép|luật|kiểm tra|phạt/i },
  { topic: "labor", re: /wage|labor|labour|worker|employee|staff shortage|overtime|pay\b|tip|lương|thợ|lao động/i },
  { topic: "safety", re: /chemical|fume|toxic|safety|health|ventilat|osha|cancer|infection|hoá chất|hóa chất|an toàn|sức khỏe|sức khoẻ/i },
  { topic: "trend", re: /trend|design|color|colour|manicure|chrome|gel-?x|aura|season|mẫu|xu hướng/i },
  { topic: "business", re: /salon|business|owner|open|clos|price|cost|tariff|franchise|kinh doanh|giá|chủ tiệm/i },
];

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];

function parse(xml: string, feed: (typeof FEEDS)[number]): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 40).flatMap(([, item]) => {
    let title = decode(tag(item, "title") || "");
    const link = decode(tag(item, "link") || "");
    if (!title || !/^https:\/\//.test(link)) return [];
    if (!feed.source && !RELEVANT.test(title)) return [];
    // Google News: "Tiêu đề - Nguồn"
    let source = feed.source || decode(tag(item, "source") || "");
    if (!feed.source && !source) {
      const m = title.match(/^(.*) - ([^-]{2,60})$/);
      if (m) { title = m[1]; source = m[2]; }
    } else if (!feed.source) {
      title = title.replace(new RegExp(` - ${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    }
    const pub = tag(item, "pubDate");
    const date = pub ? new Date(decode(pub)) : null;
    const topic = TOPIC_RULES.find((r) => r.re.test(title))?.topic ?? "other";
    return [{ title: title.slice(0, 200), link, source: (source || "Google News").slice(0, 60), publishedAt: date && !isNaN(date.getTime()) ? date.toISOString() : null, lang: feed.lang, topic }];
  });
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
  const seen = new Set<string>();
  const items = results
    .flat()
    .filter((i) => {
      const k = i.title.toLowerCase().replace(/\W+/g, " ").slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 60);
  // Nguồn ngoài lỗi hết → giữ bản cũ thay vì trả rỗng.
  if (items.length || !cache) cache = { at: Date.now(), items };
  return cache.items;
}
