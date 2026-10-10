"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, ArrowRight, Flame, Sparkles, Heart, BarChart3 } from "lucide-react";
import { TOTAL_DEMAND_COUNT, DEMAND_SIGNAL } from "@/lib/nailRadarData";
import { timeAgo } from "@/lib/feedFormat";
import Avatar from "@/components/ui/Avatar";
import { tr } from "@/lib/i18n/tr";
import { useSessionUser } from "@/lib/SessionUserContext";

type Kind = "job" | "tech" | "post" | "survey";

interface FomoMessage {
  kind: Kind;
  title: string;
  text: string;
  chip?: string;
  href?: string;
  at?: string; // ISO — sự kiện thật thì hiện "x phút trước"
  actor?: { id: string; name: string; avatarUrl: string | null };
  m?: "US" | "AU"; // số khảo sát chỉ của 1 thị trường
}

// Số liệu tổng hợp THẬT từ 1 đợt khảo sát cộng đồng (lib/nailRadarData.ts).
// Ghi rõ NGUỒN + THỜI ĐIỂM — đây là số của 1 đợt khảo sát, không phải số
// "ngay lúc này"; nói quá là quảng cáo gây hiểu lầm.
// Hàm (không phải hằng) để chữ đổi theo VI/EN lúc tạo hàng đợi.
// market: chỉ hiện số của đúng thị trường người dùng (thợ Texas không cần số của Úc).
const SURVEY_MESSAGES = (market?: string | null): FomoMessage[] => {
  const SURVEY = tr("khảo sát nhóm nail Facebook, 9/2026", "Facebook nail-group survey, Sep 2026");
  const title = tr("Nhịp thị trường", "Market pulse");
  const all: FomoMessage[] = [
  { kind: "survey", title, text: tr(`${TOTAL_DEMAND_COUNT.US + TOTAL_DEMAND_COUNT.AU}+ tin chủ tìm thợ nail tại Mỹ & Úc trong 1 đợt ${SURVEY} — thợ đang là bên được săn đón`, `${TOTAL_DEMAND_COUNT.US + TOTAL_DEMAND_COUNT.AU}+ salon posts seeking nail techs in the US & Australia in one ${SURVEY} — techs are in demand`) },
  { kind: "survey", m: "US", title, text: tr(`Texas dẫn đầu nhu cầu với ${DEMAND_SIGNAL.US?.TX?.demandCount ?? 0} tin tìm thợ, nhiều nhất là thợ Bột/Acrylic (${SURVEY})`, `Texas leads demand with ${DEMAND_SIGNAL.US?.TX?.demandCount ?? 0} hiring posts, mostly for acrylic techs (${SURVEY})`) },
  { kind: "survey", m: "AU", title, text: tr(`Úc: ${(DEMAND_SIGNAL.AU?.NSW?.demandCount ?? 0) + (DEMAND_SIGNAL.AU?.VIC?.demandCount ?? 0)} tin tìm thợ tại NSW & Victoria (${SURVEY})`, `Australia: ${(DEMAND_SIGNAL.AU?.NSW?.demandCount ?? 0) + (DEMAND_SIGNAL.AU?.VIC?.demandCount ?? 0)} hiring posts in NSW & Victoria (${SURVEY})`) },
  ];
  return all.filter((x) => !x.m || !market || x.m === market);
};

// Trước đây xen kẽ "sự kiện" BỊA (tên người, số tiền, "3 phút trước" không
// hề xảy ra) — social proof giả. Giờ CHỈ có hoạt động thật từ /api/activity
// + số liệu khảo sát có ghi nguồn.

const KIND_STYLE: Record<Kind, { icon: typeof Flame; tile: string; label: string; bar: string }> = {
  job: { icon: Flame, tile: "from-orange-500 to-red-500", label: "text-orange-300", bar: "from-orange-500 to-red-500" },
  tech: { icon: Sparkles, tile: "from-pink-500 to-fuchsia-600", label: "text-pink-300", bar: "from-pink-500 to-fuchsia-500" },
  post: { icon: Heart, tile: "from-rose-500 to-pink-500", label: "text-rose-300", bar: "from-rose-500 to-pink-500" },
  survey: { icon: BarChart3, tile: "from-emerald-500 to-teal-500", label: "text-emerald-300", bar: "from-emerald-500 to-teal-400" },
};

// Nhịp hiển thị: lần đầu sau vài giây, sau đó thưa dần; mỗi phiên tối đa vài
// lần — thông báo dày quá là phiền, người dùng sẽ ghét chứ không "FOMO".
const FIRST_DELAY_MS = 9_000;
const MIN_GAP_MS = 28_000;
const MAX_GAP_MS = 48_000;
const VISIBLE_MS = 6_500;
const MAX_PER_SESSION = 6;
const SNOOZE_MS = 3 * 60_000;
const SESSION_KEY = "pn_fomo_session"; // { shown, closes }

// Không chen ngang lúc người dùng đang làm việc quan trọng.
const QUIET_ROUTES = [/^\/auth/, /^\/messages/, /^\/jobs\/create/, /^\/profile$/, /^\/admin/];

function readSession(): { shown: number; closes: number } {
  try {
    return { shown: 0, closes: 0, ...JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}") };
  } catch {
    return { shown: 0, closes: 0 };
  }
}
function writeSession(v: { shown: number; closes: number }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(v));
  } catch {}
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FomoToast() {
  const pathname = usePathname();
  const router = useRouter();
  const [current, setCurrent] = useState<FomoMessage | null>(null);
  const [showKey, setShowKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const queueRef = useRef<FomoMessage[]>([]);
  const { user } = useSessionUser();
  const market = (user?.market as string | undefined) ?? null;
  const marketRef = useRef(market);
  marketRef.current = market; // phiên đăng nhập có thể tải xong SAU khi hàng đợi đã dựng
  const poolRef = useRef<FomoMessage[]>(SURVEY_MESSAGES(null));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<((delay: number) => void) | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(VISIBLE_MS);
  const shownAtRef = useRef(0);
  const touchX = useRef<number | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const quiet = QUIET_ROUTES.some((r) => r.test(pathname || ""));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity")
      .then((r) => (r.ok ? r.json() : []))
      .then((events: FomoMessage[]) => {
        if (cancelled || !Array.isArray(events)) return;
        // Sự kiện thật là chính; số khảo sát chỉ xen vào cho đỡ lặp.
        poolRef.current = [...events.filter((e) => e && e.text), ...SURVEY_MESSAGES(null)];
        queueRef.current = [];
      })
      .catch(() => {});

    const nextMessage = (): FomoMessage | null => {
      const mk = marketRef.current;
      if (queueRef.current.length === 0) queueRef.current = shuffle(poolRef.current.filter((x) => !x.m || !mk || x.m === mk));
      return queueRef.current.shift() ?? null;
    };

    const schedule = (delay: number) => {
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const sess = readSession();
        if (sess.shown >= MAX_PER_SESSION || sess.closes >= 2) return; // đủ rồi, thôi làm phiền
        const busy =
          document.visibilityState !== "visible" ||
          QUIET_ROUTES.some((r) => r.test(pathRef.current || "")) ||
          !!document.querySelector("[data-call-phase], [role=dialog]") ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
        if (busy) {
          schedule(10_000);
          return;
        }
        const msg = nextMessage();
        if (!msg) return;
        writeSession({ ...sess, shown: sess.shown + 1 });
        remainingRef.current = VISIBLE_MS;
        setDragX(0);
        setPaused(false);
        setCurrent(msg);
        setShowKey((k) => k + 1);
      }, delay);
    };

    // Lên lịch lần kế khi toast hiện tại đóng (xem dismiss()).
    scheduleRef.current = schedule;
    schedule(FIRST_DELAY_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  const dismiss = (byUser: boolean) => {
    if (hideRef.current) clearTimeout(hideRef.current);
    setCurrent(null);
    const sess = readSession();
    if (byUser) writeSession({ ...sess, closes: sess.closes + 1 });
    const gap = byUser ? SNOOZE_MS : MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    scheduleRef.current?.(gap);
  };

  // Tự ẩn sau VISIBLE_MS; tạm dừng khi rê chuột / chạm giữ.
  useEffect(() => {
    if (!current) return;
    if (paused) {
      if (hideRef.current) clearTimeout(hideRef.current);
      remainingRef.current -= Date.now() - shownAtRef.current;
      return;
    }
    shownAtRef.current = Date.now();
    hideRef.current = setTimeout(() => dismiss(false), Math.max(800, remainingRef.current));
    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, paused, showKey]);

  if (!current || quiet) return null;
  const st = KIND_STYLE[current.kind] ?? KIND_STYLE.survey;
  const Icon = st.icon;

  const open = () => {
    if (!current.href) return;
    dismiss(false);
    router.push(current.href);
  };

  return (
    <div
      aria-live="polite"
      // Mobile: nằm ngay trên thanh điều hướng nổi · Desktop: góc dưới trái.
      className="pointer-events-none fixed inset-x-3 bottom-[calc(max(10px,env(safe-area-inset-bottom))+84px)] z-40 sm:inset-x-auto sm:left-5 sm:w-[370px] md:bottom-6"
    >
      <div
        key={showKey}
        role="status"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchMove={(e) => touchX.current !== null && setDragX(e.touches[0].clientX - touchX.current)}
        onTouchEnd={() => {
          touchX.current = null;
          if (Math.abs(dragX) > 80) dismiss(true);
          else {
            setDragX(0);
            setPaused(false);
          }
        }}
        className="fomo-in pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, opacity: dragX ? Math.max(0.2, 1 - Math.abs(dragX) / 200) : undefined, transition: dragX ? "none" : "transform 0.2s, opacity 0.2s" }}
      >
        {/* Viền sáng theo loại sự kiện */}
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${st.bar}`} />

        <div
          onClick={open}
          className={`flex items-start gap-3 py-3 pl-4 pr-9 ${current.href ? "cursor-pointer" : ""}`}
        >
          <span className="relative flex-shrink-0">
            {current.actor ? (
              <Avatar src={current.actor.avatarUrl} name={current.actor.name} seed={current.actor.id} className="h-10 w-10 ring-1 ring-white/10" />
            ) : (
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${st.tile}`}>
                <Icon className="h-5 w-5 text-white" />
              </span>
            )}
            {current.actor && (
              <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-slate-950 ${st.tile}`}>
                <Icon className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-black uppercase tracking-wider ${st.label}`}>
              {current.title}
              {current.at && <span className="font-semibold normal-case tracking-normal text-slate-500"> · {timeAgo(current.at)}</span>}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-200">{current.text}</p>
            {(current.chip || current.href) && (
              <div className="mt-2 flex items-center gap-2">
                {current.chip && (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/25">{current.chip}</span>
                )}
                {current.href && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-pink-300">
                    Xem <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => dismiss(true)}
          aria-label="Ẩn thông báo"
          className="absolute right-1.5 top-1.5 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Thanh đếm ngược — dừng khi rê chuột/chạm giữ */}
        <span
          aria-hidden
          className={`absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r ${st.bar} opacity-70`}
          style={{ animation: `fomoCountdown ${VISIBLE_MS}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
        />
      </div>
    </div>
  );
}
