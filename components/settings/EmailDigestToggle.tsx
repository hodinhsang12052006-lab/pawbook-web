"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";

// Bật/tắt email tóm tắt hằng tuần — lưu ngay, không cần bấm Lưu hồ sơ.
export default function EmailDigestToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/email/prefs").then((r) => (r.ok ? r.json() : null)).then((j) => setOn(j ? !!j.emailDigest : true)).catch(() => setOn(true));
  }, []);
  const toggle = async () => {
    if (on === null) return;
    const next = !on;
    setOn(next);
    const r = await fetch("/api/email/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailDigest: next }) }).catch(() => null);
    if (!r?.ok) { setOn(!next); toast.error(tr("Không lưu được, thử lại nhé", "Couldn't save, try again")); return; }
    toast.success(next ? tr("Đã bật email tóm tắt", "Weekly digest on") : tr("Đã tắt email tóm tắt", "Weekly digest off"));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      data-testid="email-digest-toggle"
      onClick={toggle}
      disabled={on === null}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-950/50 px-3.5 py-3 text-left ring-1 ring-white/10 transition-colors hover:ring-white/20 disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-200">{tr("Email tóm tắt mỗi tuần", "Weekly email digest")}</span>
        <span className="block text-xs text-slate-400">{tr("Việc mới, thợ rảnh, lượt xem hồ sơ — chỉ gửi khi có điều mới.", "New jobs, available techs, profile views — only when there's something new.")}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-pink-600" : "bg-slate-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
