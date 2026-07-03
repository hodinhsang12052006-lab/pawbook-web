"use client";

import React, { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Sparkles, Check, CreditCard, Shield, Star, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const packages = [
    {
      id: "basic",
      name: "Gói PawCoin Cơ Bản",
      priceVND: 50000,
      priceLabel: "50.000đ",
      coins: "+100 PawCoins",
      description: "Thích hợp để cày Airdrop, ứng tuyển các Gigs việc làm cơ bản và nâng cao uy tín nhẹ.",
      features: [
        "Nhận ngay 100 PawCoins vào ví",
        "Mở khóa ứng tuyển 20 tin tuyển dụng",
        "Đăng tin đấu thầu tự do",
        "Hỗ trợ support cơ bản từ cộng đồng",
      ],
      popular: false,
      color: "border-slate-800 bg-slate-900/10",
      btnText: "Nạp PawCoin Ngay",
    },
    {
      id: "vip",
      name: "Gói Tuyển Dụng VIP",
      priceVND: 500000,
      priceLabel: "500.000đ",
      coins: "+1,200 PawCoins + Tích Xanh",
      description: "Dành cho nhà tuyển dụng chuyên nghiệp, HR Manager, và MMO Pro cần truyền thông tin tức nổi bật.",
      features: [
        "Nhận ngay 1,200 PawCoins vào ví (+20% bonus)",
        "Tự động cấp Tích Xanh uy tín (Verified Badge)",
        "Thiết lập TrustScore tối đa 5.0 lập tức",
        "Ưu tiên đẩy tin tuyển dụng lên top (Boost tin)",
        "Hỗ trợ phân tích độ phù hợp CV bằng AI không giới hạn",
      ],
      popular: true,
      color: "border-blue-500/40 bg-gradient-to-b from-[#0a1535]/80 to-[#050814]/80 shadow-lg shadow-blue-500/5",
      btnText: "Nâng Cấp VIP Tuyển Dụng",
    },
  ];

  const handlePayment = async (packageId: string, amount: number) => {
    try {
      setLoading(packageId);
      const res = await fetch("/api/vnpay/create-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        toast.loading("Đang kết nối cổng thanh toán VNPay Sandbox...");
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.error || "Không thể khởi tạo liên kết thanh toán. Vui lòng đăng nhập.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối cổng thanh toán.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 mb-20 md:mb-0">
        <div className="flex flex-col gap-6 md:flex-row">
          <Sidebar />

          <div className="flex-1 space-y-6">
            {/* Header banner */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-md relative overflow-hidden text-center max-w-3xl mx-auto">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-2xs font-semibold text-blue-400 border border-blue-500/20 mx-auto">
                <CreditCard className="h-3 w-3 animate-pulse" />
                Cổng nạp tiền PawBook
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-tight">
                Nâng cấp Ví PawCoin & Kích hoạt Quyền lợi VIP
              </h1>
              <p className="text-xs text-slate-400 mt-2 max-w-xl mx-auto">
                Nạp PawCoin an toàn qua VNPay Sandbox để gia tăng hạn mức ứng tuyển hoặc nâng cấp tài khoản VIP sở hữu Tích Xanh cùng TrustScore tuyệt đối!
              </p>
            </div>

            {/* Pricing cards grid container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between relative transition-all duration-300 hover:scale-[1.01] ${pkg.color}`}
                >
                  {pkg.popular && (
                    <div className="absolute top-0 right-6 -translate-y-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-blue-500/20 uppercase tracking-wider">
                        Popular
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{pkg.name}</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl sm:text-3xl font-extrabold text-white">{pkg.priceLabel}</span>
                        <span className="text-3xs text-slate-450">/ lượt nạp</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 mt-3">
                        <Sparkles className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500 animate-pulse" />
                        {pkg.coins}
                      </span>
                    </div>

                    <p className="text-2xs leading-relaxed text-slate-400">{pkg.description}</p>

                    <ul className="space-y-2 pt-3 border-t border-slate-850/60 text-2xs">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-slate-300">
                          <Check className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-850/60">
                    <button
                      disabled={loading !== null}
                      onClick={() => handlePayment(pkg.id, pkg.priceVND)}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white transition-all cursor-pointer ${
                        pkg.popular
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-600/10 hover:from-blue-500 hover:to-indigo-500"
                          : "bg-slate-800 hover:bg-slate-750 border border-slate-700"
                      }`}
                    >
                      {loading === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang kết nối...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          <span>{pkg.btnText}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
