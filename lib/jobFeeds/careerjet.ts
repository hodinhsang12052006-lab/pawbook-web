// Careerjet — TÌM TRỰC TIẾP theo từng người xem (nút "Tìm thêm việc nail trên web"). Không lưu DB, không cron.
// Careerjet yêu cầu IP + User-Agent THẬT của người bấm tìm (Chính sách quyền riêng tư đã ghi điều này).
// API v4: GET https://search.api.careerjet.net/v4/query, HTTP Basic (API key làm username, mật khẩu rỗng).
// ⚠ Trước khi bật EXTERNAL_JOBS_CAREERJET=on: xin Careerjet xác nhận bằng văn bản điều khoản hiển thị / ghi
//   nguồn / bộ nhớ đệm, và đối chiếu tên tham số với tài liệu v4 trong tài khoản publisher.
import { careerjetKey } from "@/lib/jobFeeds/config";
import { normalizeCareerjet, type CareerjetJob } from "@/lib/jobFeeds/normalize";
import { stateName } from "@/lib/stateNames";
import type { ExternalJobInput, FeedMarket, FetchLike } from "@/lib/jobFeeds/types";

export type CareerjetStatus = "ok" | "disabled" | "rate_limited" | "auth_error" | "error";

export async function searchCareerjet(opts: {
  market: FeedMarket; state?: string | null; city?: string | null; page?: number;
  userIp: string; userAgent: string; fetchImpl?: FetchLike; now?: Date;
}): Promise<{ status: CareerjetStatus; jobs: ExternalJobInput[]; total: number | null }> {
  const key = careerjetKey();
  if (!key) return { status: "disabled", jobs: [], total: null };
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  const url = new URL("https://search.api.careerjet.net/v4/query");
  url.searchParams.set("locale_code", opts.market === "AU" ? "en_AU" : "en_US");
  url.searchParams.set("keywords", "nail technician");
  const where = [opts.city?.trim(), opts.state ? stateName(opts.market, opts.state) : ""].filter(Boolean).join(", ");
  if (where) url.searchParams.set("location", where.slice(0, 80));
  url.searchParams.set("page", String(Math.min(10, Math.max(1, Math.floor(opts.page || 1)))));
  url.searchParams.set("user_ip", opts.userIp.slice(0, 64));
  url.searchParams.set("user_agent", opts.userAgent.slice(0, 300));
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    return { status: "error", jobs: [], total: null };
  }
  if (res.status === 429) return { status: "rate_limited", jobs: [], total: null };
  if (res.status === 401 || res.status === 403) return { status: "auth_error", jobs: [], total: null };
  if (!res.ok) return { status: "error", jobs: [], total: null };
  const body = (await res.json().catch(() => null)) as { jobs?: CareerjetJob[]; results?: CareerjetJob[]; hits?: number; total?: number } | null;
  const raw = Array.isArray(body?.jobs) ? body!.jobs! : Array.isArray(body?.results) ? body!.results! : [];
  const jobs = raw.map((j) => normalizeCareerjet(j, opts.market, opts.now)).filter((j): j is ExternalJobInput => !!j && !j.notNail);
  const total = typeof body?.hits === "number" ? body.hits : typeof body?.total === "number" ? body.total : null;
  return { status: "ok", jobs, total };
}
