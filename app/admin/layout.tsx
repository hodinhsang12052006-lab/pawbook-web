"use client";

import React from "react";
import Link from "next/link";
import { Shield, LayoutDashboard, Users, FileText, ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    {
      label: "Thống kê tổng quan",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: "Quản lý Thành viên",
      href: "/admin/users",
      icon: Users,
    },
    {
      label: "Quản lý Bài đăng",
      href: "/admin/jobs",
      icon: FileText,
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col justify-between">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="rounded-xl bg-blue-600/10 border border-blue-500/20 p-2 text-blue-500 shadow-md">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider uppercase">PawBook Boss</h2>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Admin Panel</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer ${
                    active
                      ? "bg-blue-600/10 border-blue-500/20 text-blue-400 font-bold shadow-md shadow-blue-500/5"
                      : "bg-transparent border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                  }`}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-850">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-800 bg-slate-950/40 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về Bảng Tin chính</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070a13]/40">
        <header className="h-16 border-b border-slate-800 bg-slate-950/40 backdrop-blur-md flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <span>Hệ thống Quản Trị Tối Cao</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              Live Connection
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
