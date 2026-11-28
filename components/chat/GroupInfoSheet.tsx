"use client";

// Bảng thông tin NHÓM chat: thành viên (đang online / hoạt động lúc nào) · lịch làm việc theo tuần · nút họp nhóm.
// Dùng cho nhóm nội bộ BitPaw và nhóm nhân viên của các tiệm trên PawNail.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Users, Video, X } from "lucide-react";
import { PresenceAvatar, ROLE_VI } from "@/components/chat/chatShared";
import { avatarSrc } from "@/lib/avatar";
import { lastActiveLabel, useIsOnline } from "@/lib/presence";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { apiError } from "@/lib/i18n/apiError";

export interface GroupMemberView { id: string; name: string | null; avatarUrl: string | null; role: string; lastActiveAt?: string | null }
interface Shift { id: string; userId: string; date: string; start: string; end: string; note: string; canDelete: boolean }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayOf = (d: Date) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function MemberRow({ m, me }: { m: GroupMemberView; me: string }) {
  const online = useIsOnline(m.id === me ? null : m.id);
  const status = m.id === me ? tr("Bạn", "You") : online ? tr("Đang hoạt động", "Active now") : lastActiveLabel(m.lastActiveAt) || tr("Chưa hoạt động gần đây", "Not active recently");
  return (
    <li data-group-member={m.id} data-online={online ? "1" : "0"} className="flex items-center gap-3 rounded-xl px-2 py-2">
      <PresenceAvatar userId={m.id} src={avatarSrc(m.avatarUrl, m.name, m.id)} alt={m.name || ""} size="h-10 w-10" watch={m.id !== me} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{m.name || tr("Thành viên", "Member")}</span>
        <span className={`block truncate text-xs ${online ? "font-semibold text-emerald-300" : "text-slate-400"}`}>{status} · {ROLE_VI()[m.role] || tr("Thành viên", "Member")}</span>
      </span>
    </li>
  );
}

function Schedule({ convId, members, me }: { convId: string; members: GroupMemberView[]; me: string }) {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<{ key: string; shifts: Shift[]; pending?: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const key = iso(week);
  const [form, setForm] = useState({ date: iso(new Date()), start: "09:00", end: "17:00", userId: me, note: "" });
  const load = useCallback(async () => {
    const r = await fetch(`/api/groups/${encodeURIComponent(convId)}/shifts?from=${key}&days=7`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setData({ key, shifts: r?.shifts || [], pending: r?.pending });
  }, [convId, key]);
  useEffect(() => {
    let live = true;
    fetch(`/api/groups/${encodeURIComponent(convId)}/shifts?from=${key}&days=7`, { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null)
      .then((r) => { if (live) setData({ key, shifts: r?.shifts || [], pending: r?.pending }); });
    return () => { live = false; };
  }, [convId, key]);
  const loading = data?.key !== key;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || tr("Thành viên", "Member");
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" });
  const today = iso(new Date());

  const add = async () => {
    setBusy(true);
    const r = await fetch(`/api/groups/${encodeURIComponent(convId)}/shifts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return toast.error(apiError(d, "Không thêm được ca.", "Couldn't add the shift."));
    toast.success(tr("Đã thêm ca làm", "Shift added"));
    setAdding(false);
    load();
  };
  const del = async (s: Shift) => {
    const r = await fetch(`/api/groups/${encodeURIComponent(convId)}/shifts?shiftId=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return toast.error(tr("Không xoá được ca.", "Couldn't delete the shift."));
    load();
  };

  return (
    <div className="space-y-3" data-group-schedule>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setWeek((w) => addDays(w, -7))} aria-label={tr("Tuần trước", "Previous week")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-bold text-white">{fmtDay(days[0])} – {fmtDay(days[6])}</p>
        <button type="button" onClick={() => setWeek((w) => addDays(w, 7))} aria-label={tr("Tuần sau", "Next week")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {data?.pending && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{tr("Lịch làm việc đang được bật, thử lại sau ít phút.", "The schedule is being switched on. Try again in a few minutes.")}</p>}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-pink-400" /></div>
      ) : (
        <ul className="space-y-2">
          {days.map((d) => {
            const ds = iso(d);
            const list = (data?.shifts || []).filter((s) => s.date === ds);
            return (
              <li key={ds} data-day={ds} className={`rounded-xl px-3 py-2 ring-1 ${ds === today ? "bg-pink-500/[0.06] ring-pink-500/30" : "bg-white/[0.03] ring-white/10"}`}>
                <p className={`text-xs font-bold ${ds === today ? "text-pink-200" : "text-slate-300"}`}>{fmtDay(d)}{ds === today ? ` · ${tr("Hôm nay", "Today")}` : ""}</p>
                {list.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">{tr("Chưa có ca", "No shifts")}</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {list.map((s) => (
                      <li key={s.id} data-shift={s.id} className="flex items-center gap-2 text-sm">
                        <span className="w-24 shrink-0 font-semibold tabular-nums text-white">{s.start}–{s.end}</span>
                        <span className={`min-w-0 flex-1 truncate ${s.userId === me ? "font-semibold text-pink-200" : "text-slate-200"}`}>{nameOf(s.userId)}{s.note ? <span className="text-slate-400"> · {s.note}</span> : null}</span>
                        {s.canDelete && <button type="button" onClick={() => del(s)} aria-label={tr("Xoá ca", "Delete shift")} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <div className="space-y-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10" data-shift-form>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-xs text-slate-400">{tr("Ngày", "Date")}
              <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field mt-1" data-shift-date>
                {Array.from({ length: 14 }, (_, i) => addDays(mondayOf(new Date()), i)).map((d) => <option key={iso(d)} value={iso(d)}>{fmtDay(d)}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">{tr("Bắt đầu", "Start")}<input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="input-field mt-1" data-shift-start /></label>
            <label className="text-xs text-slate-400">{tr("Kết thúc", "End")}<input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="input-field mt-1" data-shift-end /></label>
            <label className="col-span-2 text-xs text-slate-400">{tr("Người làm", "Who")}
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field mt-1" data-shift-user>
                {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? `${m.name || ""} (${tr("bạn", "you")})` : m.name}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-xs text-slate-400">{tr("Ghi chú", "Note")}<input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={tr("VD: trực tin nhắn khách, họp sale…", "e.g. customer chat duty, sales meeting…")} className="input-field mt-1" data-shift-note /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="h-10 flex-1 rounded-xl text-sm font-bold text-slate-300 ring-1 ring-white/10">{tr("Huỷ", "Cancel")}</button>
            <button type="button" disabled={busy} onClick={add} data-shift-save className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 text-sm font-bold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Lưu ca", "Save shift")}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} data-shift-add className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-pink-200 ring-1 ring-pink-500/30 hover:bg-pink-500/10"><Plus className="h-4 w-4" /> {tr("Thêm ca làm", "Add a shift")}</button>
      )}
    </div>
  );
}

export default function GroupInfoSheet({ convId, name, avatarUrl, members, me, meetingCount, onMeet, onClose }: {
  convId: string; name: string; avatarUrl?: string | null; members: GroupMemberView[]; me: string; meetingCount: number; onMeet: () => void; onClose: () => void;
}) {
  useTr();
  const [tab, setTab] = useState<"members" | "schedule">("members");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const sorted = useMemo(() => [...members].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : (a.name || "").localeCompare(b.name || ""))), [members, me]);
  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/60" onClick={onClose}>
      <aside role="dialog" aria-label={tr(`Thông tin nhóm ${name}`, `${name} group info`)} data-group-info onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-[#15101a] shadow-2xl ring-1 ring-white/10">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-fuchsia-300" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-white">{name}</span>
            <span className="block text-xs text-slate-400">{tr(`${members.length} thành viên`, `${members.length} members`)}</span>
          </span>
          <button type="button" onClick={onClose} aria-label={tr("Đóng", "Close")} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
        </header>
        <div className="px-4 pt-3">
          <button type="button" onClick={onMeet} data-group-meet className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 font-bold text-white hover:bg-pn-brand-hover">
            <Video className="h-5 w-5" /> {meetingCount > 0 ? tr(`Tham gia cuộc họp (${meetingCount} người)`, `Join meeting (${meetingCount})`) : tr("Bắt đầu họp nhóm", "Start a group meeting")}
          </button>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "members"} onClick={() => setTab("members")} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${tab === "members" ? "bg-white/10 text-white" : "text-slate-400"}`}><Users className="h-4 w-4" /> {tr("Thành viên", "Members")}</button>
            <button type="button" role="tab" aria-selected={tab === "schedule"} onClick={() => setTab("schedule")} data-tab-schedule className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${tab === "schedule" ? "bg-white/10 text-white" : "text-slate-400"}`}><CalendarDays className="h-4 w-4" /> {tr("Lịch làm việc", "Schedule")}</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "members" ? (
            <ul className="space-y-1">{sorted.map((m) => <MemberRow key={m.id} m={m} me={me} />)}</ul>
          ) : (
            <Schedule convId={convId} members={sorted} me={me} />
          )}
        </div>
      </aside>
    </div>
  );
}
