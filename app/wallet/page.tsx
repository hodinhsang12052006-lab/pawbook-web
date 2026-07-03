"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { Coins, CreditCard, Sparkles, Loader2, ArrowRight, ShieldCheck, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface TopupPackage {
  id: string;
  name: string;
  price: number;
  coins: number;
  bonus: string | null;
  tag: string | null;
  color: string;
}

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<TopupPackage | null>(null);

  const packages: TopupPackage[] = [
    {
      id: "pkg-starter",
      name: "Gói Starter",
      price: 50000,
      coins: 500,
      bonus: null,
      tag: "Cơ bản",
      color: "from-blue-600 to-cyan-600",
    },
    {
      id: "pkg-pro",
      name: "Gói Pro",
      price: 200000,
      coins: 2200,
      bonus: "Tặng thêm 10%",
      tag: "Bán chạy nhất",
      color: "from-purple-600 to-indigo-600",
    },
    {
      id: "pkg-mmo",
      name: "Gói Trùm MMO",
      price: 500000,
      coins: 6000,
      bonus: "Tặng thêm 20%",
      tag: "Siêu ưu đãi",
      color: "from-amber-600 to-yellow-600",
    },
  ];

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [profileRes, historyRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/wallet/history")
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setBalance(profile.pawCoin || 0);
      }
      if (historyRes.ok) {
        const txs = await historyRes.json();
        setHistory(txs);
      }
    } catch (err) {
      toast.error("Lỗi tải dữ liệu ví.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleInitiatePayment = async (pkg: TopupPackage) => {
    setSubmitting(pkg.id);
    try {
      const res = await fetch("/api/wallet/vnpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountVND: pkg.price,
          pawCoinAmount: pkg.coins,
        }),
      });

      const data = await res.json();

      if (res.ok && data.paymentUrl) {
        toast.success("Khởi tạo cổng thanh toán thành công!");
        setTimeout(() => {
          window.location.href = data.paymentUrl;
        }, 1000);
      } else {
        toast.error(data.error || "Giao dịch không thành công.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối.");
    } finally {
      setSubmitting(null);
      setShowModal(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Balance & Overview Card */}
        <div className="rounded-3xl border border-slate-850 bg-[#0b0f19] p-6 sm:p-8 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-amber-500/5 blur-3xl"></div>
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-2xs font-bold text-amber-400">
                <Coins className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                <span>Ví điện tử PawBook</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Quản Lý Tài Khoản Ví PawCoin</h1>
              <p className="text-3xs sm:text-xs text-slate-400 max-w-md">Dùng PawCoins để đẩy top tin tuyển dụng, đẩy nổi bật dịch vụ local spa của bạn, hoặc chào thầu các dự án MMO freelance.</p>
            </div>

            <div className="bg-[#060913] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 min-w-[220px]">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Coins className="h-6 w-6 fill-amber-500" />
              </div>
              <div>
                <span className="block text-3xs font-semibold text-slate-500 uppercase tracking-wider">Số Dư Khả Dụng</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5 block flex items-center gap-1">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : balance.toLocaleString()} <span className="text-3xs font-medium text-slate-400">PC</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Packages Panel */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-100">Chọn Gói Nạp PawCoin</h2>
            <p className="text-3xs text-slate-500">Tối ưu chi phí thanh toán an toàn, bảo mật qua đối tác cổng thanh toán VNPay.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-slate-850 bg-[#090d1a] p-6 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 relative overflow-hidden group shadow-lg">
                {pkg.tag && (
                  <span className="absolute top-3 right-3 text-4xs font-black uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                    {pkg.tag}
                  </span>
                )}

                <div className="space-y-4">
                  <span className="block text-xs font-bold text-slate-400">{pkg.name}</span>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white flex items-baseline gap-1">
                      {pkg.coins.toLocaleString()}{" "}
                      <span className="text-xs font-semibold text-slate-500">Coins</span>
                    </h3>
                    {pkg.bonus && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-4xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        {pkg.bonus}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-350 pt-2 border-t border-slate-850">
                    Phí nạp: <span className="font-bold text-white">{(pkg.price).toLocaleString("vi-VN")} VND</span>
                  </p>
                </div>

                <button
                  onClick={() => setShowModal(pkg)}
                  className={`w-full mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r ${pkg.color} py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 cursor-pointer transition-all`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Nạp tiền ngay</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Top-up Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0c101f] p-6 space-y-6 relative overflow-hidden shadow-2xl">
              <div>
                <h4 className="text-base font-bold text-slate-200">Xác Nhận Đơn Hàng</h4>
                <p className="text-3xs text-slate-500 mt-1">Đơn hàng của bạn sẽ được xử lý qua sandbox cổng thanh toán VNPay.</p>
              </div>

              <div className="bg-[#050812] border border-slate-850 rounded-xl p-4 space-y-2 text-3xs sm:text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gói nạp:</span>
                  <span className="font-semibold text-slate-200">{showModal.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng nhận:</span>
                  <span className="font-bold text-amber-400">+{showModal.coins} PawCoins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tiền:</span>
                  <span className="font-extrabold text-white">{showModal.price.toLocaleString("vi-VN")} VND</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(null)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleInitiatePayment(showModal)}
                  disabled={submitting === showModal.id}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  {submitting === showModal.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Tiến hành</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="text-base font-bold text-slate-100">Lịch Sử Giao Dịch Ví</h2>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-500">Đang tải lịch sử...</div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-slate-850 bg-slate-900/10 p-8 text-center text-xs text-slate-500">
              Chưa thực hiện giao dịch nạp/tiêu dùng coin nào.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-900/10">
              <table className="w-full text-left border-collapse text-3xs sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 bg-slate-950/40">
                    <th className="p-4 font-semibold">Thời Gian</th>
                    <th className="p-4 font-semibold">Mô Tả</th>
                    <th className="p-4 font-semibold">Cổng/Phương Thức</th>
                    <th className="p-4 font-semibold text-center">Trạng Thái</th>
                    <th className="p-4 font-semibold text-right">Biến Động Coin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {history.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-900/20 transition-all">
                      <td className="p-4 text-slate-400 font-medium">
                        {new Date(tx.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{tx.description}</div>
                        {tx.amountVND && (
                          <div className="text-slate-500 text-4xs">Số tiền nạp: {tx.amountVND.toLocaleString("vi-VN")} VND</div>
                        )}
                      </td>
                      <td className="p-4 font-medium text-slate-300">
                        {tx.provider || "PawBook System"}
                      </td>
                      <td className="p-4 text-center">
                        {tx.status === "SUCCESS" || tx.type === "INCOME" && !tx.status ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-4xs font-bold text-emerald-450">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Thành Công</span>
                          </span>
                        ) : tx.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-4xs font-bold text-amber-400">
                            <Clock className="h-3 w-3 animate-spin" />
                            <span>Đang Xử Lý</span>
                          </span>
                        ) : tx.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-4xs font-bold text-rose-455">
                            <XCircle className="h-3 w-3" />
                            <span>Thất Bại</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-4xs font-bold text-slate-400">
                            <span>Hệ Thống</span>
                          </span>
                        )}
                      </td>
                      <td className={`p-4 text-right font-black ${tx.type === "INCOME" ? "text-emerald-450" : "text-rose-455"}`}>
                        {tx.type === "INCOME" ? "+" : ""}{tx.amount} PC
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. All payment procedures processed under secured environment.</p>
      </footer>
    </div>
  );
}
