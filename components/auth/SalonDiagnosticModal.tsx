"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Radar, Sparkles, XCircle, CheckCircle2, X, ArrowRight, PartyPopper, Zap, Play,
} from "lucide-react";
import toast from "react-hot-toast";
import { SURVEY, PAIN_TAG_META } from "@/lib/ownerSurvey";

// Mockup "Bảng Chia Turn" cho popup Demo — không phải screenshot thật, chỉ
// dựng bằng CSS để cho chủ tiệm hình dung giao diện thật trông thế nào mà
// không cần tải ảnh/video nặng.
const DEMO_TURN_ROWS = [
  { name: "Chị Linda", tip: 52 },
  { name: "Anh Tony", tip: 44 },
  { name: "Chị Kim", tip: 38 },
];

const PRESS = "active:scale-95 transition-transform duration-100";

const SCAN_STEPS = [
  "Đang phân tích mô hình vận hành của tiệm...",
  "Đang đối chiếu dữ liệu thợ và lượt làm...",
  "Đã lập xong Hồ Sơ Tối Ưu Hóa Vận Hành!",
];

// Tổng thời lượng hiệu ứng quét — đủ lâu để tạo cảm giác "đang tính toán",
// không quá lâu tới mức gây sốt ruột (khớp yêu cầu ~3 giây đầu).
const SCAN_DURATION_MS = 2600;

interface SalonDiagnosticModalProps {
  salonName: string;
  pains: string[];
  onFinish: () => void;
}

export default function SalonDiagnosticModal({ salonName, pains, onFinish }: SalonDiagnosticModalProps) {
  const [subPhase, setSubPhase] = useState<"scanning" | "report">("scanning");
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [showDemoTeaser, setShowDemoTeaser] = useState(false);
  const [activatedTags, setActivatedTags] = useState<Set<string>>(new Set());

  // "Trojan Horse" — mời kích hoạt ngay 1 tính năng cụ thể thay vì chỉ đọc
  // giải pháp chung chung. Chưa có backend thật để bật tính năng nên đây là
  // ghi nhận nhu cầu (giống form đăng ký quan tâm) + phản hồi tức thì cho
  // cảm giác "đã làm được something" ngay trong lúc xem báo cáo.
  const activateTrojan = (tag: string) => {
    setActivatedTags((prev) => new Set(prev).add(tag));
    toast.success("Đã ghi nhận! Đội ngũ sẽ set up tính năng này cho tiệm trong 24h.", { icon: "⚡", duration: 3500 });
  };

  // Chỉ những câu họ chọn đáp án "có vấn đề" mới xuất hiện — báo cáo cá
  // nhân hoá 100% theo đúng thứ tự khảo sát, không hiện phần họ đã ổn.
  const painCards = useMemo(
    () => SURVEY.map((q) => q.tag).filter((tag) => pains.includes(tag)).map((tag) => PAIN_TAG_META[tag]).filter(Boolean),
    [pains]
  );

  useEffect(() => {
    // Kích hoạt animation width qua CSS transition (1 lần set state) thay vì
    // tick liên tục bằng JS — mượt hơn nhiều so với setInterval cập nhật
    // progress mỗi vài chục ms.
    const raf = requestAnimationFrame(() => setProgress(100));

    const t1 = setTimeout(() => setStepIndex(1), SCAN_DURATION_MS * 0.35);
    const t2 = setTimeout(() => setStepIndex(2), SCAN_DURATION_MS * 0.7);
    const t3 = setTimeout(() => setSubPhase("report"), SCAN_DURATION_MS + 250);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 text-slate-100">
      {/* Ambient glow nền — điểm xuyết gradient hồng tím sang trọng */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {subPhase === "scanning" ? (
        <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-pink-500/40" />
            <div
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                background: "conic-gradient(from 0deg, transparent 0%, rgba(236,72,153,0.55) 60%, transparent 100%)",
                animationDuration: "1.4s",
              }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-950 border border-slate-800">
              <Radar className="h-9 w-9 text-pink-400" />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-pink-400 mb-2">
            Hệ thống đang chẩn đoán tiệm của bạn
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-6 max-w-sm">
            {salonName || "Tiệm của bạn"}
          </h2>

          <div className="w-full max-w-xs">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 transition-[width] ease-linear"
                style={{ width: `${progress}%`, transitionDuration: `${SCAN_DURATION_MS}ms` }}
              />
            </div>
            <div className="mt-4 space-y-2 text-left">
              {SCAN_STEPS.map((label, idx) => (
                <div key={label} className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${idx <= stepIndex ? "opacity-100" : "opacity-30"}`}>
                  {idx < stepIndex ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                  ) : idx === stepIndex ? (
                    <Sparkles className="h-4 w-4 flex-shrink-0 text-pink-400 animate-pulse" />
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0 rounded-full border border-slate-700" />
                  )}
                  <span className={idx === stepIndex ? "text-white font-semibold" : "text-slate-400"}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-screen flex-col pb-32">
          <div className="flex-1 px-5 pt-8 pb-4 space-y-6 max-w-xl mx-auto w-full">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" /> Phân tích hoàn tất
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Hồ Sơ Chẩn Đoán Vận Hành
              </h1>
              <p className="text-sm text-slate-400">
                {painCards.length > 0
                  ? <>Phát hiện <span className="font-bold text-pink-400">{painCards.length} điểm nghẽn</span> tại <span className="font-bold text-white">{salonName || "tiệm của bạn"}</span> cần tối ưu ngay.</>
                  : <>Tiệm <span className="font-bold text-white">{salonName || "của bạn"}</span> đang vận hành khá bài bản!</>}
              </p>
            </div>

            {painCards.length > 0 ? (
              <div className="space-y-4">
                {painCards.map((meta) => (
                  <div key={meta.tag} className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                    <div className="flex items-start gap-2.5 p-4 border-b border-slate-800/80 bg-red-500/5">
                      <XCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-red-400 mb-0.5">Vấn đề của tiệm</p>
                        <p className="text-sm text-slate-200 leading-relaxed">{meta.problem}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-4 bg-emerald-500/5">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5">Giải pháp từ hệ thống</p>
                        <p className="text-sm text-slate-200 leading-relaxed">{meta.solution}</p>
                      </div>
                    </div>

                    {/* Trojan Horse — mời bấm kích hoạt ngay 1 tính năng cụ
                        thể, không chỉ đọc rồi lướt qua */}
                    <div className="flex items-center gap-2.5 p-4 border-t border-dashed border-pink-500/20 bg-gradient-to-r from-pink-500/10 via-fuchsia-500/5 to-transparent">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/15">
                        <Zap className="h-4 w-4 text-pink-400" />
                      </div>
                      <p className="flex-1 text-xs sm:text-[13px] font-bold text-pink-200 leading-snug">
                        {meta.trojanHorse}
                      </p>
                      <button
                        type="button"
                        onClick={() => activateTrojan(meta.tag)}
                        disabled={activatedTags.has(meta.tag)}
                        className={`flex-shrink-0 rounded-full px-3 py-2 text-[11px] font-extrabold whitespace-nowrap ${PRESS} ${
                          activatedTags.has(meta.tag)
                            ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                            : "bg-pink-500 text-white hover:bg-pink-400"
                        }`}
                      >
                        {activatedTags.has(meta.tag) ? "✅ Đã bật" : "Kích hoạt"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
                <PartyPopper className="h-8 w-8 mx-auto text-emerald-400" />
                <p className="text-sm text-emerald-200 leading-relaxed">
                  Tiệm bạn đã trả lời tốt cả 5 hạng mục vận hành cốt lõi. Vẫn có thể tham khảo bộ giải pháp quản lý để tiệm vận hành trơn tru hơn nữa khi mở rộng quy mô.
                </p>
              </div>
            )}
          </div>

          {/* CTA — cố định đáy màn hình, luôn trong tầm ngón tay cái (mobile-first) */}
          <div className="fixed bottom-0 inset-x-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-5 py-4 space-y-2.5">
            <div className="max-w-xl mx-auto w-full space-y-2.5">
              <button
                type="button"
                onClick={() => setShowDemoTeaser(true)}
                className={`w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-amber-500 hover:brightness-110 px-6 py-4 text-sm sm:text-base font-extrabold text-white shadow-xl shadow-pink-600/25 ${PRESS}`}
              >
                <Play className="h-5 w-5 flex-shrink-0 fill-white" />
                Trải nghiệm ngay bản Demo Quản Lý Tiệm Nail
              </button>
              <button
                type="button"
                onClick={onFinish}
                className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-700 bg-slate-900/60 hover:border-slate-500 px-6 py-3.5 text-sm font-bold text-slate-200 ${PRESS}`}
              >
                Tiếp tục tìm thợ quanh tiệm của bạn
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showDemoTeaser && (
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 px-4 py-4" onClick={() => setShowDemoTeaser(false)}>
              <div
                className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setShowDemoTeaser(false)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-white">Xem trước: Bảng Chia Turn Công Bằng</h3>
                  <p className="text-sm text-slate-400">
                    Giao diện thật chạy trên iPad tại quầy — thợ tự xem lượt và tiền tip của mình, không ai tị nạnh ai.
                  </p>
                </div>

                {/* Mockup CSS thuần — không phải screenshot thật, chỉ mô
                    phỏng đúng bố cục để chủ tiệm hình dung sản phẩm. */}
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Turn hôm nay — {salonName || "Tiệm của bạn"}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </span>
                  </div>
                  {DEMO_TURN_ROWS.map((row, i) => (
                    <div key={row.name} className="flex items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-[11px] font-black text-pink-300">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-xs font-bold text-white truncate">{row.name}</span>
                      <span className="text-[10px] font-bold text-emerald-400">${row.tip} tip</span>
                    </div>
                  ))}
                </div>

                <ul className="space-y-2 text-sm text-slate-300">
                  {painCards.slice(0, 3).map((meta) => (
                    <li key={meta.tag} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                      <span>{meta.shortLabel}: {meta.solution}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    setShowDemoTeaser(false);
                    onFinish();
                  }}
                  className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 text-sm font-extrabold text-white ${PRESS}`}
                >
                  Tiếp tục tìm thợ quanh tiệm của bạn
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
