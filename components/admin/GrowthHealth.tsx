"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Store, Download, Gift, Mail, MessageCircle, Palette, Users } from "lucide-react";

interface Growth {
  users: { total: number; techs: number; owners: number; new7: number };
  active7: { senders: number; messages: number; posts: number; jobs: number };
  email: { digestOn: number; unsubscribed: number; processed7: number };
  referral: { invited: number; invited7: number };
  install: { installed: number };
  demo: { users: number; jobs: number; posts: number };
  designs: { drafts: number; published: number; noImage: number };
  ingest?: { active: number; pendingRequests: number };
}

// "Sức khoẻ tăng trưởng" — số THẬT (đã loại tài khoản mẫu), để biết tính năng nào giữ chân người dùng.
export default function GrowthHealth() {
  const [g, setG] = useState<Growth | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/api/admin/growth").then((r) => (r.ok ? r.json() : Promise.reject())).then(setG).catch(() => setErr(true));
  }, []);
  if (err) return null;
  if (!g) return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03] ring-1 ring-white/10" />;

  const tiles = [
    { icon: Users, label: "Người dùng thật", value: g.users.total, sub: `${g.users.owners} chủ tiệm · ${g.users.techs} thợ · +${g.users.new7} tuần này` },
    { icon: MessageCircle, label: "Hoạt động 7 ngày", value: g.active7.senders, sub: `người nhắn tin · ${g.active7.messages} tin · ${g.active7.posts} bài · ${g.active7.jobs} tin tuyển` },
    { icon: Mail, label: "Email tuần", value: g.email.processed7, sub: `đã xét gửi 7 ngày · ${g.email.digestOn} đang bật · ${g.email.unsubscribed} đã hủy` },
    { icon: Gift, label: "Mời bạn bè", value: g.referral.invited, sub: `người tham gia nhờ link mời · +${g.referral.invited7} tuần này` },
    { icon: Download, label: "Đã cài app", value: g.install.installed, sub: "mở PawNail từ màn hình chính" },
    { icon: Palette, label: "Mẫu nail", value: g.designs.published, sub: `đã đăng · ${g.designs.drafts} chờ duyệt · ${g.designs.noImage} chưa có ảnh` },
    ...(g.ingest ? [{ icon: Store, label: "Tin đăng hộ tiệm", value: g.ingest.active, sub: `đang hiện · ${g.ingest.pendingRequests} yêu cầu nhận/gỡ chờ xử lý` }] : []),
  ];
  return (
    <section className="glass-card space-y-3 rounded-2xl p-4" data-testid="growth-health">
      <h2 className="flex items-center gap-2 text-sm font-black text-white"><Activity className="h-4 w-4 text-pink-300" /> Sức khoẻ tăng trưởng</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"><t.icon className="h-3.5 w-3.5" />{t.label}</p>
            <p className="mt-1 text-2xl font-black text-white">{t.value.toLocaleString("en-US")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{t.sub}</p>
          </div>
        ))}
      </div>
      {g.demo.users > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400 ring-1 ring-white/10">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          Dữ liệu nhập sẵn (email đuôi pawnailjobs.demo, không tính vào số người dùng ở trên): {g.demo.users} tài khoản, {g.demo.jobs} tin tuyển, {g.demo.posts} bài đăng.
        </p>
      )}
      {g.designs.published === 0 && g.designs.drafts > 0 && (
        <p className="rounded-xl bg-sky-500/10 p-3 text-xs text-sky-200 ring-1 ring-sky-500/25">Chưa có mẫu nail nào được đăng — trang /designs đang trống với người dùng. Duyệt ở mục Mẫu nail bên dưới.</p>
      )}
    </section>
  );
}
