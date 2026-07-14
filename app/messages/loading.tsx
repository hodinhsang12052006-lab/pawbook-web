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

        {/* Right Main Chat Window Skeleton — faint message-bubble shapes
            instead of a blocking spinner + "connecting..." text. This is only
            ever shown while the server component (app/messages/page.tsx) is
            doing its initial DB fetch; MessagesContent's own client-side chat
            switching never re-triggers this file. */}
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
          <div className="flex-1 p-6 space-y-4 flex flex-col justify-end overflow-hidden">
            <div className="h-8 w-2/5 bg-slate-800/60 rounded-2xl rounded-bl-sm" />
            <div className="h-8 w-1/3 bg-slate-800/60 rounded-2xl rounded-bl-sm" />
            <div className="h-8 w-2/5 self-end bg-blue-600/20 rounded-2xl rounded-tr-sm" />
            <div className="h-8 w-1/4 self-end bg-blue-600/20 rounded-2xl rounded-tr-sm" />
            <div className="h-8 w-1/3 bg-slate-800/60 rounded-2xl rounded-bl-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
