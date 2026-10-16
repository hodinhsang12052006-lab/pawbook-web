"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, CalendarCheck, Clock, Eye, EyeOff, Images, Link2, Loader2, MessageCircle, Pencil, Plus, QrCode, ScanLine, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useSessionUser } from "@/lib/SessionUserContext";
import { cdnImage } from "@/lib/cdnImage";
import { CATEGORY_LABEL, MENU_CATEGORIES, priceLabel, type MenuCategory, type PublicMenuItem } from "@/lib/menu";
import MenuItemEditor from "./MenuItemEditor";
import QuickMenu from "./QuickMenu";
import BookingForm from "@/components/booking/BookingForm";
import ClientReviews from "@/components/booking/ClientReviews";
import Avatar from "@/components/ui/Avatar";
import { placeLabel } from "@/lib/stateNames";

// Menu mẫu nail của 1 thợ / tiệm: khách xem giá, thời gian, độ bền → bấm "Muốn làm mẫu này" để nhắn kèm
// tên mẫu. Chủ menu: thêm / sửa / ẩn / xếp thứ tự, xem chi phí vật tư + lời từng mẫu.
interface MenuOwner { id: string; name: string | null; avatarUrl: string | null; role: string; market: string | null; city: string | null; state: string | null; salonName: string | null }

const DIFF = () => [tr("Dễ", "Easy"), tr("Vừa", "Medium"), tr("Khó", "Advanced")];

export default function NailMenu({ userId, header = false }: { userId: string; header?: boolean }) {
  useTr();
  const router = useRouter();
  const { user: viewer } = useSessionUser();
  const [items, setItems] = useState<PublicMenuItem[] | null>(null);
  const [owner, setOwner] = useState<MenuOwner | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState<MenuCategory | "ALL">("ALL");
  const [open, setOpen] = useState<PublicMenuItem | null>(null);
  const [editing, setEditing] = useState<PublicMenuItem | "new" | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [quick, setQuick] = useState(false);
  // Đặt lịch (khách không cần tài khoản): null = đóng, {item: null} = hỏi lịch chung
  const [booking, setBooking] = useState<{ item: PublicMenuItem | null } | null>(null);
  // Số ảnh thật (portfolio / bài khoe) chưa có trong menu → nút "Tạo nhanh từ ảnh"
  const [photoCount, setPhotoCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/menu?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setItems(d.items);
      setOwner(d.owner);
      setIsOwner(Boolean(d.isOwner));
    } catch (e) {
      setErr((e as Error).message || tr("Không tải được menu.", "Couldn't load the menu."));
    }
  }, [userId]);
  // viewer?.id: đăng nhập xong (session nạp sau) thì tải lại để thấy chế độ chủ menu.
  useEffect(() => { load(); }, [load, viewer?.id]);
  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/menu/photos", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => setPhotoCount(d?.photos?.length ?? 0)).catch(() => {});
  }, [isOwner, items?.length]);
  // ?quick=1 (thẻ nhắc trên trang chủ) → mở luôn "Tạo nhanh từ ảnh" — chỉ 1 lần, không mở lại sau khi lưu
  const quickOpened = useRef(false);
  useEffect(() => {
    if (!isOwner || quickOpened.current) return;
    quickOpened.current = true;
    try { if (new URLSearchParams(window.location.search).get("quick") === "1") setQuick(true); } catch {}
  }, [isOwner]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items ?? []) c[it.category] = (c[it.category] ?? 0) + 1;
    return c;
  }, [items]);
  const groups = useMemo(
    () => MENU_CATEGORIES.filter((c) => (cat === "ALL" || cat === c) && counts[c]).map((c) => ({ c, list: (items ?? []).filter((i) => i.category === c) })),
    [items, cat, counts],
  );
  const knownMaterials = useMemo(() => Array.from(new Set((items ?? []).flatMap((i) => (i.materials ?? []).map((m) => m.name)))), [items]);

  const menuUrl = typeof window !== "undefined" ? `${window.location.origin}/menu/${userId}` : `/menu/${userId}`;

  const want = (it: PublicMenuItem) => {
    if (!owner) return;
    const text = tr(`Chào ${owner.name ?? "bạn"}, mình muốn làm mẫu "${it.name}" (${priceLabel(it.priceFrom, it.priceTo)}). Bạn còn lịch trống khi nào?`,
      `Hi ${owner.name ?? "there"}, I'd like the "${it.name}" design (${priceLabel(it.priceFrom, it.priceTo)}). When are you available?`);
    try { sessionStorage.setItem("pn_chat_draft", JSON.stringify({ to: owner.id, text })); } catch {}
    const dest = `/messages?to=${owner.id}`;
    router.push(viewer?.id ? dest : `/auth/login?callbackUrl=${encodeURIComponent(dest)}`);
  };

  const toggleActive = async (it: PublicMenuItem) => {
    const res = await fetch(`/api/menu/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !it.active }) });
    if (!res.ok) return toast.error(tr("Không đổi được, thử lại.", "Couldn't update, try again."));
    const d = await res.json();
    setItems((p) => (p ?? []).map((x) => (x.id === it.id ? d.item : x)));
  };

  // Xếp lại trong cùng nhóm: đổi chỗ với mẫu liền kề cùng nhóm, rồi lưu toàn bộ thứ tự.
  const move = async (it: PublicMenuItem, dir: -1 | 1) => {
    if (!items) return;
    const same = items.filter((x) => x.category === it.category);
    const k = same.findIndex((x) => x.id === it.id);
    const other = same[k + dir];
    if (!other) return;
    const next = [...items];
    const a = next.findIndex((x) => x.id === it.id);
    const b = next.findIndex((x) => x.id === other.id);
    [next[a], next[b]] = [next[b], next[a]];
    setItems(next);
    const res = await fetch("/api/menu/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((x) => x.id) }) });
    if (!res.ok) { toast.error(tr("Không lưu được thứ tự.", "Couldn't save order.")); load(); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(menuUrl); toast.success(tr("Đã chép link menu", "Menu link copied")); } catch { toast.error(menuUrl); }
  };

  if (err) return <p className="rounded-2xl bg-white/[0.03] p-6 text-center text-sm text-slate-400 ring-1 ring-white/10">{err}</p>;
  if (!items || !owner) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>;

  const visibleCount = items.filter((i) => i.active).length;

  return (
    <section aria-label={tr("Menu mẫu nail", "Nail menu")} className="space-y-4">
      {/* Trang /menu/[uid] (quét QR ở quầy): thẻ thợ / tiệm ở đầu */}
      {header && (
        <Link href={`/profile/${owner.id}`} className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-4 ring-1 ring-white/10 hover:ring-white/20">
          <Avatar src={owner.avatarUrl} name={owner.name} seed={owner.id} className="h-14 w-14 flex-shrink-0" alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black text-white">{owner.salonName || owner.name || "PawNail"}</p>
            <p className="truncate text-xs text-slate-400">
              {owner.salonName && owner.name ? `${owner.name} · ` : ""}
              {owner.role === "OWNER" ? tr("Tiệm nail", "Nail salon") : tr("Thợ nail", "Nail tech")}
              {owner.city || owner.state ? ` · ${placeLabel(owner.city, owner.market === "AU" ? "AU" : "US", owner.state)}` : ""}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs font-bold text-pink-300">{tr("Hồ sơ", "Profile")} →</span>
        </Link>
      )}
      {/* Đầu menu */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-black text-white"><BookOpen className="h-4 w-4 text-amber-300" />{tr("Menu mẫu nail", "Nail menu")}</h2>
          <p className="text-xs text-slate-400">
            {isOwner
              ? tr(`${items.length} mẫu · ${visibleCount} đang hiện cho khách`, `${items.length} designs · ${visibleCount} visible to clients`)
              : tr(`${items.length} mẫu · giá tham khảo, chốt khi xem tay`, `${items.length} designs · guide prices, final after consultation`)}
          </p>
        </div>
        {!isOwner && items.length > 0 && (
          <button type="button" onClick={() => setBooking({ item: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-pink-600/20"><CalendarCheck className="h-3.5 w-3.5" />{tr("Đặt lịch", "Book")}</button>
        )}
        {items.length > 0 && (
          <>
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Link2 className="h-3.5 w-3.5" />{tr("Link", "Link")}</button>
            <button type="button" onClick={() => setShowQr(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><QrCode className="h-3.5 w-3.5" />QR</button>
          </>
        )}
        {isOwner && (
          <Link href="/consult" className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><ScanLine className="h-3.5 w-3.5 text-rose-300" />{tr("Soi tay khách", "Hand consult")}</Link>
        )}
        {isOwner && photoCount > 0 && items.length > 0 && (
          <button type="button" onClick={() => setQuick(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"><Images className="h-3.5 w-3.5 text-amber-300" />{tr("Tạo nhanh từ ảnh", "Quick add from photos")}</button>
        )}
        {isOwner && (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-pink-600/20"><Plus className="h-3.5 w-3.5" />{tr("Thêm mẫu", "Add design")}</button>
        )}
      </div>

      <ClientReviews techId={owner.id} />

      {/* Lọc nhóm */}
      {Object.keys(counts).length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {(["ALL", ...MENU_CATEGORIES.filter((c) => counts[c])] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${cat === c ? "bg-white text-slate-900" : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}>
              {c === "ALL" ? tr("Tất cả", "All") : tr(CATEGORY_LABEL[c][0], CATEGORY_LABEL[c][1])}
              <span className="ml-1 opacity-60">{c === "ALL" ? items.length : counts[c]}</span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        isOwner ? (
          <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-pink-500/5 to-transparent p-6 ring-1 ring-amber-400/20">
            <h3 className="text-base font-black text-white">{tr("Tạo menu mẫu của riêng bạn", "Build your own design menu")}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              {tr("Khách xem trước mẫu, giá, thời gian làm — bấm 1 nút là nhắn bạn đặt lịch. Bạn ghi vật tư để biết mỗi mẫu lời bao nhiêu (khách không thấy phần này).",
                "Clients preview designs, prices and timing — one tap to message you. Log materials to see your margin per design (clients never see this).")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {photoCount > 0 && (
                <button type="button" onClick={() => setQuick(true)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900"><Images className="h-4 w-4" />{tr(`Tạo nhanh từ ${photoCount} ảnh của bạn`, `Quick start from your ${photoCount} photos`)}</button>
              )}
              <button type="button" onClick={() => setEditing("new")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${photoCount > 0 ? "bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/10" : "bg-white text-slate-900"}`}><Plus className="h-4 w-4" />{tr("Thêm mẫu đầu tiên", "Add your first design")}</button>
              <Link href="/designs" className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><Sparkles className="h-4 w-4 text-pink-300" />{tr("Lấy nhanh từ kho mẫu", "Pick from the design library")}</Link>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-white/[0.03] p-8 text-center text-sm text-slate-400 ring-1 ring-white/10">{tr("Chưa có mẫu nào trong menu.", "No designs in this menu yet.")}</p>
        )
      ) : (
        groups.map(({ c, list }) => (
          <div key={c} className="space-y-2.5">
            {cat === "ALL" && <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">{tr(CATEGORY_LABEL[c][0], CATEGORY_LABEL[c][1])}</h3>}
            {c === "ADDON" ? (
              // Dịch vụ thêm: dạng bảng giá gọn (không cần ảnh)
              <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
                {list.map((it, idx) => (
                  <li key={it.id} className={`flex items-center gap-2 px-3.5 py-2.5 ${it.active ? "" : "opacity-55"}`}>
                    <button type="button" onClick={() => setOpen(it)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left" aria-label={it.name}>
                      <span className="truncate text-sm font-semibold text-slate-100">{it.name}</span>
                      {!it.active && <span className="flex-shrink-0 text-[10px] font-bold text-slate-400">{tr("Đang ẩn", "Hidden")}</span>}
                      <span className="min-w-[1rem] flex-1 translate-y-[-3px] border-b border-dotted border-white/15" />
                      <span className="flex-shrink-0 text-sm font-black text-emerald-300">{priceLabel(it.priceFrom, it.priceTo)}</span>
                    </button>
                    {isOwner && (
                      <span className="flex flex-shrink-0 items-center">
                        <IconBtn label={tr("Sửa", "Edit")} onClick={() => setEditing(it)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn label={it.active ? tr("Ẩn khỏi menu", "Hide") : tr("Hiện lại", "Show")} onClick={() => toggleActive(it)}>{it.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</IconBtn>
                        <IconBtn label={tr("Lên", "Move up")} disabled={idx === 0} onClick={() => move(it, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn label={tr("Xuống", "Move down")} disabled={idx === list.length - 1} onClick={() => move(it, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((it, idx) => (
                <article key={it.id} className={`group overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10 transition-colors hover:ring-white/20 ${it.active ? "" : "opacity-55"}`}>
                  <button type="button" onClick={() => setOpen(it)} className="block w-full text-left" aria-label={it.name}>
                    <div className="relative aspect-square bg-slate-900">
                      {it.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cdnImage(it.images[0], 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-pink-500/20 via-fuchsia-500/10 to-amber-400/5 px-3 text-center">
                          <Sparkles className="h-6 w-6 text-pink-200/70" />
                          {it.technique && <span className="text-xs font-black uppercase tracking-wider text-pink-100/80">{it.technique}</span>}
                          {isOwner && <span className="text-[10px] font-semibold text-slate-400">{tr("Thêm ảnh thật để khách tin hơn", "Add a real photo to win trust")}</span>}
                        </div>
                      )}
                      {!it.active && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-slate-200">{tr("Đang ẩn", "Hidden")}</span>}
                      {it.images.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">1/{it.images.length}</span>}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white">{it.name}</p>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-black text-emerald-300">{priceLabel(it.priceFrom, it.priceTo)}</span>
                        {it.minutes && <span className="flex items-center gap-0.5 text-[11px] text-slate-400"><Clock className="h-3 w-3" />{it.minutes}′</span>}
                      </div>
                      {isOwner && it.materialCost !== null && (
                        <p className="text-[11px] text-slate-400">{tr("Vật tư", "Materials")} ${it.materialCost.toFixed(2)} · <span className="text-emerald-300/90">{tr("lời", "margin")} ~${Math.max(0, Math.round(it.priceFrom - it.materialCost))}</span></p>
                      )}
                    </div>
                  </button>
                  {isOwner && (
                    <div className="flex items-center border-t border-white/5 px-1.5 py-1">
                      <IconBtn label={tr("Sửa", "Edit")} onClick={() => setEditing(it)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label={it.active ? tr("Ẩn khỏi menu", "Hide") : tr("Hiện lại", "Show")} onClick={() => toggleActive(it)}>{it.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</IconBtn>
                      <span className="flex-1" />
                      <IconBtn label={tr("Lên", "Move up")} disabled={idx === 0} onClick={() => move(it, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label={tr("Xuống", "Move down")} disabled={idx === list.length - 1} onClick={() => move(it, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  )}
                </article>
              ))}
            </div>
            )}
          </div>
        ))
      )}

      {isOwner && items.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          {tr("Mẹo: in mã QR dán ở quầy để khách quét xem menu. ", "Tip: print the QR code at your station so clients can scan your menu. ")}
          <Link href="/designs" className="font-bold text-pink-300 hover:underline">{tr("Thêm từ kho mẫu PawNail", "Add from the PawNail library")}</Link>
        </p>
      )}

      {open && <MenuItemSheet it={open} isOwner={isOwner} ownerName={owner.name} canChat={!!viewer?.id} onClose={() => setOpen(null)} onWant={() => want(open)} onBook={() => { setBooking({ item: open }); setOpen(null); }} onEdit={() => { setEditing(open); setOpen(null); }} />}
      {booking && (
        <BookingForm
          techId={owner.id}
          techName={owner.salonName || owner.name || "PawNail"}
          item={booking.item ? { id: booking.item.id, name: booking.item.name, price: priceLabel(booking.item.priceFrom, booking.item.priceTo) } : null}
          onClose={() => setBooking(null)}
        />
      )}
      {editing && (
        <MenuItemEditor
          item={editing === "new" ? null : editing}
          knownMaterials={knownMaterials}
          onClose={() => setEditing(null)}
          onSaved={(saved) => { setItems((p) => (p ?? []).some((x) => x.id === saved.id) ? (p ?? []).map((x) => (x.id === saved.id ? saved : x)) : [...(p ?? []), saved]); setEditing(null); }}
          onDeleted={(id) => { setItems((p) => (p ?? []).filter((x) => x.id !== id)); setEditing(null); }}
        />
      )}
      {quick && (
        <QuickMenu
          onClose={() => setQuick(false)}
          onDone={(added) => { setItems((p) => [...(p ?? []), ...added]); setQuick(false); setPhotoCount((n) => Math.max(0, n - added.length)); }}
        />
      )}
      {showQr && <MenuQr url={menuUrl} title={owner.salonName || owner.name || "PawNail"} onClose={() => setShowQr(false)} />}
    </section>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}

function MenuItemSheet({ it, isOwner, ownerName, canChat, onClose, onWant, onBook, onEdit }: { it: PublicMenuItem; isOwner: boolean; ownerName: string | null; canChat: boolean; onClose: () => void; onWant: () => void; onBook: () => void; onEdit: () => void }) {
  useTr();
  const [img, setImg] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const chips = [
    it.technique,
    it.minutes ? `⏱ ${it.minutes}${tr(" phút", " min")}` : null,
    it.durabilityWeeks ? tr(`Giữ ${it.durabilityWeeks} tuần`, `Lasts ${it.durabilityWeeks} wk`) : null,
    it.difficulty ? DIFF()[it.difficulty - 1] : null,
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={it.name} onClick={(e) => e.stopPropagation()} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-3xl">
        <div className="relative aspect-square w-full bg-slate-900">
          {it.images[img] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cdnImage(it.images[img], 1024)} alt={it.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-500/15 to-fuchsia-500/5"><Sparkles className="h-10 w-10 text-pink-300/60" /></div>
          )}
          <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><X className="h-5 w-5" /></button>
          {it.images.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {it.images.map((_, i) => (
                <button key={i} type="button" aria-label={tr(`Ảnh ${i + 1}`, `Photo ${i + 1}`)} onClick={() => setImg(i)} className={`h-2 rounded-full transition-all ${i === img ? "w-5 bg-white" : "w-2 bg-white/50"}`} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-1.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-pink-300">{tr(CATEGORY_LABEL[it.category][0], CATEGORY_LABEL[it.category][1])}</p>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black leading-tight text-white">{it.name}</h2>
              <span className="flex-shrink-0 text-xl font-black text-emerald-300">{priceLabel(it.priceFrom, it.priceTo)}</span>
            </div>
            {it.description && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{it.description}</p>}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((c) => <span key={c} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200">{c}</span>)}
              </div>
            )}
          </div>

          {isOwner && it.materials && it.materials.length > 0 && (
            <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/10">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{tr("Vật tư (chỉ bạn thấy)", "Materials (only you see this)")}</p>
              <ul className="space-y-1">
                {it.materials.map((m, i) => (
                  <li key={i} className="flex justify-between gap-2 text-sm text-slate-200"><span>{m.name}{m.qty && <span className="text-slate-500"> · {m.qty}</span>}</span>{m.cost !== null && <span className="text-slate-400">${m.cost.toFixed(2)}</span>}</li>
                ))}
              </ul>
              {it.materialCost !== null && (
                <p className="mt-2 border-t border-white/5 pt-2 text-xs text-slate-300">{tr("Tổng", "Total")} <b className="text-white">${it.materialCost.toFixed(2)}</b> · {tr("lời ước tính", "est. margin")} <b className="text-emerald-300">~${Math.max(0, Math.round(it.priceFrom - it.materialCost))}</b></p>
              )}
            </div>
          )}

          {isOwner ? (
            <button type="button" onClick={onEdit} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/10"><Pencil className="h-4 w-4" />{tr("Sửa mẫu", "Edit design")}</button>
          ) : (
            <>
              <button type="button" onClick={onBook} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-pink-600/20"><CalendarCheck className="h-4 w-4" />{tr("Đặt lịch mẫu này", "Book this design")}</button>
              {canChat && (
                <button type="button" onClick={onWant} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10"><MessageCircle className="h-4 w-4" />{tr("Nhắn tin hỏi thêm", "Message about it")}</button>
              )}
              <p className="text-center text-[11px] text-slate-500">{tr(`Không cần tài khoản — ${ownerName ?? "thợ"} gọi / nhắn bạn để chốt giờ. Giá chốt khi xem tay.`, `No account needed — ${ownerName ?? "the tech"} will call or text you to confirm. Final price after consultation.`)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuQr({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useTr();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    import("qrcode").then((Q) => Q.toDataURL(url, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#1c0b30", light: "#ffffff" } })).then((d) => { if (!off) setSrc(d); }).catch(() => {});
    return () => { off = true; };
  }, [url]);
  const download = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = "pawnail-menu-qr.png";
    a.click();
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={tr("Mã QR menu", "Menu QR code")} onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-[11px] font-black uppercase tracking-wider text-pink-600">{tr("Quét xem menu nail", "Scan for the nail menu")}</p>
        <p className="mt-1 truncate text-lg font-black text-slate-900">{title}</p>
        <div className="mx-auto mt-4 aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={tr("Mã QR menu", "Menu QR code")} className="h-full w-full" /> : <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        </div>
        <p className="mt-3 break-all text-[11px] text-slate-500">{url.replace(/^https?:\/\//, "")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700">{tr("Đóng", "Close")}</button>
          <button type="button" onClick={download} disabled={!src} className="rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-50">{tr("Tải ảnh", "Download")}</button>
        </div>
      </div>
    </div>
  );
}
