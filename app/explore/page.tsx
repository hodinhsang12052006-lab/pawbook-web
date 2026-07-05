"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Sparkles, MapPin, Loader2, AlertCircle } from "lucide-react";

// Load RadarMap dynamically with SSR disabled to avoid Leaflet window object errors
const RadarMap = dynamic(() => import("@/components/map/RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] w-full items-center justify-center rounded-2xl border border-slate-800 bg-[#070a13] text-xs text-slate-400">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
        <p>Đang tải bản đồ radar vệ tinh...</p>
      </div>
    </div>
  ),
});

interface JobType {
  id: string;
  title: string;
  companyName: string;
  salary: string;
  niche: string;
  latitude: number;
  longitude: number;
  is_premium?: boolean;
  employerId?: string;
  reviews?: any[];
  employer?: {
    isVerified?: boolean;
  };
  priceRange?: string | null;
  isEmergency?: boolean | null;
  vehicleInfo?: string | null;
  workType?: string | null;
}

export default function ExplorePage() {
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<string>("ALL");

  useEffect(() => {
    async function fetchRadarData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/radar");
        if (!res.ok) {
          throw new Error("Không thể kết nối đến máy chủ lấy dữ liệu bản đồ.");
        }
        const data = await res.json();
        setJobs(data);
      } catch (err: any) {
        setError(err.message || "Lỗi tải dữ liệu định vị.");
      } finally {
        setLoading(false);
      }
    }
    fetchRadarData();
  }, []);

  const handleLocationFound = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/radar?lat=${lat}&lng=${lng}&radius=10`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to fetch local radar data:", err);
    }
  };

  const niches = [
    { id: "ALL", label: "Tất cả ngành nghề" },
    { id: "IT", label: "💻 IT & Phần mềm" },
    { id: "MMO", label: "🚀 MMO & Airdrop" },
    { id: "SPA", label: "💅 Spa & Làm đẹp" },
    { id: "MECHANIC", label: "🔧 Sửa chữa & Cơ khí" },
    { id: "FNB", label: "☕ F&B / Ăn uống" },
  ];

  const filteredJobs = selectedNiche === "ALL" 
    ? jobs 
    : jobs.filter(j => j.niche === selectedNiche);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 mb-20 md:mb-0">
        <div className="flex flex-col gap-6 md:flex-row">
          <Sidebar />

          <div className="flex-1 space-y-6">
            {/* Header banner */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-2xs font-semibold text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Vị trí vệ tinh
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-tight flex items-center gap-2">
                <MapPin className="h-5.5 w-5.5 text-blue-500" />
                Bản đồ Radar: Tìm việc quanh đây
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Khám phá các dịch vụ địa phương và tin tuyển dụng thời vụ quanh khu vực của bạn. Nhấp vào điểm ghim để xem chi tiết và nộp đơn.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-900/20 border border-slate-800 rounded-xl backdrop-blur-sm">
              {niches.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNiche(n.id)}
                  className={`rounded-lg px-3 py-1.5 text-2xs font-bold transition-all cursor-pointer ${
                    selectedNiche === n.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                      : "bg-slate-900/60 text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>

            {/* Radar Map container */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-xs text-slate-400">Đang đồng bộ dữ liệu radar vệ tinh...</p>
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-slate-800 relative shadow-2xl">
                  <RadarMap jobs={filteredJobs} onLocationFound={handleLocationFound} />
                </div>
                <p className="text-4xs text-slate-500 text-right italic">
                  Đang hiển thị {filteredJobs.length} dịch vụ/tin tuyển dụng phù hợp trên bản đồ Việt Nam.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
