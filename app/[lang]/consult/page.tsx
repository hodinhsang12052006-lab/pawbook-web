"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import Navbar from "@/components/layout/Navbar";
import HandConsult from "@/components/consult/HandConsult";
import { useSessionUser } from "@/lib/SessionUserContext";

// /consult — "Phân tích tay & móng": công cụ của THỢ / CHỦ TIỆM. Khách (và người chưa đăng nhập) được đưa sang
// /tryon — thử mẫu trên tay mình — thay vì đọc trang công cụ bán hàng viết cho thợ.
export default function ConsultPage() {
  const router = useRouter();
  const { user, loading } = useSessionUser();
  const pro = user?.role === "TECHNICIAN" || user?.role === "OWNER" || user?.role === "ADMIN";
  useEffect(() => {
    if (!loading && !pro) router.replace(localeHref("/tryon"));
  }, [loading, pro, router]);
  if (loading || !pro) return <div className="min-h-screen" aria-busy="true" />;
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:pb-12">
        <HandConsult />
      </main>
    </div>
  );
}
