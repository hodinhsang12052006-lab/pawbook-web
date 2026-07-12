"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

export default function FomoPopup() {
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  if (pathname && pathname.startsWith("/messages")) {
    return null;
  }

  const events = [
    "👤 Nguyễn V*** vừa nộp CV cho vị trí ReactJS Developer",
    "🎉 Lê H*** vừa nhận một Gig trị giá $500",
    "🔥 Một nhà tuyển dụng đang xem profile của bạn",
    "🚀 Hoàng M*** vừa kiếm được +1,200 PawCoin từ Airdrop",
    "👤 Trần A*** vừa cập nhật Tích xanh & TrustScore lên 4.9",
    "⚡ Nguyễn T*** vừa đăng thầu Gig thiết kế UI/UX giá 5,000,000đ",
    "🎉 Spa P*** vừa phê duyệt đơn ứng tuyển của một ứng viên",
    "🔥 Có 24 Nhà tuyển dụng đang tìm hồ sơ ngách Next.js lúc này"
  ];

  useEffect(() => {
    // Show first popup after 4 seconds
    const initialTimeout = setTimeout(() => {
      const randomMsg = events[Math.floor(Math.random() * events.length)];
      setMessage(randomMsg);
      setVisible(true);

      // Hide after 5 seconds
      const hideTimeout = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(hideTimeout);
    }, 4000);

    // Set interval for subsequent popups every 15 seconds
    const interval = setInterval(() => {
      const randomMsg = events[Math.floor(Math.random() * events.length)];
      setMessage(randomMsg);
      setVisible(true);

      // Hide after 5 seconds
      setTimeout(() => setVisible(false), 5000);
    }, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[999] max-w-sm w-full bg-[#0a0f1d]/95 border border-blue-500/20 rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all duration-500 transform ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
          <Sparkles className="h-4 w-4 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-2xs font-semibold text-blue-400 uppercase tracking-wider">Hoạt động thời gian thực</p>
          <p className="text-xs text-slate-200 mt-1 leading-normal font-medium">{message}</p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
