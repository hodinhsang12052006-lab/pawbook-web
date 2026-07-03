"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Store, MapPin, Phone, Search, ArrowUpRight, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

interface ServiceType {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  contactInfo: string;
  rating?: number;
  ownerId: string;
  isBoosted?: boolean;
  owner?: {
    name: string;
  } | null;
}

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProvince, setSelectedProvince] = useState("TP. Hồ Chí Minh");
  const [sessionUser, setSessionUser] = useState<any>(null);

  const categories = [
    { id: "all", label: "Tất cả ngành nghề" },
    { id: "Vận tải", label: "🚕 Vận tải & Đặt xe" },
    { id: "Sửa chữa", label: "🛠️ Thợ & Sửa chữa" },
    { id: "Gia đình", label: "🧹 Dịch vụ gia đình" },
    { id: "Spa", label: "💅 Spa & Làm đẹp" },
    { id: "F&B", label: "☕ F&B & Quán ăn" },
  ];

  const provinces = [
    { id: "TP. Hồ Chí Minh", label: "📍 TP. Hồ Chí Minh" },
    { id: "Hà Nội", label: "📍 Hà Nội" },
    { id: "Đà Nẵng", label: "📍 Đà Nẵng" },
    { id: "Cần Thơ", label: "📍 Cần Thơ" },
    { id: "Hải Phòng", label: "📍 Hải Phòng" },
    { id: "Nha Trang", label: "📍 Nha Trang" },
    { id: "Huế", label: "📍 Huế" },
    { id: "Đà Lạt", label: "📍 Đà Lạt" },
    { id: "Vinh", label: "📍 Vinh" },
    { id: "Buôn Ma Thuột", label: "📍 Buôn Ma Thuột" },
    { id: "all", label: "🌍 Tất cả tỉnh thành" },
  ];

  const handleBoost = async (type: string, id: string) => {
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setServices((prev) =>
          prev.map((srv) => (srv.id === id ? { ...srv, isBoosted: true } : srv))
        );
        if (sessionUser) {
          setSessionUser((prev: any) => ({ ...prev, pawCoin: prev.pawCoin - 500 }));
        }
      } else {
        toast.error(data.error || "Không thể đẩy top cửa hàng.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    async function fetchServices() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/services?province=${encodeURIComponent(selectedProvince)}`);
        if (!res.ok) {
          throw new Error("Không thể tải danh sách dịch vụ cửa hàng.");
        }
        const data = await res.json();
        
        // Inject ratings mock value on dynamic database models
        const resolvedData = data.map((srv: any) => ({
          ...srv,
          rating: srv.rating || parseFloat((Math.random() * 0.5 + 4.5).toFixed(1)),
        }));
        
        setServices(resolvedData);
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, [selectedProvince]);

  // Filter logic on live data
  const filteredServices = services.filter((srv) => {
    const matchesSearch =
      srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" || srv.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Global Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left Sidebar */}
          <Sidebar />

          {/* Central Workspace */}
          <div className="flex-1 space-y-6">
            {/* Header info */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-6 -translate-y-6 rounded-full bg-blue-500/5 blur-2xl"></div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-2xs font-semibold text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3 w-3" />
                Danh bạ địa phương
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-tight">
                Danh Bạ Dịch Vụ & Cửa Hàng Địa Phương
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Nơi quảng bá và tìm kiếm các cửa hàng dịch vụ chất lượng: Spa, Vận tải xe ôm 0%, Gia đình, F&B, Sửa chữa... giúp kết nối doanh nghiệp địa phương với cộng đồng.
              </p>
            </div>

            {/* Geo-filter Province Selector */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-blue-400" />
                <span className="text-xs font-bold text-slate-300">Bộ lọc theo Tỉnh thành:</span>
              </div>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 text-xs text-slate-200 rounded-lg py-1.5 px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {provinces.map((prov) => (
                  <option key={prov.id} value={prov.id} className="bg-slate-950 text-slate-200">
                    {prov.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-900/20 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-550" />
                <input
                  type="search"
                  placeholder="Tìm kiếm dịch vụ, tên cửa hàng, địa điểm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-550 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Categories pills */}
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-lg px-3 py-1.5 text-2xs font-bold transition-all ${
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-900/60 text-slate-400 hover:bg-slate-850 hover:text-slate-250 border border-slate-800"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Services Grid & states */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-xs text-slate-400">Đang tải danh bạ cửa hàng...</p>
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredServices.map((srv) => (
                  <div
                    key={srv.id}
                    className={`rounded-2xl border p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all duration-300 ${
                      srv.isBoosted
                        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 hover:bg-amber-550/10 shadow-lg shadow-amber-500/5"
                        : "border-slate-800 bg-slate-900/30 hover:border-blue-500/25 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-blue-400">
                            <Store className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {srv.isBoosted && (
                                <span className="inline-flex items-center rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                                  TÀI TRỢ
                                </span>
                              )}
                              <h3
                                onClick={() => router.push(`/services/${srv.id}`)}
                                className="text-xs sm:text-sm font-bold text-slate-200 hover:text-blue-400 cursor-pointer"
                              >
                                {srv.name}
                              </h3>
                            </div>
                            <span className="inline-block mt-0.5 text-3xs font-semibold text-slate-400">
                              Ngành nghề: <span className="text-blue-400">{srv.category}</span>
                            </span>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/15">
                          <span className="text-3xs font-bold text-amber-500">★ {srv.rating}</span>
                        </div>
                      </div>

                      <p className="text-2xs sm:text-xs leading-relaxed text-slate-350 line-clamp-3">
                        {srv.description}
                      </p>
                    </div>

                    {/* Bottom contact info and address */}
                    <div className="border-t border-slate-850/60 pt-3 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-3xs text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{srv.location}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <a
                          href={`tel:${srv.contactInfo}`}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-350 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{srv.contactInfo}</span>
                        </a>

                        <div className="flex items-center gap-2">
                           {sessionUser && sessionUser.id === srv.ownerId && (
                             <button
                               onClick={() => handleBoost("service", srv.id)}
                               disabled={srv.isBoosted}
                               className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                                 srv.isBoosted
                                   ? "bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-default"
                                   : "bg-gradient-to-r from-amber-600 to-yellow-600 border-amber-500 hover:from-amber-550 hover:to-yellow-550 text-white shadow-md shadow-amber-500/10"
                               }`}
                             >
                               🚀 {srv.isBoosted ? "Đã Đẩy Top" : "Đẩy Top (500 Coin)"}
                             </button>
                           )}

                           <button
                             onClick={() => router.push(`/services/${srv.id}`)}
                             className="flex items-center gap-1 text-3xs font-bold text-slate-455 hover:text-white transition-colors"
                           >
                             <span>Vào gian hàng</span>
                             <ArrowUpRight className="h-3 w-3" />
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-slate-850 rounded-2xl bg-slate-900/10">
                <p className="text-xs text-slate-500">Không tìm thấy cửa hàng hoặc dịch vụ nào phù hợp với bộ lọc.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Toaster />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
    </div>
  );
}
