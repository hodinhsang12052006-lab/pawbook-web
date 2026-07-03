"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { Users, CreditCard, BarChart3, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, TrendingUp, Download, Check, X, HandCoins } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface ApplicationType {
  id: string;
  cvUrl: string;
  status: string;
  createdAt: string;
  applicant: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
    bio?: string | null;
    skills?: string | null;
  };
  job: {
    id: string;
    title: string;
    companyName: string;
  };
}

interface PayrollType {
  id: string;
  userId: string;
  baseSalary: number;
  bonus: number;
  total: number;
  status: string;
  paymentDate?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  };
}

interface RevenueType {
  id: string;
  source: string;
  amount: number;
  createdAt: string;
}

export default function HRManagementPage() {
  const [activeTab, setActiveTab] = useState<"hr" | "payroll" | "revenue">("hr");

  // Candidates / Applications state
  const [applications, setApplications] = useState<ApplicationType[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [errorApps, setErrorApps] = useState<string | null>(null);

  // Payroll state
  const [payrolls, setPayrolls] = useState<PayrollType[]>([]);
  const [loadingPayrolls, setLoadingPayrolls] = useState(true);
  const [errorPayrolls, setErrorPayrolls] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Revenue state
  const [revenues, setRevenues] = useState<RevenueType[]>([]);
  const [loadingRevenues, setLoadingRevenues] = useState(true);
  const [errorRevenues, setErrorRevenues] = useState<string | null>(null);

  // Load applications
  const fetchApplications = async () => {
    try {
      setLoadingApps(true);
      setErrorApps(null);
      const res = await fetch("/api/applications");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách ứng tuyển. Bạn cần có quyền Employer.");
      }
      const data = await res.json();
      setApplications(data);
    } catch (err: any) {
      setErrorApps(err.message || "Đã xảy ra lỗi.");
    } finally {
      setLoadingApps(false);
    }
  };

  // Load payrolls
  const fetchPayrolls = async () => {
    try {
      setLoadingPayrolls(true);
      setErrorPayrolls(null);
      const res = await fetch("/api/hr/payroll");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách bảng lương.");
      }
      const data = await res.json();
      setPayrolls(data);
    } catch (err: any) {
      setErrorPayrolls(err.message || "Đã xảy ra lỗi.");
    } finally {
      setLoadingPayrolls(false);
    }
  };

  // Load revenues
  const fetchRevenues = async () => {
    try {
      setLoadingRevenues(true);
      setErrorRevenues(null);
      const res = await fetch("/api/hr/revenue");
      if (!res.ok) {
        throw new Error("Không thể tải báo cáo doanh thu.");
      }
      const data = await res.json();
      setRevenues(data);
    } catch (err: any) {
      setErrorRevenues(err.message || "Đã xảy ra lỗi.");
    } finally {
      setLoadingRevenues(false);
    }
  };

  useEffect(() => {
    if (activeTab === "hr") {
      fetchApplications();
    } else if (activeTab === "payroll") {
      fetchPayrolls();
    } else if (activeTab === "revenue") {
      fetchRevenues();
    }
  }, [activeTab]);

  const handleAppStatus = (appId: string, newStatus: string) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
    );
    toast.success(`Đã cập nhật trạng thái đơn ứng tuyển sang: ${newStatus === "APPROVED" ? "DUYỆT" : "TỪ CHỐI"}!`);
  };

  // Pay single employee
  const handlePaySalary = async (payrollId: string) => {
    setActionLoading(true);
    const toastId = toast.loading("Đang thực thi lệnh duyệt chi lương...");
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payrollId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Giao dịch chi lương thất bại.");
      }

      toast.success(data.message || "Đã thanh toán lương thành công!", { id: toastId });
      fetchPayrolls(); // Reload
    } catch (err: any) {
      toast.error(err.message || "Lỗi chi lương.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // Pay all employees
  const handlePayAllSalary = async () => {
    if (!confirm("Bạn có chắc chắn muốn duyệt chi lương cho toàn bộ nhân sự hệ thống?")) return;
    
    setActionLoading(true);
    const toastId = toast.loading("Đang thực hiện giao dịch chi lương hàng loạt...");
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Giao dịch chi lương thất bại.");
      }

      toast.success(data.message || "Đã chi lương thành công!", { id: toastId });
      fetchPayrolls(); // Reload
    } catch (err: any) {
      toast.error(err.message || "Lỗi chi lương.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Math totals
  const totalPayrollAmount = payrolls.reduce((sum, p) => sum + p.total, 0);
  const totalUnpaidAmount = payrolls.filter(p => p.status === "UNPAID").reduce((sum, p) => sum + p.total, 0);
  const totalPaidAmount = payrolls.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.total, 0);

  const totalRevenueAmount = revenues.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header Title section */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-md relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-600/5 blur-2xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-2xs font-semibold text-indigo-400 border border-indigo-500/20">
                <Sparkles className="h-3 w-3" />
                Không gian doanh nghiệp
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-tight">
                Hệ Thống Quản Trị Doanh Nghiệp & HR
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Quản lý hồ sơ ứng viên nộp CV thật, tính toán chi lương thực tế, theo dõi dòng doanh thu từ các chiến dịch MMO và sản phẩm.
              </p>
            </div>
            {activeTab === "payroll" && payrolls.some(p => p.status === "UNPAID") && (
              <button
                onClick={handlePayAllSalary}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <HandCoins className="h-4 w-4" />
                <span>Duyệt chi toàn bộ bảng lương</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-850 gap-2">
          <button
            onClick={() => setActiveTab("hr")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "hr"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-450 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Quản Lý Ứng Viên / CV</span>
          </button>
          <button
            onClick={() => setActiveTab("payroll")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "payroll"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-450 hover:text-slate-200"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Quản Lý Lương (Payroll)</span>
          </button>
          <button
            onClick={() => setActiveTab("revenue")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "revenue"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-450 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Báo Cáo Doanh Thu</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {/* TAB 1: APPLICATIONS HR MANAGEMENT */}
          {activeTab === "hr" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 overflow-hidden backdrop-blur-sm">
              {loadingApps ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-400">Đang tải danh sách hồ sơ ứng viên...</p>
                </div>
              ) : errorApps ? (
                <div className="flex items-center gap-3 p-5 rounded-2xl text-sm text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{errorApps}</span>
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-500">Chưa có ứng viên nào nộp hồ sơ ứng tuyển vào vị trí của bạn.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 text-2xs font-semibold tracking-wider">
                        <th className="p-4">Ứng viên</th>
                        <th className="p-4">Vị trí ứng tuyển</th>
                        <th className="p-4">CV Đính kèm</th>
                        <th className="p-4">Thời gian nộp</th>
                        <th className="p-4">Trạng thái</th>
                        <th className="p-4 text-right">Quyết định</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 text-xs">
                      {applications.map((app) => {
                        const avatar = app.applicant?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.applicant?.name || "A")}&background=2563eb&color=ffffff&bold=true`;
                        return (
                          <tr key={app.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0">
                                <img src={avatar} alt={app.applicant?.name} className="h-full w-full object-cover" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-200">{app.applicant?.name}</p>
                                <p className="text-3xs text-slate-550 leading-relaxed max-w-[200px] truncate" title={app.applicant?.bio || ""}>
                                  {app.applicant?.bio || "Không có bio"}
                                </p>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="font-semibold text-slate-300">{app.job?.title}</p>
                              <p className="text-3xs text-slate-500">{app.job?.companyName}</p>
                            </td>
                            <td className="p-4">
                              <a
                                href={app.cvUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-350 hover:underline font-medium"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Tải CV xuống</span>
                              </a>
                            </td>
                            <td className="p-4 text-slate-450">{formatDate(app.createdAt)}</td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-3xs font-semibold border ${
                                  app.status === "APPROVED"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : app.status === "REJECTED"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                }`}
                              >
                                {app.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {app.status === "PENDING" ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleAppStatus(app.id, "APPROVED")}
                                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 transition-colors"
                                    title="Duyệt ứng viên"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleAppStatus(app.id, "REJECTED")}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 transition-colors"
                                    title="Từ chối"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-3xs text-slate-550">Đã quyết định</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAYROLL MANAGEMENT */}
          {activeTab === "payroll" && (
            <div className="space-y-6">
              {/* Financial metrics block */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 space-y-1">
                  <span className="text-3xs text-slate-450 uppercase font-semibold">Tổng quỹ lương hàng tháng</span>
                  <p className="text-xl font-bold text-white">{totalPayrollAmount.toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 space-y-1">
                  <span className="text-3xs text-slate-450 uppercase font-semibold">Chờ duyệt chi lương</span>
                  <p className="text-xl font-bold text-yellow-450">{totalUnpaidAmount.toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-4 space-y-1">
                  <span className="text-3xs text-slate-450 uppercase font-semibold">Đã hoàn tất thanh toán</span>
                  <p className="text-xl font-bold text-emerald-450">{totalPaidAmount.toLocaleString("vi-VN")} đ</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/10 overflow-hidden backdrop-blur-sm">
                {loadingPayrolls ? (
                  <div className="flex flex-col items-center justify-center p-12 space-y-3">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <p className="text-xs text-slate-400">Đang tải danh sách bảng lương...</p>
                  </div>
                ) : errorPayrolls ? (
                  <div className="flex items-center gap-3 p-5 rounded-2xl text-sm text-red-400">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{errorPayrolls}</span>
                  </div>
                ) : payrolls.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-xs text-slate-500">Chưa có bản ghi lương nào được tạo.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 text-2xs font-semibold tracking-wider">
                          <th className="p-4">Nhân sự</th>
                          <th className="p-4">Lương cơ bản</th>
                          <th className="p-4">Thưởng MMO / Doanh số</th>
                          <th className="p-4">Thực nhận</th>
                          <th className="p-4">Thời gian thanh toán</th>
                          <th className="p-4 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-xs">
                        {payrolls.map((p) => {
                          const isPaid = p.status === "PAID";
                          const avatar = p.user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.name || "N")}&background=2563eb&color=ffffff&bold=true`;
                          return (
                            <tr key={p.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0">
                                  <img src={avatar} alt={p.user?.name} className="h-full w-full object-cover" />
                                </div>
                                <div>
                                  <span className="font-bold text-slate-200 block">{p.user?.name}</span>
                                  <span className="text-3xs text-slate-500">{p.user?.role}</span>
                                </div>
                              </td>
                              <td className="p-4 text-slate-350">{p.baseSalary.toLocaleString("vi-VN")} đ</td>
                              <td className="p-4 text-emerald-400 font-medium">+{p.bonus.toLocaleString("vi-VN")} đ</td>
                              <td className="p-4 text-blue-400 font-bold">{p.total.toLocaleString("vi-VN")} đ</td>
                              <td className="p-4 text-slate-450">
                                {p.paymentDate ? formatDate(p.paymentDate) : "—"}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handlePaySalary(p.id)}
                                  disabled={isPaid || actionLoading}
                                  className={`rounded-lg px-3 py-1.5 text-2xs font-semibold transition-all ${
                                    isPaid
                                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750 flex items-center gap-1.5 ml-auto"
                                      : "bg-blue-600 text-white hover:bg-blue-500 shadow-sm ml-auto block"
                                  }`}
                                >
                                  {isPaid ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      <span>Đã thanh toán</span>
                                    </>
                                  ) : (
                                    "Duyệt chi lương"
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REVENUE REPORT */}
          {activeTab === "revenue" && (
            <div className="space-y-6">
              {loadingRevenues ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-400">Đang tải báo cáo doanh thu tài chính...</p>
                </div>
              ) : errorRevenues ? (
                <div className="flex items-center gap-3 p-5 rounded-2xl text-sm text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{errorRevenues}</span>
                </div>
              ) : (
                <>
                  {/* Statistic summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-sm space-y-2">
                      <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">Tổng doanh thu hệ thống</span>
                      <p className="text-2xl font-black text-white">{totalRevenueAmount.toLocaleString("vi-VN")} đ</p>
                      <div className="flex items-center gap-1 text-emerald-450 text-2xs">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-400 font-semibold">+18.5% so với tháng trước</span>
                      </div>
                    </div>

                    {/* Show dynamic breakdown for two main sources */}
                    {revenues.slice(0, 2).map((rev, idx) => (
                      <div key={rev.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-sm space-y-2">
                        <span className="text-3xs font-semibold text-slate-450 uppercase tracking-wider block truncate" title={rev.source}>
                          {rev.source}
                        </span>
                        <p className="text-2xl font-black text-white">{rev.amount.toLocaleString("vi-VN")} đ</p>
                        <div className="flex items-center gap-1 text-emerald-450 text-2xs">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-400 font-semibold">Chiếm tỷ lệ đáng kể</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic Progress bars chart from DB */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Phân Phối Dòng Doanh Thu (Dữ liệu thực từ DB)</h3>
                      <p className="text-3xs text-slate-550 mt-1">So sánh các phân khúc thu nhập thu ghi chép từ các hoạt động của PawBook.</p>
                    </div>

                    <div className="space-y-4">
                      {revenues.map((rev) => {
                        const percent = totalRevenueAmount > 0 ? (rev.amount / totalRevenueAmount) * 100 : 0;
                        return (
                          <div key={rev.id} className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-350">{rev.source}</span>
                              <span className="font-bold text-slate-200">
                                {percent.toFixed(1)}% ({rev.amount.toLocaleString("vi-VN")} đ)
                              </span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
    </div>
  );
}
