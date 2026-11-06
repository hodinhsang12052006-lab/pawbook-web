"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, ExternalLink, Globe, Loader2, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { timeAgo } from "@/lib/feedFormat";
import type { PublicExternalJob } from "@/lib/jobFeeds/types";

// "Việc làm nail từ các trang tuyển dụng khác" — tin của ĐỐI TÁC (Adzuna; Careerjet khi bấm tìm), hiện TÁCH RIÊNG
// dưới tin của các tiệm trên PawNail. Mỗi thẻ ghi rõ nguồn ("via Adzuna" + chữ "Jobs by Adzuna" có link về
// Adzuna) và chỉ có 1 nút: mở tin gốc để xem & ứng tuyển. KHÔNG có nút gọi, nhắn tin, lưu vào tiệm, nhận tiệm,
// số người xem / "gấp" — PawNail không đại diện các công ty này và không liên hệ họ.
// Đối tác không ghi ngày đăng → "Không ghi ngày đăng" (không bao giờ "vừa đăng").
// Hiện phía trình duyệt (không có trong HTML máy chủ) → nội dung đối tác không bị lập chỉ mục như của PawNail.

const PROVIDER_NAME = { adzuna: "Adzuna", careerjet: "Careerjet" } as const;
const PER_PAGE = 6;

function salaryText(s: PublicExternalJob["salary"]): string | null {
  if (!s || (s.min == null && s.max == null)) return null;
  const sym = s.currency === "AUD" ? "A$" : "$";
  const f = (n: number) => n.toLocaleString("en-US");
  const amount = s.min != null && s.max != null && s.max !== s.min ? `${sym}${f(s.min)}–${f(s.max)}` : `${sym}${f((s.min ?? s.max)!)}`;
  const per: Record<string, string> = { YEAR: tr("năm", "year"), MONTH: tr("tháng", "month"), WEEK: tr("tuần", "week"), DAY: tr("ngày", "day"), HOUR: tr("giờ", "hour") };
  return s.period && per[s.period] ? `${amount} / ${per[s.period]}` : amount;
}

function ExternalJobCard({ job }: { job: PublicExternalJob }) {
  useTr();
  const name = PROVIDER_NAME[job.provider];
  const pay = salaryText(job.salary);
  const time = job.contractTime === "full_time" ? tr("Toàn thời gian", "Full-time") : job.contractTime === "part_time" ? tr("Bán thời gian", "Part-time") : null;
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-slate-900/40 p-4 sm:p-5 refined:border-pn-line refined:bg-pn-surface" data-testid="external-job">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-white refined:text-pn-text">{job.title}</h3>
          {job.company && <p className="truncate text-sm text-slate-400 refined:text-pn-text-2">{job.company}</p>}
        </div>
        <span className="flex-shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-300 ring-1 ring-white/10" data-testid="external-via">
          via {name}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 refined:text-pn-text-2">
        <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{job.locationLabel}</span></span>
        <span className="inline-flex items-center gap-1" data-testid="external-posted">
          <Clock className="h-3.5 w-3.5" />{job.postedAt ? timeAgo(job.postedAt) : tr("Không ghi ngày đăng", "Date not given")}
        </span>
        {time && <span>{time}</span>}
      </p>
      {pay && <p className="text-sm font-bold text-emerald-300 refined:tabular-nums">{pay}</p>}
      {job.snippet && <p className="line-clamp-2 text-sm leading-relaxed text-slate-300 refined:text-pn-text-2">{job.snippet}</p>}
      {/* Điện thoại: nút + chữ ghi nguồn xếp DỌC (mỗi thứ 1 hàng, nút không bị gãy chữ); màn rộng: cùng 1 hàng */}
      <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.06] pt-2.5 sm:flex-row sm:items-center sm:justify-between refined:border-pn-line">
        <a
          href={job.url}
          target="_blank"
          rel="noopener nofollow"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-white ring-1 ring-white/10 transition-transform duration-100 hover:bg-white/[0.12] active:scale-95 sm:w-auto sm:flex-1 refined:bg-white/[0.06] refined:hover:bg-white/10"
          data-testid="external-cta"
        >
          {tr(`Xem & ứng tuyển trên ${name}`, `View & apply on ${name}`)} <ExternalLink className="h-4 w-4 flex-shrink-0" />
        </a>
        {/* Ghi nguồn bắt buộc trên TỪNG tin: chữ "Adzuna" ≥ 116×23 px (ở đây ≥ 136×30, chữ 14 px đậm), link về trang của
            đối tác đúng quốc gia. Link ghi nguồn KHÔNG nofollow (đây là link ghi công cho đối tác). */}
        <a
          href={job.attribution.href}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-[30px] min-w-[136px] items-center justify-center self-center rounded-md bg-white px-3 py-1 text-sm font-black tracking-tight text-slate-900 sm:self-auto"
          data-testid="external-attribution"
        >
          {job.attribution.label}
        </a>
      </div>
    </article>
  );
}

type Resp = { enabled: boolean; webSearch: boolean; referralFee?: boolean; items: PublicExternalJob[]; total: number };
type Loaded = { key: string; data: Resp | null; items: PublicExternalJob[]; page: number; exhausted: boolean };
type Web = { key: string; loading: boolean; items: PublicExternalJob[] | null; error: string | null; ambiguous: boolean };

export default function ExternalJobs({ market, state, q }: { market: "US" | "AU"; state: string; q: string }) {
  useTr();
  // Mọi trạng thái gắn với 1 "khoá lọc": đổi thị trường / bang / tìm → trạng thái cũ tự bỏ (không setState đồng bộ
  // trong effect), và trang "Xem thêm" của bộ lọc cũ về muộn không bao giờ được nối vào danh sách mới.
  const key = `${market}|${state}|${q}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [more, setMore] = useState(false);
  const [webState, setWeb] = useState<Web | null>(null);
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ market, page: "1", pageSize: String(PER_PAGE) });
    if (state) p.set("state", state);
    if (q) p.set("q", q);
    fetch(`/api/jobs/external?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (!cancelled) setLoaded({ key, data: d, items: d?.items ?? [], page: 1, exhausted: !d?.items?.length }); })
      .catch(() => { if (!cancelled) setLoaded({ key, data: null, items: [], page: 1, exhausted: true }); });
    return () => { cancelled = true; };
  }, [key, market, state, q]);

  const cur = loaded?.key === key ? loaded : null;
  const web: Web = webState?.key === key ? webState : { key, loading: false, items: null, error: null, ambiguous: false };

  const loadMore = async () => {
    if (!cur) return;
    const forKey = key;
    setMore(true);
    const p = new URLSearchParams({ market, page: String(cur.page + 1), pageSize: String(PER_PAGE) });
    if (state) p.set("state", state);
    if (q) p.set("q", q);
    try {
      const d: Resp = await fetch(`/api/jobs/external?${p}`).then((r) => r.json());
      if (keyRef.current !== forKey) return; // bộ lọc đã đổi trong lúc tải → bỏ kết quả cũ
      const add = d.items ?? [];
      setLoaded((prev) => (prev && prev.key === forKey ? { ...prev, items: [...prev.items, ...add.filter((x) => !prev.items.some((y) => y.id === x.id))], page: prev.page + 1, exhausted: !add.length } : prev));
    } catch {
      setLoaded((prev) => (prev && prev.key === forKey ? { ...prev, exhausted: true } : prev));
    } finally { setMore(false); }
  };

  const searchWeb = async () => {
    const forKey = key;
    setWeb({ key: forKey, loading: true, items: null, error: null, ambiguous: false });
    const p = new URLSearchParams({ market });
    if (state) p.set("state", state);
    if (q) p.set("city", q);
    const fail = (error: string) => setWeb({ key: forKey, loading: false, items: null, error, ambiguous: false });
    try {
      const r = await fetch(`/api/jobs/web-search?${p}`);
      const d = await r.json().catch(() => ({}));
      if (keyRef.current !== forKey) return;
      if (!r.ok) { fail(r.status === 429 ? tr("Bạn tìm hơi nhanh — thử lại sau 1 phút.", "Too many searches — try again in a minute.") : tr("Chưa tìm được, thử lại sau.", "Search is unavailable right now.")); return; }
      setWeb({ key: forKey, loading: false, items: d.items ?? [], error: null, ambiguous: !!d.ambiguous });
    } catch {
      fail(tr("Chưa tìm được, thử lại sau.", "Search is unavailable right now."));
    }
  };

  const data = cur?.data;
  if (!cur || !data || (!data.enabled && !data.webSearch)) return null;
  const items = cur.items;
  const sources = [data.enabled ? "Adzuna" : null, data.webSearch ? "Careerjet" : null].filter(Boolean).join(tr(" và ", " and "));

  return (
    <section className="space-y-3 pt-4" aria-labelledby="external-jobs-title" data-testid="external-jobs">
      <div className="space-y-1 border-t border-white/[0.06] pt-4 refined:border-pn-line">
        <h2 id="external-jobs-title" className="flex items-center gap-2 text-base font-black text-white refined:text-pn-text">
          <Globe className="h-4 w-4 text-slate-400" />
          {tr("Việc làm nail từ các trang tuyển dụng khác", "More nail jobs from around the web")}
        </h2>
        <p className="text-xs leading-relaxed text-slate-400 refined:text-pn-text-2">
          {tr(`Tin lấy từ ${sources}, không phải tin đăng trên PawNail. PawNail không đại diện các nơi tuyển này — bấm để xem và ứng tuyển trên trang gốc.`, `Collected from ${sources}, not posted on PawNail. PawNail doesn't represent these employers — open the original listing to view and apply.`)}
          {data.referralFee ? tr(" PawNail có thể nhận phí giới thiệu khi bạn mở các tin này.", " PawNail may earn a referral fee when you open these listings.") : ""}
        </p>
      </div>

      {data.enabled && (items.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((j) => <ExternalJobCard key={j.id} job={j} />)}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-5 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">{tr("Chưa có tin phù hợp lúc này.", "No matching jobs right now.")}</p>
      ))}
      {data.enabled && items.length < data.total && !cur.exhausted && (
        <button type="button" onClick={loadMore} disabled={more} className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05] disabled:opacity-50">
          {more && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Xem thêm", "Show more")}
        </button>
      )}

      {data.webSearch && (
        <div className="space-y-3">
          {web.items === null && (
            <button type="button" onClick={searchWeb} disabled={web.loading} className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50" data-testid="web-search-btn">
              {web.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {tr("Tìm thêm việc nail trên web", "Search more nail jobs on the web")}
            </button>
          )}
          {web.error && <p className="text-center text-xs text-amber-300">{web.error}</p>}
          {web.items && (web.items.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {web.items.map((j) => <ExternalJobCard key={j.id} job={j} />)}
            </div>
          ) : (
            <p className="text-center text-sm text-slate-400">
              {web.ambiguous
                ? tr("Tên nơi này trùng nhiều địa điểm — chọn bang hoặc gõ tên thành phố rõ hơn rồi tìm lại.", "That place name matches several locations — pick a state or type a more specific city, then search again.")
                : tr("Chưa có tin phù hợp lúc này.", "No matching jobs right now.")}
            </p>
          ))}
          <p className="text-center text-[11px] text-slate-500">
            {tr("Tìm trên web gửi địa chỉ IP và loại trình duyệt của bạn tới Careerjet để lấy kết quả. ", "Web search sends your IP address and browser type to Careerjet to get results. ")}
            <Link href="/privacy" className="underline">{tr("Quyền riêng tư", "Privacy")}</Link>
          </p>
        </div>
      )}
    </section>
  );
}
