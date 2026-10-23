"use client";

// Trang "Tôi" của KHÁCH đi làm nail — gọn: thông tin liên hệ + khu vực (để gợi ý tiệm gần), lối tắt
// mẫu đã lưu / tiệm / tin nhắn, đăng xuất, xoá tài khoản (bắt buộc theo App Store / Google Play).
import React, { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bookmark, LogOut, MessageCircle, Store, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Avatar from "@/components/ui/Avatar";
import { stateName, US_ALL_CODES, AU_ALL_CODES } from "@/lib/stateNames";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

interface P { id: string; name: string; avatarUrl: string | null; market: "US" | "AU"; state: string | null; city: string | null; phone: string | null }

export default function ClientAccount({ profile }: { profile: P }) {
  useTr();
  const [name, setName] = useState(profile.name || "");
  const [state, setState] = useState(profile.state || "");
  const [city, setCity] = useState(profile.city || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);
  const states = profile.market === "AU" ? AU_ALL_CODES : US_ALL_CODES;
  const field = "w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-slate-100 placeholder-slate-500";

  const save = async () => {
    if (!name.trim()) return toast.error(tr("Tên không được để trống.", "Name can't be empty."));
    setBusy(true);
    try {
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), state, city: city.trim(), phone: phone.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error);
      toast.success(tr("Đã lưu.", "Saved."));
      window.dispatchEvent(new Event("profile-updated"));
    } catch (e) {
      toast.error((e as Error).message || tr("Không lưu được.", "Couldn't save."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(tr("Xoá tài khoản vĩnh viễn? Mẫu đã lưu và tin nhắn của bạn sẽ mất.", "Delete your account permanently? Saved looks and your messages will be lost."))) return;
    const res = await fetch("/api/profile", { method: "DELETE" });
    if (!res.ok) return toast.error(tr("Không xoá được, thử lại.", "Couldn't delete, try again."));
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <section className="flex items-center gap-4 rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
        <Avatar src={profile.avatarUrl} name={profile.name} seed={profile.id} className="h-16 w-16" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">{profile.name}</p>
          <p className="text-sm text-slate-400">{tr("Khách PawNail", "PawNail client")}{profile.state ? ` · ${stateName(profile.market, profile.state)}` : ""}</p>
        </div>
      </section>

      <nav className="grid grid-cols-3 gap-2.5">
        {[
          { href: "/designs?saved=1", icon: Bookmark, label: tr("Mẫu đã lưu", "Saved looks") },
          { href: "/salons", icon: Store, label: tr("Tìm tiệm", "Find salons") },
          { href: "/messages", icon: MessageCircle, label: tr("Tin nhắn", "Messages") },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.04] text-sm font-bold text-slate-100 ring-1 ring-white/10"><Icon className="h-5 w-5 text-pink-300" />{label}</Link>
        ))}
      </nav>

      <section className="space-y-3 rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
        <h2 className="text-sm font-black text-white">{tr("Thông tin của bạn", "Your details")}</h2>
        <input aria-label={tr("Tên", "Name")} value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input aria-label={tr("Thành phố", "City")} value={city} onChange={(e) => setCity(e.target.value)} placeholder={tr("Thành phố", "City")} className={field} />
          <select aria-label={tr("Bang", "State")} value={state} onChange={(e) => setState(e.target.value)} className={field}>
            <option value="">{tr("— Bang —", "— State —")}</option>
            {states.map((s) => <option key={s} value={s}>{stateName(profile.market, s)}</option>)}
          </select>
        </div>
        <input aria-label={tr("Số điện thoại", "Phone")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tr("Số điện thoại (để tiệm xác nhận lịch)", "Phone (for booking confirmations)")} className={field} />
        <p className="text-[11px] text-slate-500">{tr("Khu vực giúp PawNail gợi ý tiệm gần bạn. Số điện thoại không hiện công khai.", "Your area helps us suggest nearby salons. Your phone is never shown publicly.")}</p>
        <button type="button" onClick={save} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Lưu", "Save")}</button>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white/[0.04] text-sm font-bold text-slate-200 ring-1 ring-white/10"><LogOut className="h-4 w-4" />{tr("Đăng xuất", "Log out")}</button>
        <button type="button" onClick={remove} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-sm font-bold text-red-300 ring-1 ring-red-500/25"><Trash2 className="h-4 w-4" />{tr("Xoá tài khoản", "Delete account")}</button>
      </div>
    </div>
  );
}
