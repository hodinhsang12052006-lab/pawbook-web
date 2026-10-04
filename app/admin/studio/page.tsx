"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Radar, Send, Copy, Trash2, Loader2, Activity, Flame, DollarSign, Hash, AlertTriangle, Store, Newspaper, ExternalLink, PenSquare, RefreshCw,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Flag from "@/components/ui/Flag";
import { timeAgo } from "@/lib/feedFormat";
import type { Signals } from "@/lib/trendSignals";
import type { Draft } from "@/lib/contentDrafts";
import type { NewsItem } from "@/lib/industryFeed";

interface StudioPost { id: string; kind: string; title: string; body: string; href: string | null; market: string | null; createdAt: string }
interface Payload { signals: Signals; news: NewsItem[]; drafts: Draft[]; posts: StudioPost[] }

const KIND: Record<string, { label: string; icon: typeof Flame; cls: string }> = {
  pulse: { label: "Nhịp đau", icon: Activity, cls: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  gap: { label: "Thiếu thợ", icon: Flame, cls: "bg-orange-500/15 text-orange-300 ring-orange-500/30" },
  salary: { label: "Lương", icon: DollarSign, cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  hashtag: { label: "Hashtag", icon: Hash, cls: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30" },
  pain: { label: "Nỗi đau", icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  news: { label: "Tin ngành", icon: Newspaper, cls: "bg-slate-400/15 text-slate-200 ring-slate-400/30" },
  custom: { label: "Tự viết", icon: PenSquare, cls: "bg-pink-500/15 text-pink-300 ring-pink-500/30" },
};
const NEWS_TOPIC: Record<string, string> = { law: "Luật & giấy phép", labor: "Lao động & lương", safety: "An toàn & sức khoẻ", business: "Kinh doanh tiệm", trend: "Xu hướng mẫu", other: "Khác" };

function Badge({ kind }: { kind: string }) {
  const k = KIND[kind] ?? KIND.custom;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${k.cls}`}>
      <k.icon className="h-3 w-3" /> {k.label}
    </span>
  );
}

function Panel({ title, icon: Icon, children, hint }: { title: string; icon: typeof Flame; children: React.ReactNode; hint?: string }) {
  return (
    <section className="glass-card min-w-0 space-y-3 rounded-2xl p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-black text-white"><Icon className="h-4 w-4 text-pink-300" /> {title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">{text}</p>;
const topicKey = (t: string) => t.replace(/[\d.,]+%?/g, "#").trim();

export default function StudioRoomPage() {
  const [market, setMarket] = useState<"US" | "AU">("US");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newsTopic, setNewsTopic] = useState<string>("all");
  const [custom, setCustom] = useState({ title: "", body: "", href: "" });

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/studio?market=${market}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "Không tải được.");
      return;
    }
    setData(d);
  }, [market]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // So theo CHỦ ĐỀ (bỏ phần số): số liệu cập nhật liên tục làm tiêu đề đổi
  // vài con số — vẫn là bài đã đăng, tránh admin đăng trùng.
  const postedTitles = useMemo(() => new Set((data?.posts ?? []).map((p) => topicKey(p.title))), [data?.posts]);

  const publish = async (d: { id?: string; kind: string; title: string; body: string; href?: string | null }) => {
    setBusy(d.id ?? "custom");
    const res = await fetch("/api/admin/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: d.kind, title: d.title, body: d.body, href: d.href || null, market }),
    });
    const r = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(r.error || "Không đăng được.");
    toast.success("Đã đăng lên bảng tin");
    load();
    return true;
  };
  const unpublish = async (id: string) => {
    setBusy(id);
    await fetch("/api/admin/studio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(null);
    toast.success("Đã gỡ bài");
    load();
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã sao chép caption");
    } catch {
      toast.error("Trình duyệt chặn sao chép — hãy bôi đen và copy thủ công.");
    }
  };

  const s = data?.signals;
  const news = (data?.news ?? []).filter((n) => newsTopic === "all" || n.topic === newsTopic);

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 pb-28 pt-6 sm:px-6 md:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/admin/leads" className="text-xs font-semibold text-slate-400 hover:text-slate-200">← Lead Radar</Link>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-white"><Radar className="h-6 w-6 text-pink-400" /> Phòng nội dung</h1>
            <p className="text-xs text-slate-500">Radar xu hướng & nỗi đau ngành nail — tín hiệu thật → bài nháp → duyệt & đăng.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-950/60 p-1 ring-1 ring-white/10" role="group" aria-label="Thị trường">
              {(["US", "AU"] as const).map((m) => (
                <button key={m} onClick={() => setMarket(m)} aria-pressed={market === m} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${market === m ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white" : "text-slate-400"}`}>
                  <Flag code={m} className="h-3 w-4" /> {m === "US" ? "Mỹ" : "Úc"}
                </button>
              ))}
            </div>
            <button onClick={() => { setData(null); load(); }} aria-label="Tải lại" className="rounded-xl p-2 text-slate-400 ring-1 ring-white/10 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>

        {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {!data && !error && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}</div>}

        {data && s && (
          <>
            {/* ===== BÀI NHÁP ===== */}
            <Panel title={`Bài nháp sẵn sàng (${data.drafts.length})`} icon={Send} hint="Tự soạn từ tín hiệu bên dưới. Kiểm tra số liệu ở dòng 'Nguồn' trước khi đăng.">
              {data.drafts.length === 0 ? (
                <Empty text="Chưa đủ tín hiệu để soạn bài — cần thêm dữ liệu (phiếu Nhịp đau, tin tuyển, đánh giá)." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.drafts.map((d) => {
                    const posted = postedTitles.has(topicKey(d.title));
                    return (
                      <article key={d.id} className="flex min-w-0 flex-col gap-2 rounded-xl bg-slate-950/50 p-3.5 ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-2"><Badge kind={d.kind} /><span className="truncate text-[10px] text-slate-500">Nguồn: {d.evidence}</span></div>
                        <h3 className="text-sm font-black leading-snug text-white">{d.title}</h3>
                        <p className="text-xs leading-relaxed text-slate-300">{d.body}</p>
                        <p className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-slate-400"><b className="text-slate-300">Caption MXH:</b> {d.caption}</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          <button disabled={posted || busy === d.id} onClick={() => publish(d)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                            {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {posted ? "Đã đăng" : "Đăng lên bảng tin"}
                          </button>
                          <button onClick={() => copy(d.caption)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/5"><Copy className="h-3.5 w-3.5" /> Sao chép caption</button>
                          {d.href && /^https:/.test(d.href) && <a href={d.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-slate-400 hover:text-white">Bài gốc <ExternalLink className="h-3 w-3" /></a>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* ===== TÍN HIỆU ===== */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Panel title="Nhịp đau tuần" icon={Activity} hint="Phiếu bấm-1-lần của thợ & chủ tiệm">
                {s.pulse.length === 0 ? <Empty text="Chưa có phiếu nào tuần này." /> : s.pulse.map((p) => (
                  <div key={p.questionId + p.week} className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-200">{p.topic} <span className="font-normal text-slate-500">· tuần {p.week.split("-W")[1]} · {p.total} phiếu{p.published ? "" : " (chưa đủ mẫu công bố)"}</span></p>
                    {[...p.options].sort((a, b) => b.votes - a.votes).filter((o) => o.votes).slice(0, 4).map((o) => (
                      <div key={o.id} className="flex items-center gap-2 text-[11px]"><span className="w-28 truncate text-slate-400">{o.label}</span><span className="h-1.5 flex-1 rounded-full bg-white/5"><span className="block h-full rounded-full bg-sky-400" style={{ width: `${o.pct}%` }} /></span><span className="w-8 text-right tabular-nums text-slate-300">{o.pct}%</span></div>
                    ))}
                  </div>
                ))}
              </Panel>
              <Panel title="Kỹ năng thiếu thợ" icon={Flame} hint="Tin tuyển 14 ngày ↔ thợ đang rảnh, theo bang">
                {s.skillGaps.length === 0 ? <Empty text="Chưa thấy chênh lệch cung–cầu đáng kể." /> : s.skillGaps.map((g) => (
                  <div key={g.state + g.skill} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-200"><b>{g.skill}</b> · {g.label}</span><span className="flex-shrink-0 tabular-nums text-orange-300">{g.jobs} tin / {g.techs} thợ</span></div>
                ))}
              </Panel>
              <Panel title="Lương tuần biến động" icon={DollarSign} hint="Trung vị 30 ngày ↔ 30 ngày trước (≥3 tin mỗi kỳ)">
                {s.salaryMoves.length === 0 ? <Empty text="Chưa đủ tin có lương tuần để so sánh." /> : s.salaryMoves.map((m) => (
                  <div key={m.state} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-200">{m.label}</span><span className={`tabular-nums ${m.changePct > 0 ? "text-emerald-300" : "text-red-300"}`}>{m.changePct > 0 ? "▲" : "▼"} {Math.abs(m.changePct)}% · ${m.before.toLocaleString("en-US")} → ${m.now.toLocaleString("en-US")}</span></div>
                ))}
              </Panel>
              <Panel title="Hashtag tăng tốc" icon={Hash} hint="7 ngày này ↔ 7 ngày trước">
                {s.risingTags.length === 0 ? <Empty text="Chưa có hashtag nào tăng rõ." /> : s.risingTags.map((t) => (
                  <div key={t.tag} className="flex items-center justify-between text-xs"><span className="font-bold text-fuchsia-300">#{t.tag}</span><span className="tabular-nums text-slate-300">{t.before} → {t.now} bài</span></div>
                ))}
              </Panel>
              <Panel title="Nỗi đau trong đánh giá" icon={AlertTriangle} hint="Tiêu chí điểm thấp (≤3.8★, ≥3 lượt), 90 ngày">
                {s.reviewPains.length === 0 ? <Empty text="Không tiêu chí nào bị chấm thấp — tốt!" /> : s.reviewPains.map((r) => (
                  <div key={r.criterion} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-200">{r.criterion}</span><span className="tabular-nums text-amber-300">{r.avg}★ · {r.count} lượt</span></div>
                ))}
              </Panel>
              <Panel title="Nỗi đau chủ tiệm" icon={Store} hint="Khảo sát 5 câu lúc đăng ký">
                {s.ownerPains.length === 0 ? <Empty text="Chưa có dữ liệu khảo sát." /> : s.ownerPains.map((p) => (
                  <div key={p.tag} className="flex items-center gap-2 text-[11px]"><span className="w-36 truncate text-slate-300">{p.label}</span><span className="h-1.5 flex-1 rounded-full bg-white/5"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${p.pct}%` }} /></span><span className="w-14 text-right tabular-nums text-slate-300">{p.pct}% ({p.count})</span></div>
                ))}
              </Panel>
            </div>

            {/* ===== TIN NGÀNH ===== */}
            <Panel title={`Tin ngành (${data.news.length})`} icon={Newspaper} hint="Google News (Anh/Việt) + NAILS Magazine — chỉ tiêu đề & link, cập nhật mỗi 3 giờ">
              <div className="flex flex-wrap gap-1.5">
                {["all", "law", "labor", "safety", "business", "trend", "other"].map((t) => (
                  <button key={t} onClick={() => setNewsTopic(t)} aria-pressed={newsTopic === t} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${newsTopic === t ? "bg-pink-600 text-white ring-pink-600" : "text-slate-400 ring-white/10"}`}>
                    {t === "all" ? "Tất cả" : NEWS_TOPIC[t]}
                  </button>
                ))}
              </div>
              {news.length === 0 ? <Empty text="Không có tin trong mục này." /> : (
                <div className="divide-y divide-white/5">
                  {news.slice(0, 25).map((n) => (
                    <div key={n.link} className="flex items-start gap-3 py-2.5">
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-slate-100 hover:text-white">{n.title}</span>
                        <span className="text-[11px] text-slate-500">{NEWS_TOPIC[n.topic]} · {n.source}{n.publishedAt ? ` · ${timeAgo(n.publishedAt)}` : ""} · {n.lang === "vi" ? "Tiếng Việt" : "English"}</span>
                      </a>
                      <button
                        onClick={() => publish({ kind: "news", title: `📰 ${NEWS_TOPIC[n.topic]}: ${n.title}`.slice(0, 200), body: `Nguồn: ${n.source}. Bấm để đọc bài gốc — bạn nghĩ sao về tin này?`, href: n.link })}
                        className="flex-shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-pink-300 ring-1 ring-pink-500/30 hover:bg-pink-500/10"
                      >
                        Đăng
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ===== TỰ VIẾT ===== */}
            <Panel title="Tự viết bài" icon={PenSquare}>
              <form
                className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await publish({ kind: "custom", ...custom })) setCustom({ title: "", body: "", href: "" });
                }}
              >
                <input id="studio-title" aria-label="Tiêu đề" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="Tiêu đề" maxLength={200} className="input-field" />
                <input id="studio-href" aria-label="Link (tuỳ chọn)" value={custom.href} onChange={(e) => setCustom({ ...custom, href: e.target.value })} placeholder="Link: /trends hoặc https://…" className="input-field" />
                <button type="submit" disabled={busy === "custom"} className="rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-bold text-white disabled:opacity-50">Đăng</button>
                <textarea id="studio-body" aria-label="Nội dung" value={custom.body} onChange={(e) => setCustom({ ...custom, body: e.target.value })} placeholder="Nội dung" rows={2} maxLength={1200} className="input-field md:col-span-3" />
              </form>
            </Panel>

            {/* ===== ĐÃ ĐĂNG ===== */}
            <Panel title={`Đã đăng (${data.posts.length})`} icon={Send} hint="Hiện trên bảng tin 14 ngày, tối đa 3 bài mới nhất">
              {data.posts.length === 0 ? <Empty text="Chưa đăng bài nào." /> : data.posts.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-xl bg-slate-950/50 p-3 ring-1 ring-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Badge kind={p.kind} /><span className="text-[11px] text-slate-500">{timeAgo(p.createdAt)}{p.market ? ` · ${p.market}` : ""}</span></div>
                    <p className="mt-1 text-sm font-bold text-slate-100">{p.title}</p>
                  </div>
                  <button onClick={() => unpublish(p.id)} disabled={busy === p.id} aria-label="Gỡ bài" className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
