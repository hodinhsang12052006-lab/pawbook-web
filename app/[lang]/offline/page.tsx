"use client";

import "@/components/marketing/marketing.css";
import { WifiOff, RefreshCw } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Served by the service worker (next-pwa `fallbacks.document`, see
// next.config.ts) for any navigation request that fails purely because the
// device has no network — replaces the browser's generic native offline
// error page with something PawNail-branded. Deliberately self-contained
// (no Navbar/BottomNav, no data fetching) so it renders instantly from the
// precache with nothing that can itself fail while offline.
// v2: plum canvas, the B logo, one lacquer button — no blobs, no purple/indigo gradient.
export default function OfflinePage() {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-pn-canvas px-6 text-center">
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-5">
        <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-[0_0_0_1px_var(--color-pn-line-strong)]">
          <BrandLogo size={64} alt="PawNail" />
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
          <WifiOff className="h-5 w-5 text-amber-300" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-pn-text">{tr("Bạn đang ngoại tuyến", "You are offline")}</h1>
          <p className="text-[15px] leading-6 text-pn-text-2">
            {tr("Vui lòng kiểm tra kết nối mạng. Trang bạn cần sẽ tự tải lại ngay khi có mạng trở lại.", "Please check your connection. This page will reload automatically once you are back online.")}
          </p>
        </div>

        <button type="button" onClick={() => window.location.reload()} className="pn-btn pn-cta pn-cta--block">
          <RefreshCw className="h-4 w-4" aria-hidden />
          {tr("Tải lại trang", "Reload page")}
        </button>
      </div>
    </div>
  );
}
