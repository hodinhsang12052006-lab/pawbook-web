// Careerjet — TÌM TRỰC TIẾP theo từng người xem (nút "Tìm thêm việc nail trên web"). Không lưu DB, không cron.
// Careerjet yêu cầu IP + User-Agent THẬT của người bấm tìm (Chính sách quyền riêng tư đã ghi điều này).
// API v4: GET https://search.api.careerjet.net/v4/query, HTTP Basic (API key làm username, mật khẩu rỗng).
// ⚠ Chỉ chạy khi có CAREERJET_TERMS_CONFIRMED (Careerjet xác nhận bằng văn bản điều khoản hiển thị / ghi nguồn /
//   bộ nhớ đệm) — xem config.careerjetEnabled. Đối chiếu tên tham số với tài liệu v4 trong tài khoản publisher.
// Địa điểm mơ hồ (Careerjet trả type "LOCATIONS" thay cho danh sách việc) → thử lại 1 lần chỉ với bang / cả nước,
//   vẫn mơ hồ thì báo `ambiguous` để giao diện nói rõ thay vì "không có việc".
import { careerjetKey } from "@/lib/jobFeeds/config";
import { normalizeCareerjet, type CareerjetJob } from "@/lib/jobFeeds/normalize";
import { stateName } from "@/lib/stateNames";
import type { ExternalJobInput, FeedMarket, FetchLike } from "@/lib/jobFeeds/types";

export type CareerjetStatus = "ok" | "disabled" | "rate_limited" | "auth_error" | "error";
type Body = { type?: string; jobs?: CareerjetJob[]; results?: CareerjetJob[]; hits?: number; total?: number } | null;

export async function searchCareerjet(opts: {
  market: FeedMarket; state?: string | null; city?: string | null; page?: number;
  userIp: string; userAgent: string; fetchImpl?: FetchLike; now?: Date;
}): Promise<{ status: CareerjetStatus; jobs: ExternalJobInput[]; total: number | null; ambiguous?: boolean }> {
  const key = careerjetKey();
  if (!key) return { status: "disabled", jobs: [], total: null };
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  const call = async (where: string): Promise<{ status: CareerjetStatus; body: Body }> => {
    const url = new URL("https://search.api.careerjet.net/v4/query");
    url.searchParams.set("locale_code", opts.market === "AU" ? "en_AU" : "en_US");
    url.searchParams.set("keywords", "nail technician");
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
      return { status: "error", body: null };
    }
    if (res.status === 429) return { status: "rate_limited", body: null };
    if (res.status === 401 || res.status === 403) return { status: "auth_error", body: null };
    if (!res.ok) return { status: "error", body: null };
    return { status: "ok", body: (await res.json().catch(() => null)) as Body };
  };
  const stateLabel = opts.state ? stateName(opts.market, opts.state) : "";
  const full = [opts.city?.trim(), stateLabel].filter(Boolean).join(", ");
  let r = await call(full);
  const isLocations = (b: Body) => String(b?.type || "").toUpperCase() === "LOCATIONS";
  if (r.status === "ok" && isLocations(r.body) && full && full !== stateLabel) r = await call(stateLabel); // bỏ thành phố, giữ bang
  if (r.status !== "ok") return { status: r.status, jobs: [], total: null };
  if (isLocations(r.body)) return { status: "ok", jobs: [], total: 0, ambiguous: true };
  const body = r.body;
  const raw = Array.isArray(body?.jobs) ? body!.jobs! : Array.isArray(body?.results) ? body!.results! : [];
  const jobs = raw.map((j) => normalizeCareerjet(j, opts.market, opts.now)).filter((j): j is ExternalJobInput => !!j && !j.notNail);
  const total = typeof body?.hits === "number" ? body.hits : typeof body?.total === "number" ? body.total : null;
  return { status: "ok", jobs, total };
}
