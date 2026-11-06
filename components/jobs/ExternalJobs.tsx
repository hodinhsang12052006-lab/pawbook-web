"use client";

import { useEffect, useState } from "react";
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
    <article className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-slate-900/40 p-4 sm:p-5" data-testid="external-job">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-white">{job.title}</h3>
          {job.company && <p className="truncate text-sm text-slate-400">{job.company}</p>}
        </div>
        <span className="flex-shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-300 ring-1 ring-white/10" data-testid="external-via">
          via {name}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.locationLabel}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(job.postedAt)}</span>
        {time && <span>{time}</span>}
      </p>
      {pay && <p className="text-sm font-bold text-emerald-300">{pay}</p>}
      {job.snippet && <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">{job.snippet}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <a
          href={job.url}
          target="_blank"
          rel="noopener nofollow"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/[0.12] active:scale-95 transition-transform duration-100"
        >
          {tr(`Xem & ứng tuyển trên ${name}`, `View & apply on ${name}`)} <ExternalLink className="h-4 w-4" />
        </a>
        {/* Ghi nguồn bắt buộc trên TỪNG tin (≥ 116×23 px, link về trang của đối tác đúng quốc gia) */}
        <a
          href={job.attribution.href}
          target="_blank"
          rel="noopener nofollow"
          className="inline-flex min-h-[23px] min-w-[116px] items-center justify-center rounded-md bg-white px-2.5 py-1 text-xs font-black tracking-tight text-slate-900"
          data-testid="external-attribution"
        >
          {job.attribution.label}
        </a>
      </div>
    </article>
  );
}

type Resp = { enabled: boolean; webSearch: boolean; items: PublicExternalJob[]; total: number };

export default function ExternalJobs({ market, state, q }: { market: "US" | "AU"; state: string; q: string }) {
  useTr();
  const [data, setData] = useState<Resp | null>(null);
  const [items, setItems] = useState<PublicExternalJob[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [web, setWeb] = useState<{ loading: boolean; items: PublicExternalJob[] | null; error: string | null }>({ loading: false, items: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setPage(1);
    setWeb({ loading: false, items: null, error: null });
    const p = new URLSearchParams({ market, page: "1", pageSize: String(PER_PAGE) });
    if (state) p.set("state", state);
    if (q) p.set("q", q);
    fetch(`/api/jobs/external?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (!cancelled) { setData(d); setItems(d?.items ?? []); } })
      .catch(() => !cancelled && setData(null));
    return () => { cancelled = true; };
  }, [market, state, q]);

  const loadMore = async () => {
    setMore(true);
    const p = new URLSearchParams({ market, page: String(page + 1), pageSize: String(PER_PAGE) });
    if (state) p.set("state", state);
    if (q) p.set("q", q);
    try {
      const d: Resp = await fetch(`/api/jobs/external?${p}`).then((r) => r.json());
      setItems((prev) => [...prev, ...(d.items ?? [])]);
      setPage((x) => x + 1);
    } catch {} finally { setMore(false); }
  };

  const searchWeb = async () => {
    setWeb({ loading: true, items: null, error: null });
    const p = new URLSearchParams({ market });
    if (state) p.set("state", state);
    if (q) p.set("city", q);
    try {
      const r = await fetch(`/api/jobs/web-search?${p}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setWeb({ loading: false, items: null, error: r.status === 429 ? tr("Bạn tìm hơi nhanh — thử lại sau 1 phút.", "Too many searches — try again in a minute.") : tr("Chưa tìm được, thử lại sau.", "Search is unavailable right now.") }); return; }
      setWeb({ loading: false, items: d.items ?? [], error: null });
    } catch {
      setWeb({ loading: false, items: null, error: tr("Chưa tìm được, thử lại sau.", "Search is unavailable right now.") });
    }
  };

  if (!data || (!data.enabled && !data.webSearch)) return null;
  const sources = [data.enabled ? "Adzuna" : null, data.webSearch ? "Careerjet" : null].filter(Boolean).join(tr(" và ", " and "));

  return (
    <section className="space-y-3 pt-4" aria-labelledby="external-jobs-title" data-testid="external-jobs">
      <div className="space-y-1 border-t border-white/[0.06] pt-4">
        <h2 id="external-jobs-title" className="flex items-center gap-2 text-base font-black text-white">
          <Globe className="h-4 w-4 text-slate-400" />
          {tr("Việc làm nail từ các trang tuyển dụng khác", "More nail jobs from around the web")}
        </h2>
        <p className="text-xs leading-relaxed text-slate-400">
          {tr(`Tin lấy từ ${sources}, không phải tin đăng trên PawNail. PawNail không đại diện các nơi tuyển này — bấm để xem và ứng tuyển trên trang gốc.`, `Collected from ${sources}, not posted on PawNail. PawNail doesn't represent these employers — open the original listing to view and apply.`)}
        </p>
      </div>

      {data.enabled && (items.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((j) => <ExternalJobCard key={j.id} job={j} />)}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-5 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">{tr("Chưa có tin phù hợp lúc này.", "No matching jobs right now.")}</p>
      ))}
      {data.enabled && items.length < data.total && (
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
            <p className="text-center text-sm text-slate-400">{tr("Chưa có tin phù hợp lúc này.", "No matching jobs right now.")}</p>
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
