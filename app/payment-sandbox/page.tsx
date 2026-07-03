"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, ShieldCheck, CreditCard, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

function PaymentSandboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const txnId = searchParams.get("txnId");
  const amountVND = searchParams.get("amountVND");
  const pawCoinAmount = searchParams.get("pawCoinAmount");

  const [loading, setLoading] = useState(false);

  const handleCallback = async (status: "SUCCESS" | "FAILED") => {
    if (!txnId) {
      toast.error("Thiếu mã giao dịch (txnId).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/vnpay/callback", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          txnId,
          status,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (status === "SUCCESS") {
          toast.success(data.message || "Thanh toán thành công!");
          setTimeout(() => {
            router.push("/wallet?topup=success");
          }, 1500);
        } else {
          toast.error("Đã hủy thanh toán.");
          setTimeout(() => {
            router.push("/wallet?topup=cancel");
          }, 1500);
        }
      } else {
        toast.error(data.error || "Giao dịch không thể xử lý.");
      }
    } catch (err) {
      toast.error("Lỗi mạng khi cập nhật trạng thái thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  if (!txnId) {
    return (
      <div className="flex min-h-screen bg-[#070a13] text-slate-100 items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <XCircle className="h-16 w-16 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Mã Giao Dịch Không Hợp Lệ</h2>
          <p className="text-xs text-slate-400 max-w-sm">Không tìm thấy thông tin phiên giao dịch nạp tiền. Vui lòng thử lại từ ví.</p>
          <button onClick={() => router.push("/wallet")} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer">
            Quay lại ví
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#070a13] text-slate-100 items-center justify-center p-4">
      <Toaster position="top-center" />
      
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0c101f] p-6 space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

        {/* Security Tag */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold text-slate-200">Cổng Thanh Toán Giả Lập VNPay</span>
          </div>
          <div className="flex items-center gap-1 text-[#22c55e] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-4xs font-bold uppercase">
            <ShieldCheck className="h-3 w-3" />
            <span>Sandbox Secure</span>
          </div>
        </div>

        {/* Invoice Info */}
        <div className="space-y-4 text-center">
          <p className="text-4xs font-bold text-slate-500 uppercase tracking-widest">Số Tiền Cần Thanh Toán</p>
          <h2 className="text-3xl font-extrabold text-white">
            {parseFloat(amountVND || "0").toLocaleString("vi-VN")} <span className="text-sm font-semibold text-slate-400">VND</span>
          </h2>
          <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-850 inline-block w-full text-left space-y-2 text-3xs sm:text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã giao dịch:</span>
              <span className="font-semibold text-slate-300 truncate max-w-[180px]">{txnId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Số lượng nạp:</span>
              <span className="font-bold text-amber-400">+{pawCoinAmount} PawCoins</span>
            </div>
          </div>
        </div>

        {/* Simulated QR Scan */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-800 w-48 h-48 mx-auto shadow-inner">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=vnpay_txn_${txnId}_amount_${amountVND}`}
            alt="Simulated Payment QR"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-center text-4xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          Mở ứng dụng Mobile Banking quét mã QR để thanh toán hoặc nhấn trực tiếp nút bên dưới để mô phỏng.
        </p>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {loading ? (
            <button disabled className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-slate-500 border border-slate-800">
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              <span>Đang xử lý kết quả thanh toán...</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => handleCallback("SUCCESS")}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>Thanh Toán Thành Công (+{pawCoinAmount} PC)</span>
              </button>

              <button
                onClick={() => handleCallback("FAILED")}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 py-3 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              >
                <XCircle className="h-4.5 w-4.5 text-rose-500" />
                <span>Hủy Giao Dịch</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentSandbox() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-[#070a13] text-slate-100 items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Đang khởi tạo cổng thanh toán...</p>
        </div>
      </div>
    }>
      <PaymentSandboxContent />
    </Suspense>
  );
}
