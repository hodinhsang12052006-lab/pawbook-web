"use client";

import React from "react";
import { X, MapPin } from "lucide-react";
import toast from "react-hot-toast";

interface BitpawMiniAppProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BitpawMiniApp({ isOpen, onClose }: BitpawMiniAppProps) {
  if (!isOpen) return null;

  const handleCheckIn = () => {
    toast.success("✅ Đã chấm công thành công", {
      icon: "👆",
      style: {
        background: "#0f172a",
        border: "1px solid #10b981",
        color: "#10b981",
        fontSize: "12px",
        fontWeight: "bold"
      }
    });
    onClose();
  };

  return (
    <>
      {/* Black Overlay */}
      <div 
        className="bg-black/50 fixed inset-0 z-40 cursor-pointer" 
        onClick={onClose}
      />
      
      {/* Sliding bottom sheet container */}
      <div className="fixed bottom-0 inset-x-0 h-[75vh] bg-slate-50 dark:bg-slate-900 rounded-t-3xl shadow-2xl z-50 p-4 flex flex-col transform transition-transform">
        {/* Decorative Drag Handle */}
        <div className="w-12 h-1 bg-slate-355 dark:bg-slate-700 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Bitpaw HR - Cổng Chấm Công
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mock Iframe Simulator Body */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
          {/* Prepared Secure Iframe container for future implementation */}
          <iframe
            allow="camera; geolocation; microphone"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            src="https://your-bitpaw-domain.com/mini-app?token=MOCK_JWT_TOKEN_USER_123"
            className="hidden w-full h-full border-none rounded-b-3xl"
          />

          {/* GPS Icon Simulation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-md">
              <MapPin className="h-8 w-8" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-750 dark:text-slate-300 flex items-center justify-center gap-1.5 animate-pulse">
              <span>📍 Đang lấy tọa độ...</span>
            </p>
            <p className="text-xs text-slate-550 dark:text-slate-450 max-w-xs">
              Hệ thống đang đồng bộ định vị GPS của bạn để thực hiện check-in vào ca làm việc.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCheckIn}
            className="w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-98 hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
          >
            <span>👆 CHẠM ĐỂ CHẤM CÔNG</span>
          </button>
          
          {/* Security Status Indicator */}
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-2 select-none flex items-center gap-1">
            <span>🔐</span>
            <span>Đã cấp quyền GPS/Camera & Token Auth</span>
          </div>
        </div>
      </div>
    </>
  );
}
