"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { Radar, Loader2, DollarSign, Users, Package, Lightbulb, ClipboardList, AlertCircle, Info, TrendingUp } from "lucide-react";

type MarketKey = "US" | "AU";
type SkillKey = "BOT" | "DIP" | "TAY_NUOC";

const US_STATES = ["CA", "TX", "FL", "NY", "WA", "GA", "NC", "VA", "AZ", "IL"];
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "ACT"];

const SKILL_OPTIONS: { key: SkillKey; label: string; emoji: string }[] = [
  { key: "BOT", label: "Thợ Bột/Acrylic", emoji: "💅" },
  { key: "DIP", label: "Thợ Dip/SNS", emoji: "✨" },
  { key: "TAY_NUOC", label: "Thợ Chân Tay Nước", emoji: "🦶" },
];

interface DemandSignal {
  demandCount: number;
  wageMentions: number;
  topSkills: string[];
}

interface RadarResult {
  rateMin: number;
  rateMax: number;
  currency: "USD" | "AUD";
  turnSplitOptions: string[];
  supplyPolicy: string;
  negotiationTips: string[];
  ownerChecklist: string[];
  demandSignal: DemandSignal | null;
}

const TREND_SKILL_LABEL: Record<string, string> = {
  BOT: "Bột/Acrylic",
  DIP: "Dip/SNS",
  TAY_NUOC: "Chân Tay Nước",
  GEL_X: "Gel-X/Builder Gel",
};

export default function NailRadarPage() {
  const [market, setMarket] = useState<MarketKey>("US");
  const [state, setState] = useState<string>("CA");
  const [skill, setSkill] = useState<SkillKey>("BOT");
  const [result, setResult] = useState<RadarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = market === "US" ? US_STATES : AU_STATES;

  useEffect(() => {
    if (!states.includes(state)) setState(states[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tools/radar?market=${market}&state=${state}&skill=${skill}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể tải dữ liệu.");
        if (!cancelled) setResult(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Lỗi mạng.");
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [market, state, skill]);

  const currencySymbol = market === "US" ? "$" : "A$";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-2xl px-4 py-8 pb-24 md:pb-8 space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Radar className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Nail Radar</h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Chỉ số bao lương & chia turn tham khảo theo tiểu bang — đối chiếu trước khi quyết định bay đến tiệm mới.
          </p>
        </div>

        {/* Market toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/40 border border-slate-850">
          {(["US", "AU"] as MarketKey[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all ${market === m ? "bg-amber-600 text-white" : "text-slate-400"}`}
            >
              {m === "US" ? "🇺🇸 Mỹ (US)" : "🇦🇺 Úc (AU)"}
            </button>
          ))}
        </div>

        {/* State selector */}
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">Chọn tiểu bang</p>
          <div className="flex flex-wrap gap-2">
            {states.map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border-2 transition-all ${
                  state === s ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-slate-800 text-slate-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Skill selector */}
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">Chọn kỹ năng chính</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SKILL_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSkill(s.key)}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                  skill === s.key ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-slate-800 text-slate-400"
                }`}
              >
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && !loading && !error && (
          <div className="space-y-4 animate-fadeIn">
            {/* Rate estimate */}
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-slate-900/40 to-orange-950/40 p-5 text-center space-y-1.5">
              <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Mức bao lương tham khảo / tuần
              </p>
              <p className="text-3xl font-black text-white">
                {currencySymbol}{result.rateMin.toLocaleString("en-US")} – {currencySymbol}{result.rateMax.toLocaleString("en-US")}
              </p>
              <p className="text-[10px] text-slate-500">{result.currency} / tuần · {state}</p>
            </div>

            {/* Demand signal — số tin tuyển thợ thật ghi nhận từ cộng đồng */}
            <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 via-slate-900/30 to-slate-900/30 p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Cầu thợ thực tế từ cộng đồng
              </p>
              {result.demandSignal ? (
                <>
                  <p className="text-2xl font-black text-emerald-400">
                    {result.demandSignal.demandCount} tin tuyển thợ
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ghi nhận tại {state} qua các nhóm cộng đồng ngành nail
                    {result.demandSignal.wageMentions > 0 && (
                      <> · {result.demandSignal.wageMentions} tin có nhắc mức lương cụ thể</>
                    )}
                  </p>
                  {result.demandSignal.topSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {result.demandSignal.topSkills.map((sk) => (
                        <span key={sk} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          {TREND_SKILL_LABEL[sk] || sk}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Chưa đủ dữ liệu cộng đồng cho bang này trong đợt quét gần nhất.</p>
              )}
            </div>

            {/* Turn split */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-pink-400" /> Mức chia turn phổ biến
              </p>
              <ul className="space-y-1.5">
                {result.turnSplitOptions.map((opt, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-pink-400 mt-0.5">•</span> {opt}
                  </li>
                ))}
              </ul>
            </div>

            {/* Supply policy */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-indigo-400" /> Ai bao supply?
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">{result.supplyPolicy}</p>
            </div>

            {/* Negotiation tips */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-400" /> Mẹo thỏa thuận trước khi bay
              </p>
              <ul className="space-y-1.5">
                {result.negotiationTips.map((tip, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Owner checklist */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-emerald-400" /> Checklist hỏi chủ trước khi nhận việc
              </p>
              <ul className="space-y-1.5">
                {result.ownerChecklist.map((item, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">☐</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-900/40 border border-slate-850">
              <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Đây là mức tham khảo tổng hợp theo kinh nghiệm phổ biến của cộng đồng ngành nail, KHÔNG phải số liệu
                thống kê chính thức hay cam kết từ PawNail Jobs. Mức thực tế luôn phụ thuộc vào từng tiệm cụ thể —
                hãy dùng con số này làm mốc đối chiếu, không phải căn cứ duy nhất khi quyết định.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
