"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSessionUser } from "@/lib/SessionUserContext";
import { Capacitor } from "@capacitor/core";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { tr } from "@/lib/i18n/tr";

// "CÀI APP" — mời cài PawNail lên màn hình chính, mở nhanh như app thật + nhận báo việc mới.
//   Android/Chrome: dùng beforeinstallprompt (1 chạm cài).
//   iPhone Safari: hướng dẫn Chia sẻ → Thêm vào MH chính (Apple không cho nút cài).
//   Trình duyệt trong Zalo/Facebook/Instagram: nhắc mở bằng Safari/Chrome trước.
// Chỉ hiện trên điện thoại, khi người dùng đã quay lại (≥ 2 ngày) hoặc đã đăng nhập,
// sau 15 giây; "Để sau" = im 14 ngày; đã cài / đang trong app thì không bao giờ hiện.
const KEY = "pn_install";
const SNOOZE_MS = 14 * 86_400_000;
const QUIET = [/^\/auth/, /^\/messages/, /^\/admin/, /^\/jobs\/create/, /^\/calls?/];

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Mode = "android" | "ios" | "inapp";

interface InstallState { days?: string[]; snoozeUntil?: number; installed?: boolean }
function readState(): InstallState {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
function writeState(s: InstallState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const { user } = useSessionUser();
  const loggedIn = !!user;
  const [mode, setMode] = useState<Mode | null>(null);
  const [open, setOpen] = useState(false);
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || Capacitor.isNativePlatform()) return;
    const ua = navigator.userAgent;
    const phone = /Android|iPhone|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
    if (!phone) return;

    // Ghi nhận ngày ghé thăm (giữ 10 ngày gần nhất)
    const s = readState();
    const today = new Date().toISOString().slice(0, 10);
    const days = Array.isArray(s.days) ? s.days : [];
    if (!days.includes(today)) writeState({ ...s, days: [...days, today].slice(-10) });
    if (s.installed || (s.snoozeUntil && s.snoozeUntil > Date.now())) return;

    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    const inApp = /FBAN|FBAV|Instagram|Zalo|Line\/|TikTok/i.test(ua);
    // Đặt chế độ sau 1 nhịp (không setState đồng bộ trong effect)
    const initial: Mode | null = inApp ? "inapp" : ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua) ? "ios" : null;
    const t0 = initial ? setTimeout(() => setMode((m) => m ?? initial), 0) : undefined;

    // Sự kiện cài được script đầu trang (app/layout.tsx) bắt sẵn vào window.__pnBIP — kể cả khi bắn trước lúc React chạy.
    const w = window as unknown as { __pnBIP?: BIPEvent };
    const onBIP = () => { if (w.__pnBIP) { setEvt(w.__pnBIP); setMode("android"); } };
    const t1 = setTimeout(onBIP, 0);
    const onInstalled = () => { writeState({ ...readState(), installed: true }); setOpen(false); };
    window.addEventListener("pn-bip", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => { clearTimeout(t0); clearTimeout(t1); window.removeEventListener("pn-bip", onBIP); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const quiet = QUIET.some((r) => r.test(pathname || ""));
  useEffect(() => {
    if (!mode || quiet || open) return;
    const returning = (readState().days?.length ?? 0) >= 2;
    if (!returning && !loggedIn) return;
    const t = setTimeout(() => {
      if (document.querySelector("[data-call-phase], [role=dialog]")) return;
      setOpen(true);
    }, 15_000);
    return () => clearTimeout(t);
  }, [mode, quiet, open, loggedIn]);

  if (!open || !mode || quiet) return null;

  const close = () => { writeState({ ...readState(), snoozeUntil: Date.now() + SNOOZE_MS }); setOpen(false); };
  const install = async () => {
    if (!evt) return;
    await evt.prompt().catch(() => {});
    const r = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (r.outcome === "accepted") writeState({ ...readState(), installed: true });
    else writeState({ ...readState(), snoozeUntil: Date.now() + SNOOZE_MS });
    setEvt(null);
    (window as unknown as { __pnBIP?: BIPEvent }).__pnBIP = undefined; // hộp cài chỉ dùng được 1 lần
    setOpen(false);
  };

  return (
    <div data-install-banner className="fixed inset-x-3 bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-40 md:hidden">
      <div className="fomo-in relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <button type="button" onClick={close} aria-label={tr("Đóng", "Close")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-96.webp" alt="" className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-white/10" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{tr("Cài PawNail lên điện thoại", "Install PawNail on your phone")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              {mode === "inapp"
                ? tr("Bạn đang mở trong Zalo/Facebook. Bấm ⋯ → \"Mở bằng trình duyệt\" để cài app và nhận báo việc mới.", "You're inside Zalo/Facebook. Tap ⋯ → \"Open in browser\" to install and get job alerts.")
                : tr("Mở nhanh 1 chạm như app thật, nhận báo ngay khi có việc / thợ mới. Miễn phí, không tốn dung lượng.", "One-tap like a real app, instant alerts for new jobs / techs. Free, takes no space.")}
            </p>
          </div>
        </div>
        {mode === "android" && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={close} className="min-h-[44px] flex-1 rounded-xl bg-white/5 text-sm font-semibold text-slate-300 ring-1 ring-white/10">{tr("Để sau", "Later")}</button>
            <button type="button" onClick={install} className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-bold text-white">
              <Download className="h-4 w-4" />{tr(" Cài app", " Install")}
            </button>
          </div>
        )}
        {mode === "ios" && (
          <ol className="mt-3 space-y-1.5 rounded-xl bg-white/[0.03] p-3 text-xs text-slate-300 ring-1 ring-white/10">
            <li className="flex items-center gap-2"><span className="font-bold text-pink-300">1.</span>{tr("Bấm nút Chia sẻ", "Tap Share")} <Share className="h-4 w-4 text-sky-300" /> {tr("ở thanh dưới Safari", "in Safari's bottom bar")}</li>
            <li className="flex items-center gap-2"><span className="font-bold text-pink-300">2.</span>{tr("Chọn", "Choose")} <PlusSquare className="h-4 w-4 text-slate-200" /> <b className="text-white">{tr("Thêm vào MH chính", "Add to Home Screen")}</b></li>
            <li className="flex items-center gap-2"><span className="font-bold text-pink-300">3.</span>{tr("Mở PawNail từ màn hình chính", "Open PawNail from your home screen")}</li>
          </ol>
        )}
      </div>
    </div>
  );
}
