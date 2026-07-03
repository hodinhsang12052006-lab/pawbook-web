"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, Briefcase, MapPin, DollarSign, Clock, Building, Sparkles, Send, ShieldCheck, Loader2, AlertCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;

    async function fetchJobDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error("Công việc tuyển dụng không tồn tại hoặc đã bị gỡ bỏ.");
        }
        const data = await res.json();

        // Inject detailed specs if missing from basic DB columns
        setJob({
          ...data,
          requirements: data.requirements || [
            "Có tối thiểu 2 năm kinh nghiệm thực chiến ở vị trí tương đương.",
            "Có tinh thần trách nhiệm cao, chịu được áp lực tiến độ sản phẩm.",
            "Kỹ năng giải quyết vấn đề tốt, khả năng tự nghiên cứu công nghệ mới.",
            "Kinh nghiệm làm việc nhóm tốt, giao tiếp cởi mở."
          ],
          responsibilities: data.responsibilities || [
            "Đảm nhận phân tích yêu cầu và phát triển tính năng sản phẩm.",
            "Viết code sạch, an toàn, có khả năng mở rộng tốt và viết unit test.",
            "Phối hợp với các phòng ban liên quan để liên kết hệ thống mượt mà."
          ],
          benefits: data.benefits || [
            "Mức lương hấp dẫn, thỏa thuận theo năng lực thực tế.",
            "Môi trường làm việc tự do sáng tạo, nói không với drama.",
            "Cơ hội thăng tiến rõ ràng lên Leader/Architect dự án mới."
          ]
        });
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetail();
  }, [jobId]);

  const handleApply = async () => {
    if (!jobId) return;
    setApplying(true);

    try {
      const defaultCvUrl = "https://pawbook.vn/cv/candidate_profile_default.pdf";

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          cvUrl: defaultCvUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Nộp đơn ứng tuyển thất bại.");
      } else {
        toast.success("Nộp CV thành công! Đã gửi hồ sơ trực tiếp đến HR.");
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi kết nối mạng. Vui lòng thử lại.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang tải thông tin chi tiết công việc...</p>
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-12 space-y-4">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || "Công việc tuyển dụng không khả dụng."}</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang chủ</span>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Bảng tin & Jobs</span>
          </Link>
        </div>

        {/* Job Header Info */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md relative overflow-hidden mb-6">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-3xs font-semibold text-blue-400 border border-blue-500/20">
                  <Sparkles className="h-3 w-3" />
                  Hot Job
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                {job.title}
              </h1>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-850 border border-slate-750">
                  <Building className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-slate-300">{job.companyName}</span>
              </div>

              {/* Meta metrics */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-450" />
                  <span className="text-emerald-400 font-bold text-sm">{job.salary}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Fulltime / Contract
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column details layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content descriptions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                Mô tả công việc
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-350">
                {job.description}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" />
                Yêu cầu công việc
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-350 list-disc list-inside">
                {job.requirements.map((req: string, idx: number) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Nhiệm vụ chính
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-350 list-disc list-inside">
                {job.responsibilities.map((resp: string, idx: number) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    {resp}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Quyền lợi được hưởng
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-350 list-disc list-inside">
                {job.benefits.map((ben: string, idx: number) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    {ben}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quick Apply panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md space-y-5 sticky top-24">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Nộp Hồ Sơ Ứng Tuyển</h4>
                <p className="text-3xs text-slate-500 mt-1">
                  Đơn ứng tuyển của bạn sẽ được gửi trực tiếp kèm file CV lưu trữ trong Profile của bạn.
                </p>
              </div>

              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all duration-200"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang gửi hồ sơ...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Nộp CV ứng tuyển ngay</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (job.employerId) {
                    window.location.href = `/messages?userId=${job.employerId}`;
                  } else {
                    toast.error("Không tìm thấy thông tin nhà tuyển dụng.");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 py-3 text-xs font-semibold text-slate-200 transition-all duration-200"
              >
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <span>Chat trực tiếp với HR</span>
              </button>

              <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-850 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-3xs text-slate-500 leading-relaxed">
                  Bảo mật thông tin: PawBook cam kết không tiết lộ thông tin cá nhân hay số điện thoại của bạn cho bên thứ ba ngoài Nhà tuyển dụng trực tiếp đăng tin này.
                </p>
              </div>

              <div className="border-t border-slate-850 pt-4 space-y-3">
                <span className="block text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                  Về nhà tuyển dụng
                </span>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-200">{job.companyName}</h5>
                  <p className="text-3xs text-slate-550 leading-relaxed">
                    Startup công nghệ hàng đầu chuyên cung cấp giải pháp Marketing, Automation Tooling và các dịch vụ nền tảng số.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
    </div>
  );
}
