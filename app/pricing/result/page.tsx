"use client";

import React, { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import { CheckCircle, XCircle, ArrowRight, RefreshCw, User, ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const message = searchParams.get("message") || "";

  const getErrorMessage = (msg: string) => {
    if (msg === "InvalidSignature") return "Chữ ký số bảo mật của giao dịch không khớp. Vui lòng không giả lập đường dẫn thanh toán.";
    if (msg === "Unauthorized") return "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại và thực hiện nạp tiền.";
    if (msg === "ZeroAmount") return "Số tiền giao dịch không hợp lệ.";
    if (msg === "SystemError") return "Lỗi kết nối cơ sở dữ liệu hệ thống.";
    if (msg.startsWith("Code_")) {
      const code = msg.replace("Code_", "");
      if (code === "24") return "Khách hàng đã chủ động hủy giao dịch thanh toán trên cổng VNPay.";
      if (code === "15") return "Giao dịch thất bại: Hủy hướng dẫn thanh toán.";
      return `Lỗi từ cổng thanh toán VNPay (Mã phản hồi: ${code}).`;
    }
    return "Giao dịch bị từ chối hoặc đã xảy ra lỗi trong quá trình xử lý.";
  };

  const isSuccess = status === "success";

  return (
    <div className="mx-auto max-w-lg w-full rounded-2xl border border-slate-800 bg-[#090e1c]/80 p-8 backdrop-blur-md text-center shadow-2xl relative overflow-hidden">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>

      {isSuccess ? (
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20 text-emerald-450 animate-bounce">
              <CheckCircle className="h-12 w-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-white">🎉 Thanh toán thành công!</h1>
            <p className="text-xs text-slate-400">Chúc mừng bạn đã nạp thành công PawCoin vào tài khoản.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-850/60 text-2xs text-slate-300">
            Hệ thống đã tự động cộng số dư PawCoins tương ứng vào ví của bạn. Bạn đã có thể đăng bài tuyển dụng, ứng tuyển, hoặc mua bán các công cụ marketing.
          </div>
          <div className="pt-4 flex gap-3 justify-center">
            <Link
              href="/profile"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-600/10 cursor-pointer"
            >
              <User className="h-4 w-4" />
              Về trang cá nhân
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-350 transition-all cursor-pointer"
            >
              Về Bảng tin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-rose-500/10 p-4 border border-rose-500/20 text-rose-455">
              <XCircle className="h-12 w-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-white">Giao dịch không thành công</h1>
            <p className="text-xs text-rose-400 font-semibold">{getErrorMessage(message)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-850/60 text-2xs text-slate-450 leading-relaxed">
            Nếu tài khoản của bạn đã bị trừ tiền nhưng số dư PawCoins chưa thay đổi, vui lòng liên hệ Ban quản trị để được đối soát giao dịch sớm nhất.
          </div>
          <div className="pt-4 flex gap-3 justify-center">
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 px-5 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại thanh toán
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-350 transition-all cursor-pointer"
            >
              Về Bảng tin
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingResultPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 flex items-center justify-center">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400">Đang truy vấn thông tin kết quả thanh toán...</p>
            </div>
          }
        >
          <PaymentResultContent />
        </Suspense>
      </main>
    </div>
  );
}
