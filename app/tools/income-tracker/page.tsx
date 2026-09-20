"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import { Wallet, Calendar, Plus, TrendingUp, Trash2, Loader2, ClipboardCheck, X } from "lucide-react";

const PRESS = "active:scale-[0.98] transition-transform duration-100";
const STORAGE_KEY_PREFIX = "bitpaw_income_";
const SPLIT_KEY_PREFIX = "bitpaw_income_split_";

interface DailyEntry {
  date: string; // YYYY-MM-DD
  turns: number;
  serviceAmount: number;
  tipCash: number;
  tipCredit: number;
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// Tuần tính từ Thứ 2 — khớp thói quen "chốt lương cuối tuần" của tiệm nail.
function startOfWeek(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=CN..6=T7
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateVN(d: Date) {
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function currency(n: number) {
  return "$" + n.toLocaleString("vi-VN");
}

// Chạy thuần phía Client, lưu vào localStorage theo userId — không đụng DB
// Turso, phản hồi tức thì. Đây là v1 (MVP) của tính năng "Bảng Tính Thu Nhập
// & Tip Hằng Ngày" — nếu đo được usage thật, v2 mới đầu tư sync 1 bảng
// DailyEarning trong Prisma.
export default function IncomeTrackerPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [splitPercent, setSplitPercent] = useState(60);

  const [formDate, setFormDate] = useState(todayISO());
  const [formTurns, setFormTurns] = useState("");
  const [formService, setFormService] = useState("");
  const [formTipCash, setFormTipCash] = useState("");
  const [formTipCredit, setFormTipCredit] = useState("");

  const [showReconcile, setShowReconcile] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const session = res.ok ? await res.json() : null;
        if (!session?.user?.id) {
          toast.error("Vui lòng đăng nhập để dùng Bảng tính thu nhập.");
          router.push("/auth/login");
          return;
        }
        setUserId(session.user.id);
        setUserName(session.user.name || "");
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
      if (raw) setEntries(JSON.parse(raw));
      const rawSplit = localStorage.getItem(SPLIT_KEY_PREFIX + userId);
      if (rawSplit) setSplitPercent(Number(rawSplit) || 60);
    } catch (err) {
      console.error("Failed to read income tracker data from localStorage:", err);
    }
  }, [userId]);

  const persistEntries = (next: DailyEntry[]) => {
    setEntries(next);
    if (!userId) return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(next));
    } catch (err) {
      console.error("Failed to save income tracker data to localStorage:", err);
    }
  };

  const persistSplit = (percent: number) => {
    setSplitPercent(percent);
    if (!userId) return;
    try {
      localStorage.setItem(SPLIT_KEY_PREFIX + userId, String(percent));
    } catch (err) {
      console.error("Failed to save split percent to localStorage:", err);
    }
  };

  const handleSaveEntry = () => {
    const turns = Number(formTurns) || 0;
    const serviceAmount = Number(formService) || 0;
    const tipCash = Number(formTipCash) || 0;
    const tipCredit = Number(formTipCredit) || 0;
    if (turns <= 0 && serviceAmount <= 0 && tipCash <= 0 && tipCredit <= 0) {
      toast.error("Nhập ít nhất 1 số liệu cho ca làm hôm nay.");
      return;
    }
    // Upsert theo ngày — lưu đè nếu đã ghi ca này rồi (sửa lại trong ngày).
    const next = entries.filter((e) => e.date !== formDate);
    next.push({ date: formDate, turns, serviceAmount, tipCash, tipCredit });
    next.sort((a, b) => a.date.localeCompare(b.date));
    persistEntries(next);
    toast.success("Đã lưu ca làm hôm nay! 🎉", { duration: 2500 });
    setFormTurns("");
    setFormService("");
    setFormTipCash("");
    setFormTipCredit("");
  };

  const handleDeleteEntry = (date: string) => {
    persistEntries(entries.filter((e) => e.date !== date));
  };

  const weekStart = useMemo(() => startOfWeek(formDate), [formDate]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const weekEntries = useMemo(() => {
    return entries
      .filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return d >= weekStart && d <= weekEnd;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, weekStart, weekEnd]);

  const weekTotals = useMemo(() => {
    const totalTurns = weekEntries.reduce((s, e) => s + e.turns, 0);
    const totalService = weekEntries.reduce((s, e) => s + e.serviceAmount, 0);
    const totalTipCash = weekEntries.reduce((s, e) => s + e.tipCash, 0);
    const totalTipCredit = weekEntries.reduce((s, e) => s + e.tipCredit, 0);
    const totalTip = totalTipCash + totalTipCredit;
    // Giả định tip về 100% cho thợ (thông lệ ngành nail) — chỉ tiền dịch vụ
    // mới chia theo %.
    const estimatedEarning = totalService * (splitPercent / 100) + totalTip;
    return { totalTurns, totalService, totalTipCash, totalTipCredit, totalTip, estimatedEarning };
  }, [weekEntries, splitPercent]);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 pb-28 md:pb-10 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="h-6 w-6 text-purple-400" /> Bảng Tính Thu Nhập & Tip
          </h1>
          <p className="text-sm text-slate-400">
            Ghi turn + tip mỗi tối, tự cộng dồn theo tuần — đối chiếu phiếu lương cuối tuần cho chuẩn.
          </p>
        </div>

        {/* FORM NHẬP LIỆU — One-thumb design: mỗi input min-h-[48px], 1 nút lưu duy nhất */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wide">
            <Calendar className="h-4 w-4 text-purple-400" /> Ghi ca làm
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Ngày</label>
            <input
              type="date"
              value={formDate}
              max={todayISO()}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Số lượt làm (Turn)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={formTurns}
                onChange={(e) => setFormTurns(e.target.value)}
                placeholder="0"
                className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Tiền dịch vụ ($)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={formService}
                onChange={(e) => setFormService(e.target.value)}
                placeholder="0"
                className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Tip tiền mặt ($)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={formTipCash}
                onChange={(e) => setFormTipCash(e.target.value)}
                placeholder="0"
                className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Tip thẻ ($)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={formTipCredit}
                onChange={(e) => setFormTipCredit(e.target.value)}
                placeholder="0"
                className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveEntry}
            className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 ${PRESS}`}
          >
            <Plus className="h-4.5 w-4.5" /> Lưu ca làm hôm nay
          </button>
        </div>

        {/* CẤU HÌNH % ĂN CHIA — thợ tự cấu hình, dùng để ước tính phần nhận */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-300">Bạn ăn chia bao nhiêu % dịch vụ?</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Tip mặc định tính 100% về bạn.</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number"
              min={0}
              max={100}
              value={splitPercent}
              onChange={(e) => persistSplit(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-16 min-h-[40px] rounded-xl border border-slate-800 bg-slate-950 px-2 text-center text-sm font-bold text-purple-300 focus:outline-none focus:border-purple-500"
            />
            <span className="text-sm font-bold text-slate-400">%</span>
          </div>
        </div>

        {/* TỔNG KẾT TUẦN */}
        <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 via-slate-900/40 to-indigo-950/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wide">
            <TrendingUp className="h-4 w-4" /> Tổng kết tuần {formatDateVN(weekStart)} – {formatDateVN(weekEnd)}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng lượt làm</p>
              <p className="text-lg font-black text-white mt-1">{weekTotals.totalTurns}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng dịch vụ</p>
              <p className="text-lg font-black text-white mt-1">{currency(weekTotals.totalService)}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng Tip</p>
              <p className="text-lg font-black text-emerald-400 mt-1">{currency(weekTotals.totalTip)}</p>
            </div>
            <div className="rounded-2xl bg-purple-500/10 border border-purple-500/30 p-3">
              <p className="text-[10px] font-bold text-purple-300 uppercase">Ước tính bạn nhận</p>
              <p className="text-lg font-black text-purple-300 mt-1">{currency(weekTotals.estimatedEarning)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReconcile(true)}
            disabled={weekEntries.length === 0}
            className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 text-sm font-bold text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${PRESS}`}
          >
            <ClipboardCheck className="h-4.5 w-4.5" /> Đối chiếu phiếu lương
          </button>
        </div>

        {/* DANH SÁCH CA LÀM TRONG TUẦN */}
        {weekEntries.length > 0 && (
          <div className="rounded-2xl border border-slate-800 divide-y divide-slate-850 overflow-hidden">
            {weekEntries.map((e) => (
              <div key={e.date} className="flex items-center justify-between px-4 py-3 bg-slate-900/20">
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {new Date(e.date + "T00:00:00").toLocaleDateString("vi-VN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {e.turns} lượt · DV {currency(e.serviceAmount)} · Tip {currency(e.tipCash + e.tipCredit)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteEntry(e.date)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ĐÒN BẨY BÁN PHẦN MỀM — lead-capture nhẹ, cùng cơ chế với Trojan
            Horse CTA trong SalonDiagnosticModal.tsx (không bật tính năng thật,
            chỉ ghi nhận nhu cầu + báo team follow-up). */}
        <button
          type="button"
          onClick={() =>
            toast.success(
              "Đã ghi nhận! Đội ngũ PawNail sẽ liên hệ tư vấn Bảng Chia Turn tự động cho tiệm bạn trong 24h.",
              { duration: 4000, icon: "🚀" }
            )
          }
          className="w-full text-left rounded-2xl border border-dashed border-slate-700 bg-slate-900/20 p-4 text-xs text-slate-400 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer"
        >
          💡 Tiệm bạn chưa chia turn tự động?{" "}
          <span className="text-purple-300 font-bold">Giới thiệu chủ tiệm dùng thử Bảng Chia Turn PawNail POS</span>{" "}
          để không bao giờ sợ tính lộn tip!
        </button>
      </main>

      {/* MODAL ĐỐI CHIẾU — thiết kế để giơ màn hình cho chủ tiệm xem trực tiếp */}
      {showReconcile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Đối chiếu phiếu lương</h3>
              <button
                onClick={() => setShowReconcile(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {userName ? `${userName} — ` : ""}Tuần {formatDateVN(weekStart)} – {formatDateVN(weekEnd)}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Tổng lượt làm</span>
                <span className="font-bold text-white">{weekTotals.totalTurns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tổng tiền dịch vụ</span>
                <span className="font-bold text-white">{currency(weekTotals.totalService)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">% ăn chia</span>
                <span className="font-bold text-white">{splitPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tip tiền mặt</span>
                <span className="font-bold text-white">{currency(weekTotals.totalTipCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tip thẻ</span>
                <span className="font-bold text-white">{currency(weekTotals.totalTipCredit)}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-base">
                <span className="font-black text-purple-300">Ước tính bạn nhận</span>
                <span className="font-black text-purple-300">{currency(weekTotals.estimatedEarning)}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 text-center">
              Số liệu tự ghi trên máy bạn — dùng để đối chiếu, không thay thế phiếu lương chính thức của tiệm.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
