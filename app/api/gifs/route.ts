import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { marketFromHeaders } from "@/lib/market";
import { gifQueryEn } from "@/lib/gifQueryVi";
import { gifVideoContent } from "@/lib/chat/gif";

// GET /api/gifs?q=&lang=en|vi&next= — tìm GIF qua API hợp lệ (khoá nằm ở máy chủ, không lộ ra trình duyệt).
// GET /api/gifs?probe=1 — chỉ báo { enabled } theo việc CÓ khoá hay không (không gọi nhà cung cấp, không tính lượt) —
//   lib/chat/gifAvailability.ts hỏi 1 lần / phiên để ẩn mọi lối vào GIF khi chưa có khoá.
//   GIPHY (GIPHY_API_KEY) → nếu không có thì Tenor v2 (TENOR_API_KEY) → không có khoá nào: { enabled:false }.
// KHÔNG còn bộ GIF dán cứng: thiếu khoá / khoá sai / lỗi phía nhà cung cấp → { enabled:false, reason } (bảng GIF hiện
// "chưa dùng được" + nút sang Nhãn dán). Chỉ trả URL media của GIPHY / Tenor — khớp danh sách nguồn ảnh khi gửi tin.
// Chủ app cần thêm GIPHY_API_KEY trên Vercel (project pawbook-web) — KHÔNG dùng tiền tố NEXT_PUBLIC_.

export interface Gif {
  id: string;
  /** Nội dung tin khi gửi: GIPHY → MP4 "…/200.mp4#wh=WxH&still=<poster>" (lib/chat/gif.ts); Tenor → GIF "#wh=WxH" */
  send: string;
  /** Ô trong lưới: MP4 nhỏ (GIPHY fixed_width, rộng 200px) hoặc WebP / GIF */
  preview: string;
  /** Ảnh tĩnh của ô (khi tắt chuyển động / tiết kiệm dữ liệu) */
  still?: string;
  w: number;
  h: number;
  title: string;
}
type Provider = "giphy" | "tenor";
type Reason = "no_key" | "bad_key" | "upstream";
type Page = { ok: true; results: Gif[]; next: string | null } | { ok: false; reason: Reason };

const LIMIT = 24;
const MAX_OFFSET = 4999;
const PER_MIN = 60;
let loggedBadKey = false;
// Nhà cung cấp vừa từ chối khoá (401/403) → probe của instance này báo tắt trong 10 phút (khỏi hiện tab GIF rồi lại ẩn)
let badKeyAt = 0;
const BAD_KEY_MS = 10 * 60_000;

const strip = (u: unknown) => (typeof u === "string" ? u.split("?")[0] : "");
const GIPHY_MEDIA = /^https:\/\/media\d*\.giphy\.com\//;
const GIPHY_MP4 = /^https:\/\/media\d*\.giphy\.com\/[^?#\s]+\.mp4$/;
const TENOR_MEDIA = /^https:\/\/(media\.tenor\.com|[a-z0-9-]+\.tenor\.com)\//;

function badKey(provider: Provider, status: number): Page {
  badKeyAt = Date.now();
  if (!loggedBadKey) {
    loggedBadKey = true;
    console.error(`[gifs] ${provider} rejected the API key (HTTP ${status}) — set a valid ${provider === "giphy" ? "GIPHY_API_KEY" : "TENOR_API_KEY"} on Vercel`);
  }
  return { ok: false, reason: "bad_key" };
}

async function giphyPage(key: string, q: string, lang: "vi" | "en", offset: number): Promise<Page> {
  const rating = process.env.GIPHY_RATING === "pg" ? "pg" : "g";
  const params = new URLSearchParams({ api_key: key, limit: String(LIMIT), offset: String(offset), rating, lang });
  if (q) params.set("q", q);
  const url = `https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?${params}`;
  let r: Response;
  try {
    r = await fetch(url, { next: { revalidate: q ? 3600 : 900 } });
  } catch {
    return { ok: false, reason: "upstream" };
  }
  if (r.status === 401 || r.status === 403) return badKey("giphy", r.status);
  if (!r.ok) return { ok: false, reason: "upstream" };
  type Img = { url?: string; webp?: string; mp4?: string; width?: string; height?: string };
  const d = (await r.json().catch(() => null)) as { data?: { id?: string; title?: string; images?: Record<string, Img> }[]; pagination?: { total_count?: number; count?: number } } | null;
  if (!d || !Array.isArray(d.data)) return { ok: false, reason: "upstream" };
  const results: Gif[] = [];
  for (const g of d.data) {
    const im = g.images || {};
    // Gửi: fixed_height (cao 200px, rộng theo tỉ lệ — 16:9 ≈ 356px) để bong bóng 240px không bị phóng to ~3× trên màn
    // hình 2,6–3× DPR như fixed_width (rộng 200px). Bản MP4 (nhẹ hơn WebP/GIF nhiều lần) + ảnh tĩnh fixed_height_still làm
    // poster; thiếu MP4 → WebP / GIF như trước. Ô trong lưới: MP4 fixed_width (200px, mượt + nhẹ), thiếu → WebP downsampled.
    const fh = im.fixed_height || {};
    const w = Number(fh.width);
    const h = Number(fh.height);
    const mp4 = strip(fh.mp4);
    const poster = strip(im.fixed_height_still?.url);
    const legacy = strip(fh.webp || fh.url);
    const send = GIPHY_MP4.test(mp4) ? gifVideoContent(mp4, w, h, GIPHY_MEDIA.test(poster) ? poster : null) : `${legacy}#wh=${w}x${h}`;
    const tileMp4 = strip(im.fixed_width?.mp4);
    const preview = GIPHY_MP4.test(tileMp4) ? tileMp4 : strip(im.fixed_width_downsampled?.webp || im.fixed_width_small?.webp) || legacy;
    const still = strip(im.fixed_width_still?.url || im.fixed_height_still?.url);
    if (!g.id || !GIPHY_MEDIA.test(send) || !GIPHY_MEDIA.test(preview) || !(w > 0) || !(h > 0)) continue;
    results.push({ id: `g_${g.id}`, send, preview, ...(GIPHY_MEDIA.test(still) ? { still } : {}), w, h, title: String(g.title || "").slice(0, 120) });
  }
  const count = d.data.length;
  const total = Number(d.pagination?.total_count ?? 0);
  const nextOffset = offset + count;
  return { ok: true, results, next: count > 0 && total > nextOffset && nextOffset <= MAX_OFFSET ? String(nextOffset) : null };
}

async function tenorPage(key: string, q: string, lang: "vi" | "en", pos: string, country: "US" | "AU"): Promise<Page> {
  const params = new URLSearchParams({
    key,
    client_key: process.env.TENOR_CLIENT_KEY || "pawnail",
    limit: String(LIMIT),
    contentfilter: "high",
    media_filter: "tinygif,gif",
    locale: lang === "vi" ? "vi_VN" : "en_US",
    country,
  });
  if (q) params.set("q", q);
  if (pos) params.set("pos", pos);
  const url = `https://tenor.googleapis.com/v2/${q ? "search" : "featured"}?${params}`;
  let r: Response;
  try {
    r = await fetch(url, { next: { revalidate: q ? 3600 : 900 } });
  } catch {
    return { ok: false, reason: "upstream" };
  }
  if (r.status === 401 || r.status === 403) return badKey("tenor", r.status);
  // Tenor trả 400 "API key not valid" cho khoá sai
  if (r.status === 400) {
    const t = await r.text().catch(() => "");
    if (/api key/i.test(t)) return badKey("tenor", r.status);
    return { ok: false, reason: "upstream" };
  }
  if (!r.ok) return { ok: false, reason: "upstream" };
  type Fmt = { url?: string; dims?: number[] };
  const d = (await r.json().catch(() => null)) as { results?: { id?: string; content_description?: string; title?: string; media_formats?: Record<string, Fmt> }[]; next?: string } | null;
  if (!d || !Array.isArray(d.results)) return { ok: false, reason: "upstream" };
  const results: Gif[] = [];
  for (const g of d.results) {
    const tiny = g.media_formats?.tinygif;
    const u = strip(tiny?.url);
    const [w, h] = Array.isArray(tiny?.dims) ? tiny!.dims!.map(Number) : [0, 0];
    if (!g.id || !TENOR_MEDIA.test(u) || !(w > 0) || !(h > 0)) continue;
    results.push({ id: `t_${g.id}`, send: `${u}#wh=${w}x${h}`, preview: u, w, h, title: String(g.content_description || g.title || "").slice(0, 120) });
  }
  const next = typeof d.next === "string" && d.next && d.next !== "0" && results.length ? d.next : null;
  return { ok: true, results, next };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const giphyKey = process.env.GIPHY_API_KEY;
  const tenorKey = process.env.TENOR_API_KEY;
  const provider: Provider | null = giphyKey ? "giphy" : tenorKey ? "tenor" : null;
  const sp = new URL(req.url).searchParams;
  // Tắt (thiếu khoá / khoá sai / lỗi nhà cung cấp) → no-store: thêm khoá trên Vercel + redeploy là trình duyệt thấy ngay.
  const off = { "Cache-Control": "no-store" };
  const headers = { "Cache-Control": "private, max-age=300" };
  if (sp.get("probe") === "1") {
    const on = !!provider && Date.now() - badKeyAt > BAD_KEY_MS;
    return NextResponse.json({ enabled: on, provider: on ? provider : null }, { headers: off });
  }
  if (!provider) return NextResponse.json({ enabled: false, provider: null, results: [], reason: "no_key" satisfies Reason }, { headers: off });

  // Giới hạn mềm theo người (bộ nhớ của 1 instance): 60 lượt / phút — giữ khoá beta (≈100 lượt/giờ) khỏi cạn.
  const rlKey = `gifs:${uid}`;
  if (isRateLimited(rlKey, PER_MIN, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  recordAttempt(rlKey, 60_000);

  const q = (sp.get("q") || "").trim().replace(/\s+/g, " ").slice(0, 50);
  const lang: "vi" | "en" = sp.get("lang") === "vi" ? "vi" : "en";
  const rawNext = (sp.get("next") || "").slice(0, 200);
  // "e:<next>" = trang tiếp của lượt tìm bằng từ tiếng Anh (tìm tiếng Việt quá ít kết quả)
  const enMode = rawNext.startsWith("e:");
  const next = enMode ? rawNext.slice(2) : rawNext;
  const enTerm = q && lang === "vi" ? gifQueryEn(q) : null;
  const country = marketFromHeaders((n) => req.headers.get(n)).market === "AU" ? "AU" : "US";

  const page = (term: string, l: "vi" | "en", n: string) =>
    provider === "giphy" ? giphyPage(giphyKey!, term, l, Math.min(MAX_OFFSET, Math.max(0, Math.floor(Number(n)) || 0))) : tenorPage(tenorKey!, term, l, n, country);

  const first = enMode && enTerm ? await page(enTerm, "en", next) : await page(q, lang, next);
  if (!first.ok) return NextResponse.json({ enabled: false, provider: null, results: [], reason: first.reason }, { headers: off });

  let results = first.results;
  let nextOut = first.next ? (enMode ? `e:${first.next}` : first.next) : null;
  // Tìm tiếng Việt < 8 kết quả → tìm thêm bằng từ tiếng Anh, gộp + bỏ trùng; các trang sau đi theo lượt tiếng Anh.
  if (!enMode && !next && enTerm && results.length < 8) {
    const extra = await page(enTerm, "en", "");
    if (extra.ok) {
      const seen = new Set(results.map((g) => g.id));
      results = [...results, ...extra.results.filter((g) => !seen.has(g.id))];
      nextOut = extra.next ? `e:${extra.next}` : null;
    }
  }
  return NextResponse.json({ enabled: true, provider, results, next: nextOut }, { headers });
}
