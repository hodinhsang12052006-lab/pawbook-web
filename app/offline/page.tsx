"use client";

import { WifiOff, RefreshCw } from "lucide-react";

// Served by the service worker (next-pwa `fallbacks.document`, see
// next.config.ts) for any navigation request that fails purely because the
// device has no network — replaces the browser's generic native offline
// error page with something PawNail-branded. Deliberately self-contained
// (no Navbar/BottomNav, no data fetching) so it renders instantly from the
// precache with nothing that can itself fail while offline.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -top-24 -left-16 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[100px]" />
      <div className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm">
        <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-0.5 shadow-xl shadow-pink-950/30">
          <img src="/cho1.jpg" alt="PawNail Jobs" className="h-full w-full object-cover rounded-lg" />
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <WifiOff className="h-6 w-6 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-white">Bạn đang ngoại tuyến</h1>
          <p className="text-sm text-slate-400">
            Vui lòng kiểm tra kết nối mạng. Trang bạn cần sẽ tự tải lại ngay khi có mạng trở lại.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 px-6 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" /> Tải lại trang
        </button>
      </div>
    </div>
  );
}
