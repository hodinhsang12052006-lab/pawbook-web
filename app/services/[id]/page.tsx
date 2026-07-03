"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, MapPin, Phone, Star, Sparkles, Building, Mail, User, ShieldAlert, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ServiceDetailPage({ params }: PageProps) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    params.then((p) => setServiceId(p.id));
  }, [params]);

  useEffect(() => {
    if (!serviceId) return;

    async function fetchServiceDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/services/${serviceId}`);
        if (!res.ok) {
          throw new Error("Không thể tải thông tin dịch vụ này.");
        }
        const data = await res.json();
        setService(data);
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }

    fetchServiceDetail();
  }, [serviceId]);

  // Determine appropriate banner image based on category if imageUrl is empty
  const getBannerImage = (category: string, url?: string | null) => {
    if (url) return url;
    const catLower = (category || "").toLowerCase();
    if (catLower.includes("spa") || catLower.includes("làm đẹp")) {
      return "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&auto=format&fit=crop&q=80";
    }
    if (catLower.includes("điện") || catLower.includes("máy") || catLower.includes("lạnh")) {
      return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&auto=format&fit=crop&q=80";
    }
    if (catLower.includes("xây") || catLower.includes("dựng") || catLower.includes("sơn")) {
      return "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&auto=format&fit=crop&q=80";
    }
    return "https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=1200&auto=format&fit=crop&q=80";
  };

  const handleContactClick = () => {
    setShowContact(true);
    toast.success("Thông tin liên hệ đã hiển thị!");
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang tải thông tin gian hàng...</p>
        </main>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-12 space-y-4">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || "Cửa hàng/Dịch vụ không tồn tại hoặc đã tạm dừng hoạt động."}</span>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh bạ dịch vụ</span>
          </Link>
        </main>
      </div>
    );
  }

  const rating = service.rating || 5.0;
  const priceRange = service.priceRange || "Liên hệ báo giá";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Danh bạ Dịch vụ</span>
          </Link>
        </div>

        {/* Store Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-64 sm:h-80 w-full mb-6">
          <img
            src={getBannerImage(service.category, service.imageUrl)}
            alt={service.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent"></div>

          {/* Banner Overlaid Text */}
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-2 py-0.5 text-3xs font-semibold text-white">
                <Sparkles className="h-3 w-3" />
                {service.category}
              </span>
              <div className="flex items-center gap-1 text-xs text-yellow-450 bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
                <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-yellow-400">{rating.toFixed(1)}</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-md">
              {service.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 drop-shadow">
              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
              {service.location}
            </p>
          </div>
        </div>

        {/* Dynamic Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Descriptions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" />
                Giới thiệu dịch vụ
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-350 whitespace-pre-wrap">
                {service.description}
              </p>
            </div>

            {/* Price Table / Estimation */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
                <Star className="h-4 w-4 text-emerald-500" />
                Bảng giá & Chi phí tham khảo
              </h3>
              <div className="rounded-xl bg-slate-950/40 p-4 border border-slate-850 flex items-center justify-between gap-3">
                <div>
                  <p className="text-3xs text-slate-500 uppercase font-semibold">Khung giá dao động</p>
                  <p className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">{priceRange}</p>
                </div>
                <span className="text-3xs text-slate-550 leading-relaxed max-w-[200px] text-right">
                  Mức giá mang tính chất tham khảo, vui lòng liên hệ trực tiếp chủ cửa hàng để có báo giá chuẩn xác nhất.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Contact Panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md space-y-5 sticky top-24">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Liên Hệ Đặt Dịch Vụ</h4>
                <p className="text-3xs text-slate-500 mt-1">
                  Kết nối trực tiếp với đại diện chủ gian hàng để được tư vấn tận tình.
                </p>
              </div>

              {!showContact ? (
                <button
                  onClick={handleContactClick}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
                >
                  <Phone className="h-4 w-4" />
                  <span>Hiển thị thông tin liên hệ</span>
                </button>
              ) : (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850 space-y-3 animate-fadeIn">
                  <span className="block text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                    Thông tin liên hệ
                  </span>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="h-4 w-4 text-emerald-450" />
                      <span className="font-semibold text-slate-200">{service.contactInfo || "Chưa cập nhật SĐT"}</span>
                    </div>
                    {service.owner?.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="h-4 w-4 text-blue-450" />
                        <span className="text-slate-350 truncate">{service.owner.email}</span>
                      </div>
                    )}
                    {service.owner?.name && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-4 w-4 text-indigo-455" />
                        <span className="text-slate-350">Chủ tiệm: {service.owner.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (service.ownerId) {
                    window.location.href = `/messages?userId=${service.ownerId}`;
                  } else {
                    toast.error("Không tìm thấy thông tin chủ cửa hàng.");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 py-3 text-xs font-semibold text-slate-200 transition-all duration-200"
              >
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <span>Chat trực tiếp với Chủ tiệm</span>
              </button>

              <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-850 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-3xs text-slate-550 leading-relaxed">
                  Lưu ý: Mọi giao dịch, thanh toán hay thỏa thuận thi công dịch vụ bên ngoài hoàn toàn thuộc trách nhiệm giữa hai bên. Hãy kiểm tra uy tín trước khi đặt hàng.
                </p>
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
