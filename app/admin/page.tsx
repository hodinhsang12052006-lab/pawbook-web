"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { Users, Briefcase, Coins, Store, ShieldAlert, Trash2, UserCheck, Loader2, Sparkles, CheckCircle, XCircle } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    metrics: { totalUsers: 0, totalEmployers: 0, totalJobs: 0, totalPawCoins: 0 },
    users: [],
    services: []
  });
  const [activeTab, setActiveTab] = useState<"users" | "services">("users");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast.error("Không thể tải thông tin quản trị. Có thể bạn không phải ADMIN.");
      }
    } catch (err) {
      toast.error("Lỗi mạng khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleBanUser = async (userId: string) => {
    if (!confirm("Bạn có chắc chắn muốn khóa/ban tài khoản người dùng này và hạ uy tín về 0?")) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "Đã ban tài khoản thành công!");
        // Refresh local data
        fetchAdminData();
      } else {
        toast.error(result.error || "Gặp lỗi khi ban tài khoản.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa gian hàng dịch vụ này vĩnh viễn khỏi nền tảng?")) return;
    setActionLoading(serviceId);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "Đã xóa gian hàng thành công!");
        // Refresh local data
        fetchAdminData();
      } else {
        toast.error(result.error || "Gặp lỗi khi xóa gian hàng.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Banner header */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/10 p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-blue-500/5 blur-3xl"></div>
          <div className="absolute left-1/3 bottom-0 h-32 w-32 translate-y-8 rounded-full bg-purple-500/5 blur-2xl"></div>

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-2xs font-semibold text-purple-400 border border-purple-500/20">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Admin Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Super Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Trang Tổng Tham Mưu vận hành, giám sát tài chính tiền tệ PawCoin và kiểm duyệt các chỉ số an toàn hệ sinh thái PawBook.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400">Đang tải chỉ số hệ sinh thái...</p>
          </div>
        ) : (
          <>
            {/* Overview widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="rounded-2xl border border-slate-850 bg-slate-900/15 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-3xs font-semibold uppercase tracking-wider text-slate-500">Tổng Thành Viên</span>
                  <span className="text-lg sm:text-xl font-bold text-white mt-1 block">{data.metrics.totalUsers}</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-slate-850 bg-slate-900/15 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-3xs font-semibold uppercase tracking-wider text-slate-500">Doanh Nghiệp (HR)</span>
                  <span className="text-lg sm:text-xl font-bold text-white mt-1 block">{data.metrics.totalEmployers}</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-slate-850 bg-slate-900/15 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-3xs font-semibold uppercase tracking-wider text-slate-500">Tổng Tin Tuyển Dụng</span>
                  <span className="text-lg sm:text-xl font-bold text-white mt-1 block">{data.metrics.totalJobs}</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl border border-slate-850 bg-slate-900/15 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Coins className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <span className="block text-3xs font-semibold uppercase tracking-wider text-slate-500">Coin Lưu Thông</span>
                  <span className="text-lg sm:text-xl font-bold text-amber-400 mt-1 block flex items-center gap-1">
                    {data.metrics.totalPawCoins} <span className="text-4xs text-slate-400">PC</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Controls Tabs */}
            <div className="space-y-4">
              <div className="border-b border-slate-850 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`pb-3 text-xs sm:text-sm font-bold border-b-2 px-2 transition-all cursor-pointer ${activeTab === "users" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                  >
                    Quản Lý Thành Viên ({data.users.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("services")}
                    className={`pb-3 text-xs sm:text-sm font-bold border-b-2 px-2 transition-all cursor-pointer ${activeTab === "services" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                  >
                    Kiểm Duyệt Gian Hàng ({data.services.length})
                  </button>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="text-4xs font-bold text-slate-500 hover:text-slate-300 border border-slate-800 rounded-md px-2 py-1 bg-slate-950 cursor-pointer"
                >
                  Làm mới dữ liệu
                </button>
              </div>

              {/* Tab 1: User List */}
              {activeTab === "users" && (
                <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-900/10 backdrop-blur-sm">
                  <table className="w-full text-left border-collapse text-3xs sm:text-xs">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 bg-slate-950/40">
                        <th className="p-4 font-semibold">Tên / Email</th>
                        <th className="p-4 font-semibold">Vai Trò</th>
                        <th className="p-4 font-semibold text-center">Tích Xanh</th>
                        <th className="p-4 font-semibold text-center">Điểm Tín Nhiệm</th>
                        <th className="p-4 font-semibold text-right">Ví Coin</th>
                        <th className="p-4 font-semibold text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {data.users.map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-900/20 transition-all">
                          <td className="p-4">
                            <div className="font-semibold text-slate-200">{u.name}</div>
                            <div className="text-slate-500 text-4xs">{u.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-4xs font-bold border ${u.role === "ADMIN" ? "bg-rose-500/10 border-rose-500/20 text-rose-450" : u.role === "EMPLOYER" ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {u.isVerified ? (
                              <CheckCircle className="h-4.5 w-4.5 text-blue-500 mx-auto fill-blue-500/15" />
                            ) : (
                              <XCircle className="h-4.5 w-4.5 text-slate-650 mx-auto" />
                            )}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-200">
                            {u.trustScore.toFixed(1)} / 5.0
                          </td>
                          <td className="p-4 text-right font-semibold text-amber-450">
                            {u.pawCoin} PC
                          </td>
                          <td className="p-4 text-center">
                            {u.role === "ADMIN" ? (
                              <span className="text-slate-600 text-4xs italic">Protected</span>
                            ) : u.trustScore === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-red-950/30 text-red-500 border border-red-900/30 px-2 py-0.5 text-4xs font-bold">
                                🚫 Đã Bị Khóa
                              </span>
                            ) : (
                              <button
                                onClick={() => handleBanUser(u.id)}
                                disabled={actionLoading === u.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-white transition-all cursor-pointer text-4xs font-semibold disabled:opacity-50"
                              >
                                {actionLoading === u.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldAlert className="h-3 w-3" />
                                )}
                                <span>Khóa / Ban</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Service List */}
              {activeTab === "services" && (
                <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-900/10 backdrop-blur-sm">
                  <table className="w-full text-left border-collapse text-3xs sm:text-xs">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 bg-slate-950/40">
                        <th className="p-4 font-semibold">Tên Gian Hàng</th>
                        <th className="p-4 font-semibold">Phân Loại</th>
                        <th className="p-4 font-semibold">Địa Chỉ</th>
                        <th className="p-4 font-semibold">Chủ Cửa Hàng</th>
                        <th className="p-4 font-semibold text-center">Đánh Giá</th>
                        <th className="p-4 font-semibold text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {data.services.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-900/20 transition-all">
                          <td className="p-4">
                            <div className="font-semibold text-slate-200">{s.name}</div>
                            <div className="text-slate-500 text-4xs max-w-xs truncate">{s.description}</div>
                          </td>
                          <td className="p-4 text-slate-300">
                            {s.category}
                          </td>
                          <td className="p-4 text-slate-400">
                            {s.location}
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-slate-200">{s.owner?.name}</div>
                            <div className="text-slate-500 text-4xs">{s.owner?.email}</div>
                          </td>
                          <td className="p-4 text-center font-bold text-amber-450">
                            ★ {s.rating.toFixed(1)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteService(s.id)}
                              disabled={actionLoading === s.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-white transition-all cursor-pointer text-4xs font-semibold disabled:opacity-50"
                            >
                              {actionLoading === s.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              <span>Xóa Tiệm</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Authorized super administrator access only.</p>
      </footer>
    </div>
  );
}
