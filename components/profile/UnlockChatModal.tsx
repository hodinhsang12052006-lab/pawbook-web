"use client";

import React, { useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Lock, Unlock, X, Sparkles, ArrowRight, Loader2, PartyPopper, Square, CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { SURVEY, PAIN_TAG_META, HIRING_TIMELINE_OPTIONS } from "@/lib/ownerSurvey";

// Modal này chỉ bao giờ mount sau khi người dùng bấm nút (showUnlockModal
// bắt đầu là false) — không bao giờ có trong lần render SSR đầu tiên, nên
// gọi thẳng Capacitor.isNativePlatform() ở đây an toàn, không cần
// useEffect/useState để né hydration mismatch như LanguageProvider phải làm.
const IS_NATIVE_APP = typeof window !== "undefined" && Capacitor.isNativePlatform();

const PRESS = "active:scale-95 transition-transform duration-100";

interface UnlockChatModalProps {
  technicianUserId: string;
  technicianName: string;
  ownerPains: string[];
  onUnlocked: () => void;
  onClose: () => void;
}

type Step = "paywall" | "survey" | "unlocking" | "success";

export default function UnlockChatModal({ technicianUserId, technicianName, ownerPains, onUnlocked, onClose }: UnlockChatModalProps) {
  const [step, setStep] = useState<Step>("paywall");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [timeline, setTimeline] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Chỉ hỏi lại đúng những nỗi đau họ đã tự nhận lúc đăng ký — không hỏi
  // chung chung, đúng tinh thần "khảo sát chuyên sâu" cá nhân hoá 100%.
  const painCards = useMemo(
    () => SURVEY.map((q) => q.tag).filter((tag) => ownerPains.includes(tag)).map((tag) => PAIN_TAG_META[tag]).filter(Boolean),
    [ownerPains]
  );

  const toggleCheck = (tag: string) => setChecked((prev) => ({ ...prev, [tag]: !prev[tag] }));

  const handleConfirmUnlock = async () => {
    if (!timeline) {
      toast.error("Vui lòng chọn thời gian dự kiến nhận thợ.");
      return;
    }
    setSubmitting(true);
    setStep("unlocking");
    try {
      const selectedTags = Object.keys(checked).filter((tag) => checked[tag]);
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianUserId,
          deepSurveyAnswers: selectedTags,
          hiringTimeline: timeline,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Mở khóa thất bại. Vui lòng thử lại.");
        setStep("survey");
        setSubmitting(false);
        return;
      }
      // Giữ hiệu ứng "đang xử lý" đủ lâu để cảm giác như hệ thống thật sự
      // đồng bộ hồ sơ — quá nhanh (tức thời) sẽ mất cảm giác "vừa mở khóa
      // một thứ có giá trị".
      setTimeout(() => setStep("success"), 900);
    } catch {
      toast.error("Lỗi kết nối mạng. Vui lòng thử lại.");
      setStep("survey");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4" onClick={step === "paywall" || step === "survey" ? onClose : undefined}>
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {(step === "paywall" || step === "survey") && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-slate-500 hover:text-slate-300"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {step === "paywall" && (
          <div className="p-6 space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-600 to-amber-500 shadow-lg shadow-pink-600/30">
              <Lock className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white leading-tight">MỞ KHÓA KẾT NỐI TRỰC TIẾP</h2>
              <p className="text-sm text-slate-400">
                với <span className="font-bold text-white">{technicianName}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-5 space-y-1.5">
              {/* Trong app native, KHÔNG hiện số tiền gạch ngang — Apple review
                  dễ đọc nhầm thành 1 mức giá thật đang được "giảm giá" ngay
                  trong app (rủi ro Guideline 2.3.1 Accurate Metadata / nghi
                  vấn né In-App Purchase), dù backend không hề thu tiền. Trên
                  web/PWA vẫn giữ nguyên khung "$4.99 → $0" vì đó chỉ là trang
                  web thường, không thuộc phạm vi review của Apple. */}
              {IS_NATIVE_APP ? (
                <>
                  <p className="text-4xl font-black bg-gradient-to-r from-pink-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                    Đặc quyền Hội viên
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Miễn phí mở khóa</p>
                </>
              ) : (
                <>
                  <p className="text-base text-slate-500 line-through">$4.99 USD</p>
                  <p className="text-4xl font-black bg-gradient-to-r from-pink-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                    $0 — MIỄN PHÍ 100%
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ưu đãi đặc quyền hôm nay</p>
                </>
              )}
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Dành riêng cho chủ tiệm: Hoàn tất <span className="font-bold text-white">2 bước xác nhận nhu cầu vận hành</span> để hệ thống đồng bộ hồ sơ và mở khóa liên hệ ngay lập tức.
            </p>

            <button
              type="button"
              onClick={() => setStep("survey")}
              className={`w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-amber-500 hover:brightness-110 text-base font-extrabold text-white shadow-xl shadow-pink-600/25 ${PRESS}`}
            >
              <Sparkles className="h-5 w-5 flex-shrink-0" />
              Bắt đầu — chỉ 30 giây
            </button>
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-300">
              Để sau
            </button>
          </div>
        )}

        {step === "survey" && (
          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pink-400">Bước 2/2 — Xác nhận nhu cầu vận hành</p>
              <h2 className="text-lg font-extrabold text-white leading-snug">Đồng bộ hồ sơ để mở khóa ngay</h2>
            </div>

            {painCards.length > 0 ? (
              <div className="space-y-2.5">
                {painCards.map((meta) => (
                  <button
                    key={meta.tag}
                    type="button"
                    onClick={() => toggleCheck(meta.tag)}
                    className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all ${PRESS} ${
                      checked[meta.tag] ? "border-pink-500 bg-pink-500/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                    }`}
                  >
                    <p className="text-sm text-slate-200 leading-relaxed mb-2">{meta.unlockQuestion}</p>
                    <div className="flex items-center gap-2">
                      {checked[meta.tag] ? (
                        <CheckSquare className="h-4 w-4 flex-shrink-0 text-pink-400" />
                      ) : (
                        <Square className="h-4 w-4 flex-shrink-0 text-slate-600" />
                      )}
                      <span className={`text-xs font-bold ${checked[meta.tag] ? "text-pink-300" : "text-slate-400"}`}>
                        {meta.unlockCheckboxLabel}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
                Tiệm bạn có vẻ vận hành khá ổn — chỉ cần xác nhận thời gian dự kiến bên dưới để mở khóa.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-200">Thời gian dự kiến bạn muốn thợ này bắt đầu làm việc?</p>
              <div className="grid grid-cols-3 gap-2">
                {HIRING_TIMELINE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimeline(opt.value)}
                    className={`min-h-[44px] rounded-xl border-2 px-2 text-xs font-bold transition-all ${PRESS} ${
                      timeline === opt.value ? "border-pink-500 bg-pink-500/15 text-pink-300" : "border-slate-800 bg-slate-900/40 text-slate-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmUnlock}
              className={`w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-amber-500 hover:brightness-110 text-base font-extrabold text-white shadow-xl shadow-pink-600/25 disabled:opacity-60 ${PRESS}`}
            >
              <Unlock className="h-5 w-5 flex-shrink-0" />
              Xác Nhận &amp; Mở Khóa Miễn Phí
            </button>
          </div>
        )}

        {step === "unlocking" && (
          <div className="p-10 flex flex-col items-center justify-center gap-4 text-center min-h-[280px]">
            <Loader2 className="h-10 w-10 text-pink-400 animate-spin" />
            <p className="text-sm font-bold text-slate-300">Đang đồng bộ hồ sơ và mở khóa liên hệ...</p>
          </div>
        )}

        {step === "success" && (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[280px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 animate-scaleUp">
              <PartyPopper className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white">Đã mở khóa thành công! 🎉</h2>
            <p className="text-sm text-slate-400">
              Bạn có thể nhắn tin và gọi trực tiếp cho <span className="font-bold text-white">{technicianName}</span> ngay bây giờ.
            </p>
            <button
              type="button"
              onClick={onUnlocked}
              className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-amber-500 mt-2 text-sm font-extrabold text-white ${PRESS}`}
            >
              Vào khung chat ngay
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
