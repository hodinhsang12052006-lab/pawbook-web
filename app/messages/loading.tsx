import React from "react";
import Navbar from "@/components/layout/Navbar";

export default function MessagesLoading() {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-slate-950 text-slate-100 select-none animate-pulse">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Skeleton */}
        <div className="w-full md:w-[30%] border-r border-slate-850 flex flex-col h-full bg-slate-955/20">
          <div className="p-4 border-b border-slate-850 space-y-4 flex-shrink-0">
            <div className="h-4 w-1/2 bg-slate-800 rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-8 bg-slate-900 rounded-xl" />
              <div className="h-8 bg-slate-900 rounded-xl" />
            </div>
            <div className="h-8 bg-slate-900 rounded-xl" />
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-800 rounded w-2/3" />
                  <div className="h-2 bg-slate-900 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Main Chat Window Skeleton */}
        <div className="hidden md:flex flex-1 flex-col h-full bg-slate-900">
          <div className="p-4 border-b border-slate-855 bg-slate-950/30 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-800" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-800 rounded w-32" />
                <div className="h-2 bg-slate-850 rounded w-48" />
              </div>
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-b from-[#0f172a] to-[#1e293b] p-6 space-y-6 flex flex-col justify-center items-center">
            <div className="h-12 w-12 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
            <p className="text-2xs text-slate-550 mt-3 font-semibold animate-pulse">Đang kết nối cổng dữ liệu chat...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
