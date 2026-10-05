"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Camera, CheckCircle2, MessageCircle, Megaphone, Store, X, Rocket, ChevronRight } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { playSound } from "@/lib/sounds";

interface Step { key: string; done: boolean }
const HIDE_KEY = "pn_onboarding_hide";
const CELEBRATED_KEY = "pn_onboarding_done";

// Nhãn + nơi đến của từng bước (đếm "đã xong" do /api/onboarding tính từ dữ liệu thật).
function meta(key: string): { title: string; hint: string; href: string; icon: typeof BellRing } {
  switch (key) {
    case "job_alert":
      return { title: tr("Bật báo việc gần bạn", "Turn on job alerts"), hint: tr("Có tin khớp là điện thoại báo ngay", "Get pinged when a matching job is posted"), href: "/?tab=jobs", icon: BellRing };
    case "portfolio":
      return { title: tr("Thêm 3 ảnh mẫu móng", "Add 3 work photos"), hint: tr("Hồ sơ có ảnh được tiệm nhắn nhiều hơn hẳn", "Profiles with photos get far more messages"), href: "/profile", icon: Camera };
    case "message_salon":
      return { title: tr("Nhắn tiệm đầu tiên", "Message your first salon"), hint: tr("Bấm “Nhắn tin” trên 1 tin bạn thích", "Tap “Message” on a job you like"), href: "/?tab=jobs", icon: MessageCircle };
    case "post_job":
      return { title: tr("Đăng tin tuyển thợ", "Post a job"), hint: tr("Tin có ảnh tiệm được thợ bấm xem nhiều hơn", "Jobs with salon photos get more views"), href: "/jobs/create", icon: Megaphone };
    case "message_tech":
      return { title: tr("Nhắn thợ đầu tiên", "Message your first tech"), hint: tr("Xem portfolio thợ đang rảnh và nhắn ngay", "Browse available techs and message one"), href: "/?tab=portfolio", icon: MessageCircle };
    default:
      return { title: tr("Hoàn thiện hồ sơ tiệm", "Complete your salon profile"), hint: tr("Logo + chính sách chia turn để thợ tin tưởng", "Logo + commission policy so techs trust you"), href: "/profile", icon: Store };
  }
}

/** "3 bước đầu tiên" cho người mới (14 ngày đầu) — tự ẩn khi xong hoặc khi bấm ✕. */
export default function GettingStarted({ compact = false }: { compact?: boolean }) {
  useTr(); // render lại khi đổi VI/EN
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(HIDE_KEY)) return;
    } catch {}
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.newUser || !d.steps?.length) return;
        const all = d.steps.every((s: Step) => s.done);
        if (all) {
          // Xong hết → chúc mừng 1 lần rồi thôi hiện.
          try {
            if (!localStorage.getItem(CELEBRATED_KEY)) {
              localStorage.setItem(CELEBRATED_KEY, "1");
              setSteps(d.steps);
              setHidden(false);
              playSound("success");
            }
          } catch {}
          return;
        }
        setSteps(d.steps);
        setHidden(false);
      })
      .catch(() => {});
  }, []);

  if (hidden || !steps) return null;
  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {}
  };

  // Bản 1 dòng cho tab Việc gấp / Thợ rảnh — không đẩy tin xuống dưới màn hình.
  if (compact) {
    if (allDone) return null;
    const next = steps.find((s) => !s.done)!;
    const m = meta(next.key);
    return (
      <Link href={m.href} aria-label={tr("Bắt đầu với PawNail", "Get started with PawNail")} className="flex items-center gap-2.5 rounded-2xl border border-pink-500/25 bg-pink-500/[0.08] px-3.5 py-2.5 text-sm transition-colors hover:bg-pink-500/[0.14]">
        <Rocket className="h-4 w-4 flex-shrink-0 text-pink-300" />
        <span className="min-w-0 flex-1 truncate font-semibold text-white">{tr("Bước tiếp theo: ", "Next step: ")}{m.title}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-pink-200">{done}/{steps.length}</span>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
      </Link>
    );
  }

  return (
    <section aria-label={tr("Bắt đầu với PawNail", "Get started with PawNail")} className="relative rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/[0.10] via-fuchsia-500/[0.05] to-slate-900/40 p-4">
      <button type="button" onClick={dismiss} aria-label={tr("Ẩn hướng dẫn bắt đầu", "Hide getting started")} className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 pr-8">
        <Rocket className="h-5 w-5 text-pink-300" />
        <p className="text-sm font-black text-white">{allDone ? tr("Tuyệt vời! Bạn đã sẵn sàng 🎉", "You're all set! 🎉") : tr("Bắt đầu với PawNail", "Get started with PawNail")}</p>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-pink-200">{done}/{steps.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all duration-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {allDone ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-300">{tr("3 việc đầu tiên đã xong — hồ sơ của bạn giờ nổi bật hơn hầu hết người mới. Chúc bạn sớm có kết quả!", "First 3 steps done — your profile now stands out from most newcomers. Good luck!")}</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {steps.map((s) => {
            const m = meta(s.key);
            const Icon = s.done ? CheckCircle2 : m.icon;
            return (
              <li key={s.key}>
                <Link
                  href={m.href}
                  aria-disabled={s.done}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors ${s.done ? "bg-emerald-500/[0.06] ring-emerald-500/20" : "bg-slate-950/50 ring-white/5 hover:ring-pink-400/40"}`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${s.done ? "text-emerald-400" : "text-pink-300"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold ${s.done ? "text-slate-400 line-through" : "text-white"}`}>{m.title}</span>
                    {!s.done && <span className="block truncate text-[11px] text-slate-400">{m.hint}</span>}
                  </span>
                  {!s.done && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
