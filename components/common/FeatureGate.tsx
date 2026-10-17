"use client";

// Trang công cụ (Soi tay, Lịch hẹn…) khi khách CHƯA đăng nhập: trước đây chỉ 1 dòng chữ / 1 nút "Đăng nhập"
// → người lạ không hiểu được lợi ích gì, thoát luôn. Giờ cho thấy công cụ làm được gì (3 lợi ích cụ thể)
// rồi mới mời đăng ký miễn phí — "cho xem giá trị trước, xin thông tin sau".
import React from "react";
import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function FeatureGate({ icon: Icon, title, lead, points, path, loggedIn = false }: {
  icon: LucideIcon;
  title: string;
  lead: string;
  points: string[];
  path: string; // trang quay lại sau khi đăng nhập
  loggedIn?: boolean; // đã đăng nhập nhưng không đúng vai trò → không mời đăng ký lại
}) {
  useTr();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 ring-1 ring-white/10 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="relative text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-600/30">
          <Icon className="h-7 w-7 text-white" />
        </span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-white [text-wrap:balance]">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-300 [text-wrap:pretty]">{lead}</p>
      </div>
      <ul className="relative mx-auto mt-5 max-w-md space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] px-3.5 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06]">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {!loggedIn && (
        <div className="relative mx-auto mt-6 flex max-w-md flex-col gap-2.5">
          <Link href="/auth/register?role=technician" className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-pink-600/25 transition active:scale-[0.98]">
            {tr("Tạo tài khoản miễn phí — 60 giây", "Create a free account — 60 seconds")}
          </Link>
          <Link href={`/auth/login?callbackUrl=${encodeURIComponent(path)}`} className="text-center text-sm font-semibold text-slate-400 hover:text-white">
            {tr("Đã có tài khoản? ", "Already have an account? ")}<span className="text-pink-300">{tr("Đăng nhập", "Log in")}</span>
          </Link>
        </div>
      )}
    </section>
  );
}
