"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Bookmark } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { DesignCard, DesignSheet, occasionLabel, type Design } from "@/components/designs/DesignViews";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import CommunityDesigns, { loadCommunityFirst, type CommunityFirstPage } from "@/components/designs/CommunityDesigns";
import { useSessionUser } from "@/lib/SessionUserContext";
import { useViewerMarket } from "@/lib/useViewerMarket";
import MenuShowcase, { loadMenuShowcase, type MenuShowcaseItem } from "@/components/designs/MenuShowcase";
import { FIRST_PAINT_CARDS, occasionChips, withPinned } from "@/lib/designsOrder";
import type { DesignsFirstPaint } from "@/lib/designsFirstPaint";

const SKILLS = ["Bột/Acrylic", "Dip/SNS", "Gel-X", "Design", "Chân tay nước"];
const PAGE = 48;
// Chip of an occasion only one market has: hidden before paint for the other market (html[data-mkt] is set by the
// SEASON_BOOT head script, same market order as useViewerMarket) until the viewer's own list replaces these chips.
// A page-local rule (not a Tailwind class): the shared stylesheet every page loads stays the same size.
const ONLY_IN_CSS = "html[data-mkt=AU] [data-only-mkt=US],html[data-mkt=US] [data-only-mkt=AU]{display:none}";

// /designs — "Mẫu nail mới": mẫu mới mỗi ngày theo dịp lễ & xu hướng, kèm vật tư cần chuẩn bị và các bước làm. Chỉ hiện
// mẫu admin ĐÃ DUYỆT.
//
// HTML tĩnh có sẵn (app/[lang]/designs/page.tsx, ISR — `initial`, lib/designsFirstPaint.ts): tiêu đề, ảnh thật + menu
// có giá, hàng chip và HÀNG ĐẦU của lưới (4 mẫu hợp cả Mỹ lẫn Úc) → điện thoại vẽ ảnh mẫu đầu tiên từ HTML, không chờ
// JS + 3 API (LCP ~8 s khi mạng/CPU chậm). Khi danh sách theo thị trường của người xem về: hàng đầu GIỮ chỗ (withPinned),
// phần còn lại nối tiếp phía dưới — không gì đã vẽ bị đẩy (CLS 0). Tiêu đề khách / thợ chồng cùng 1 ô lưới (đổi bằng
// visibility, ô cao bằng bản dài hơn) nên phiên đăng nhập về sau không làm giật.
//
// Không có `initial` (bản build chưa đọc được DB thật, lỗi DB): như trước — 3 nguồn tải sau (ảnh thật của thợ, menu có
// giá, mẫu AI) + phiên đăng nhập được CHỜ ĐỦ rồi hiện cùng 1 lần thay cho lưới khung xương; một API phụ chậm chờ tối đa
// 1,2 s tính từ lúc trang chạy, khối nào về muộn hơn lúc lưới hiện thì nằm SAU lưới (không chen lên trên đẩy lưới xuống).
// Đổi thị trường sau đó: giữ danh sách cũ tới khi danh sách mới về rồi thay tại chỗ (không quay lại khung xương).
export default function DesignsView({ initial }: { initial: DesignsFirstPaint | null }) {
  useTr(); // render lại khi đổi VI/EN
  const { user, loading: sessionLoading } = useSessionUser();
  // Khách (và người chưa đăng nhập): trang cảm hứng làm móng — không phải lời mời thợ "đăng tác phẩm".
  const isPro = user?.role === "TECHNICIAN" || user?.role === "OWNER" || user?.role === "ADMIN";
  // Mẫu hợp với thị trường người xem (Lễ Tạ Ơn chỉ ở Mỹ; mùa theo bán cầu).
  const { market } = useViewerMarket();
  const pinned = useMemo(() => initial?.designs ?? [], [initial]);
  // Danh sách GẮN với thị trường đã tải; đổi thị trường → vẫn hiện danh sách cũ (đang tải lại), không về null.
  const [loaded, setLoaded] = useState<{ market: string; list: Design[] } | null>(null);
  const all = useMemo(() => (loaded ? withPinned(pinned, loaded.list) : initial ? pinned : null), [loaded, pinned, initial]);
  const fresh = loaded?.market === market;
  // Sửa danh sách tại chỗ (tải thêm, lưu mẫu) — chỉ khi danh sách đang hiện đúng thị trường hiện tại.
  const setAll = (fn: (l: Design[]) => Design[]) =>
    setLoaded((cur) => (cur && cur.market === market ? { market, list: fn(cur.list) } : cur));
  // Ảnh thật (cộng đồng) + menu có giá: có sẵn trong HTML (initial) hoặc tải 1 lần cùng lúc với mẫu AI. `below`: về SAU
  // khi trang đã hiện (quá hạn chờ) → đặt sau lưới.
  const [extras, setExtras] = useState<{ community: CommunityFirstPage; menu: MenuShowcaseItem[]; below: boolean } | null>(
    initial ? { community: initial.community, menu: initial.menu, below: false } : null
  );
  const shown = useRef(false);
  useEffect(() => {
    if (initial) return;
    let live = true;
    Promise.all([loadCommunityFirst(), loadMenuShowcase()]).then(([community, menu]) => { if (live) setExtras({ community, menu, below: shown.current }); });
    return () => { live = false; };
  }, [initial]);
  const hasList = all !== null;
  // Hạn chờ tính từ lúc trang chạy (không phải từ lúc mẫu AI về): lưới hiện chậm nhất max(mẫu AI về, 1,2 s).
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (initial) return;
    const t = window.setTimeout(() => setLate(true), 1200);
    return () => window.clearTimeout(t);
  }, [initial]);
  const ready = !!initial || (hasList && ((extras !== null && !sessionLoading) || late));
  // Đánh dấu "đã hiện" ngay khi DOM có nội dung (layout effect: trước mọi callback fetch kế tiếp).
  useLayoutEffect(() => {
    if (ready) shown.current = true;
  }, [ready]);
  const showPro = ready && isPro;
  const [occ, setOcc] = useState<{ market: string; value: string } | null>(null);
  const occasion = occ?.market === market ? occ.value : null;
  const setOccasion = (v: string | null) => setOcc(v ? { market, value: v } : null);
  const [skill, setSkill] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  // /designs?saved=1 (lối tắt "Mẫu đã lưu" của khách) → mở thẳng mục Đã lưu (trang tĩnh: chỉ đọc được URL sau khi hydrate)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { if (new URL(window.location.href).searchParams.get("saved") === "1") setSavedOnly(true); } catch {} }, []);
  const [open, setOpen] = useState<Design | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/designs?limit=${PAGE}&market=${market}`)
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d) => { if (!off) { setLoaded({ market, list: d.designs || [] }); setHasMore(!!d.hasMore); } })
      .catch(() => { if (!off) setLoaded({ market, list: [] }); });
    return () => { off = true; };
  }, [market]);
  // Bộ mẫu lễ có thể cả trăm mẫu → tải thêm từng trang thay vì tải hết một lần.
  const loadMore = () => {
    if (!fresh) return;
    setLoadingMore(true);
    fetch(`/api/designs?limit=${PAGE}&market=${market}&offset=${loaded?.list.length ?? 0}`)
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d) => { setAll((l) => [...l, ...((d.designs || []) as Design[]).filter((x) => !l.some((y) => y.id === x.id))]); setHasMore(!!d.hasMore); })
      .finally(() => setLoadingMore(false));
  };

  // Chip dịp lễ: theo danh sách đã tải; trước đó theo bộ của máy chủ cho CẢ 2 thị trường (chip chỉ 1 thị trường có thì
  // ẩn trước khi vẽ ở thị trường kia) — cùng thứ tự cố định nên khi danh sách về, hàng chip không xê dịch.
  const chips = useMemo((): { id: string; only?: "US" | "AU" }[] => {
    if (loaded || !initial) return occasionChips((all ?? []).map((d) => d.occasion)).map((id) => ({ id }));
    const us = new Set(initial.occasions.US), au = new Set(initial.occasions.AU);
    return occasionChips([...us, ...au]).map((id) => ({ id, only: us.has(id) && au.has(id) ? undefined : us.has(id) ? "US" : "AU" }));
  }, [loaded, initial, all]);
  const list = (all ?? []).filter((d) => (!occasion || d.occasion === occasion) && (!skill || d.skills.includes(skill)) && (!savedOnly || d.saved));
  const chip = (on: boolean) => `min-h-[36px] flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition-colors ${on ? "bg-white text-slate-950 ring-white" : "bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:text-white"}`;
  const update = (id: string, saved: boolean, saves: number) => {
    setAll((l) => l.map((x) => (x.id === id ? { ...x, saved, saves } : x)));
    setOpen((o) => (o && o.id === id ? { ...o, saved, saves } : o));
  };
  // Lưới khung xương: chưa có danh sách nào, hoặc bộ lọc đang chờ danh sách thật (VD ?saved=1 trên hàng dựng sẵn).
  const skeleton = (
    <div key="skeleton" aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />)}
    </div>
  );
  const head = (pro: boolean) => (pro
    ? [tr("Mẫu nail mới", "Fresh nail designs"), tr("Minh hoạ AI kèm vật tư & các bước · không phải ảnh tay nghề thật", "AI illustrations with supplies & steps · not photos of real work")]
    : [tr("Cảm hứng làm móng, cập nhật mỗi ngày", "Nail inspiration, updated daily"), tr("Thử bất kỳ mẫu nào trên tay bạn, rồi đặt lịch với tiệm gần bạn. Lưu mẫu thích để đưa thợ xem.", "Try any look on your hand, then book it with a salon near you. Save the ones you love to show your tech.")]);

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 pb-28 pt-6 md:pb-12">
        <header className="space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-pink-300"><Sparkles className="h-4 w-4" />{tr(" PawNail Studio · cập nhật mỗi ngày", " PawNail Studio · updated daily")}</p>
          {/* Guest + pro headings share one grid cell: the cell is as tall as the longer one, the session only flips
              visibility (the hidden one is not a heading and is aria-hidden) — no shift when a signed-in pro's session
              arrives after the static guest version painted. */}
          <div className="grid">
            {[false, true].map((pro) => {
              const on = pro === showPro;
              const [title, sub] = head(pro);
              const H = on ? "h1" : "p";
              return (
                <div key={String(pro)} className={`space-y-1 ${on ? "" : "invisible"}`} style={{ gridArea: "1 / 1" }} aria-hidden={on ? undefined : true}>
                  <H className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</H>
                  <p className="max-w-2xl text-[13px] leading-5 text-slate-400">{sub}</p>
                </div>
              );
            })}
          </div>
        </header>

        {!ready ? (
          skeleton
        ) : (
          // Fragment (không bọc div): các khối là con trực tiếp của <main> như trước — giữ đúng khoảng cách space-y-5.
          <>
            {extras && !extras.below && (
              <>
                <CommunityDesigns pro={isPro} placement="top" initial={extras.community} />
                <MenuShowcase items={extras.menu} />
              </>
            )}

            <h2 className="flex items-center gap-2 pt-2 text-base font-black text-white"><Sparkles className="h-4 w-4 text-pink-300" />{tr("Ý tưởng mẫu PawNail", "PawNail design ideas")}</h2>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label={tr("Lọc mẫu", "Filter designs")}>
              <button type="button" aria-pressed={!occasion && !skill && !savedOnly} onClick={() => { setOccasion(null); setSkill(null); setSavedOnly(false); }} className={chip(!occasion && !skill && !savedOnly)}>{tr("Tất cả", "All")}</button>
              <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly((v) => !v)} className={chip(savedOnly)}><Bookmark className="mr-1 inline h-3 w-3" />{tr("Đã lưu", "Saved")}</button>
              {chips.some((c) => c.only) && <style>{ONLY_IN_CSS}</style>}
              {chips.map(({ id: o, only }) => <button key={o} type="button" aria-pressed={occasion === o} onClick={() => setOccasion(occasion === o ? null : o)} className={chip(occasion === o)} data-only-mkt={only}>{occasionLabel(o)}</button>)}
              {SKILLS.map((s) => <button key={s} type="button" aria-pressed={skill === s} onClick={() => setSkill(skill === s ? null : s)} className={chip(skill === s)}>{valueLabel(s)}</button>)}
            </div>

            {list.length === 0 && !loaded ? (
              skeleton
            ) : list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
                <p className="text-sm font-bold text-slate-300">{all?.length ? tr("Không có mẫu khớp bộ lọc.", "No designs match these filters.") : tr("Mẫu mới đang được chuẩn bị.", "New designs are on the way.")}</p>
                <p className="mt-1 text-xs text-slate-500">{all?.length ? tr("Thử bỏ bớt bộ lọc.", "Try removing a filter.") : tr("Hãy quay lại vào ngày mai.", "Check back tomorrow.")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((d, i) => <DesignCard key={d.id} d={d} eager={i < FIRST_PAINT_CARDS} onOpen={() => setOpen(d)} />)}
              </div>
            )}
            {hasMore && fresh && (
              <div className="flex justify-center pt-2">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-[44px] rounded-2xl bg-white/[0.06] px-6 text-sm font-bold text-white ring-1 ring-white/10 disabled:opacity-50">
                  {loadingMore ? tr("Đang tải…", "Loading…") : tr("Xem thêm mẫu", "Show more designs")}
                </button>
              </div>
            )}
            {extras?.below && (
              <>
                <CommunityDesigns pro={isPro} placement="top" initial={extras.community} />
                <MenuShowcase items={extras.menu} />
              </>
            )}
            {/* Below the grid: only once the full list is in (with a server-rendered first row, anything painted under
                it would be pushed down when the rest of the grid arrives). */}
            {extras && (loaded || !initial) && <CommunityDesigns pro={isPro} placement="bottom" initial={extras.community} />}
          </>
        )}
      </main>
      {open && <DesignSheet d={open} onClose={() => setOpen(null)} onSaved={(s, n) => update(open.id, s, n)} />}
    </div>
  );
}
