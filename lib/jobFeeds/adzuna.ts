// Gọi Adzuna Search API (https://developer.adzuna.com/docs/search) cho 1 thị trường.
// KHÔNG BAO GIỜ log URL (có app_key) hay nội dung trả về — chỉ trả số lượng + mã HTTP cho người gọi.
import { adzunaMaxPages } from "@/lib/jobFeeds/config";
import type { AdzunaResult } from "@/lib/jobFeeds/normalize";
import type { FeedMarket, FetchLike } from "@/lib/jobFeeds/types";

const COUNTRY: Record<FeedMarket, string> = { US: "us", AU: "au" };
export const ADZUNA_PER_PAGE = 50;
// Truy vấn nail; loại sẵn nghề xây dựng hay dính chữ "nail" (lọc thêm theo tiêu đề ở normalize.isNailJob).
export const ADZUNA_QUERY = {
  what_or: "nail manicurist pedicurist manicure",
  what_exclude: "nailer roofing roofer framing carpenter construction drywall",
  max_days_old: "30",
  sort_by: "date",
} as const;

export type AdzunaStatus = "ok" | "rate_limited" | "auth_error" | "error" | "deadline";
export interface AdzunaFetch { results: AdzunaResult[]; calls: number; status: AdzunaStatus; httpStatus: number | null; count: number | null }

export async function fetchAdzunaMarket(
  market: FeedMarket,
  opts: { keys: { appId: string; appKey: string }; fetchImpl?: FetchLike; maxPages?: number; deadline?: number },
): Promise<AdzunaFetch> {
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  const maxPages = opts.maxPages ?? adzunaMaxPages();
  const out: AdzunaFetch = { results: [], calls: 0, status: "ok", httpStatus: null, count: null };
  for (let page = 1; page <= maxPages; page++) {
    if (opts.deadline && Date.now() > opts.deadline) { out.status = "deadline"; break; }
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${COUNTRY[market]}/search/${page}`);
    url.searchParams.set("app_id", opts.keys.appId);
    url.searchParams.set("app_key", opts.keys.appKey);
    url.searchParams.set("results_per_page", String(ADZUNA_PER_PAGE));
    for (const [k, v] of Object.entries(ADZUNA_QUERY)) url.searchParams.set(k, v);
    url.searchParams.set("content-type", "application/json");
    let res: Response;
    try {
      out.calls++;
      res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    } catch {
      out.status = "error"; // lỗi mạng / quá giờ — không ghi chi tiết (có thể chứa URL kèm khoá)
      break;
    }
    out.httpStatus = res.status;
    if (res.status === 429) { out.status = "rate_limited"; break; } // hết lượt → lượt sau làm tiếp
    if (res.status === 401 || res.status === 403) { out.status = "auth_error"; break; } // khoá sai / bị thu hồi
    if (!res.ok) { out.status = "error"; break; }
    type Body = { count?: number; results?: AdzunaResult[] } | null;
    let body: Body = null;
    try { body = (await res.json()) as Body; } catch { out.status = "error"; break; }
    const rows: AdzunaResult[] = body && Array.isArray(body.results) ? body.results : [];
    if (body && typeof body.count === "number") out.count = body.count;
    out.results.push(...rows);
    if (rows.length < ADZUNA_PER_PAGE) break;
  }
  return out;
}
