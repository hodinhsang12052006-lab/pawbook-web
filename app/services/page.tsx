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
  priceRange?: string | null;
  vehicleInfo?: string | null;
  isEmergency?: boolean | null;
  workType?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
    bio?: string | null;
    isVerified?: boolean;
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
  
  // AI assistant queries state
  const [aiQuery, setAiQuery] = useState("");

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

  const handleAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    const query = aiQuery.toLowerCase();
    let found = false;

    if (query.includes("máy lạnh") || query.includes("điện lạnh") || query.includes("vệ sinh")) {
      setSelectedCategory("Gia đình");
      found = true;
    } else if (query.includes("sửa") || query.includes("thợ") || query.includes("khóa")) {
      setSelectedCategory("Sửa chữa");
      found = true;
    } else if (query.includes("xe") || query.includes("chở") || query.includes("vận chuyển") || query.includes("grab")) {
      setSelectedCategory("Vận tải");
      found = true;
    } else if (query.includes("spa") || query.includes("làm đẹp") || query.includes("tỉa")) {
      setSelectedCategory("Spa");
      found = true;
    }

    if (found) {
      toast.success(`AI: Đã lọc ngành nghề phù hợp nhất cho "${aiQuery}"`);
    } else {
      toast.error(`AI: Chưa tìm thấy kết quả phù hợp cho "${aiQuery}". Hãy thử từ khóa khác!`);
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
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Global Navbar */}
      <Navbar />
      <Toaster position="top-center" />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left Sidebar */}
          <Sidebar />

          {/* Central Workspace: Split view Airbnb style */}
          <div className="flex-1">
            
            {/* Header banner info */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-md relative overflow-hidden mb-6">
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

            {/* Split Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (50%): AI search, Filters, List */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* AI Assistant Chat Box */}
                <div className="rounded-2xl border border-slate-850 bg-gradient-to-r from-blue-950/20 to-indigo-950/20 p-5 backdrop-blur-md relative overflow-hidden shadow-lg shadow-blue-950/5">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-xl"></div>
                  
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-450 animate-pulse" />
                    <span className="text-2xs font-extrabold uppercase tracking-widest text-blue-400">Trợ lý tìm kiếm AI</span>
                  </div>
                  
                  <h3 className="text-xs font-bold text-slate-350 mt-2">
                    Trợ lý AI: Bạn đang cần dịch vụ gì hôm nay?
                  </h3>
                  
                  <form onSubmit={handleAISubmit} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="Ví dụ: Tìm thợ vệ sinh máy lạnh cách 2km..."
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-550 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-blue-650 hover:bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center justify-center cursor-pointer hover:scale-105"
                    >
                      Tìm kiếm
                    </button>
                  </form>

                  {/* Quick Filters */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[
                      { label: "❄️ Điện lạnh", id: "DienLanh", category: "Gia đình" },
                      { label: "🔧 Sửa chữa", id: "SuaChua", category: "Sửa chữa" },
                      { label: "🧹 Vệ sinh", id: "VeSinh", category: "Gia đình" },
                      { label: "🛵 Vận chuyển", id: "VanChuyen", category: "Vận tải" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedCategory(item.category);
                          toast.success(`Đã lọc dịch vụ: ${item.label}`);
                        }}
                        className="rounded-lg px-2.5 py-1 text-4xs font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-slate-200 text-slate-400 transition-all cursor-pointer animate-fadeIn"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geo-filter Province Selector */}
                <div className="rounded-xl border border-slate-850 bg-slate-900/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4.5 w-4.5 text-blue-400" />
                    <span className="text-xs font-bold text-slate-350">Bộ lọc theo Tỉnh thành:</span>
                  </div>
                  <select
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(e.target.value)}
                    className="bg-slate-950/60 border border-slate-855 text-xs text-slate-205 rounded-lg py-1.5 px-3 focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    {provinces.map((prov) => (
                      <option key={prov.id} value={prov.id} className="bg-slate-950 text-slate-200">
                        {prov.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-900/20 border border-slate-850 p-4 rounded-xl backdrop-blur-sm">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-550" />
                    <input
                      type="search"
                      placeholder="Tìm kiếm live..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-850 rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-550 focus:border-blue-500 focus:outline-none"
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
                            ? "bg-blue-655 text-white"
                            : "bg-slate-900/60 text-slate-400 hover:bg-slate-850 hover:text-slate-250 border border-slate-850"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mock Nearby Services Section */}
                <div className="space-y-3">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Thợ & Cửa hàng quanh đây (Radar kết nối)</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { name: "Công ty Điện Lạnh A", distance: "Cách 2km", status: "Đang hoạt động", spec: "Bảo dưỡng máy lạnh, máy giặt", rating: 4.9, icon: "❄️", phone: "0901 234 567" },
                      { name: "Sửa Khóa Cấp Tốc Q3", distance: "Cách 500m", status: "Đang hoạt động", spec: "Làm khóa từ, mở khóa khẩn cấp", rating: 4.8, icon: "🔑", phone: "0912 345 678" },
                      { name: "Vận Tải Xanh Eco", distance: "Cách 1.2km", status: "Đang hoạt động", spec: "Giao hàng siêu tốc bằng xe máy điện", rating: 5.0, icon: "🛵", phone: "0934 567 890" }
                    ].map((mockSrv) => (
                      <div
                        key={mockSrv.name}
                        className="rounded-xl border border-slate-850 bg-slate-900/30 p-4 flex items-center justify-between gap-3 hover:border-blue-500/30 transition-all duration-300 backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-855 flex items-center justify-center text-xl">
                            {mockSrv.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-slate-200">{mockSrv.name}</h4>
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-extrabold uppercase border border-emerald-500/25">
                                {mockSrv.status}
                              </span>
                            </div>
                            <p className="text-4xs text-slate-400 mt-0.5 leading-relaxed">{mockSrv.spec}</p>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                              <span>📍 {mockSrv.distance}</span>
                              <span>•</span>
                              <span className="text-amber-500 font-bold">★ {mockSrv.rating}</span>
                            </div>
                          </div>
                        </div>
                        <a
                          href={`tel:${mockSrv.phone}`}
                          onClick={(e) => {
                            e.preventDefault();
                            toast.success(`Đang gọi điện E2EE kết nối đến ${mockSrv.name}...`);
                          }}
                          className="h-8 w-8 rounded-full bg-slate-950 hover:bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-450 hover:text-emerald-400 cursor-pointer transition-colors"
                          title="Gọi điện"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services Grid (Live Data from Database) */}
                <div className="space-y-3">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Danh bạ dịch vụ hệ thống</p>
                  
                  {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10 animate-pulse">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                      <p className="text-xs text-slate-400">Đang tải danh bạ cửa hàng...</p>
                    </div>
                  ) : error ? (
                    <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : filteredServices.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredServices.map((srv) => (
                        <div
                          key={srv.id}
                          className={`rounded-2xl border p-5 backdrop-blur-md flex flex-col justify-between gap-4 transition-all duration-300 ${
                            srv.isBoosted
                              ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 hover:bg-amber-550/10 shadow-lg shadow-amber-500/5"
                              : "border-slate-850 bg-slate-900/30 hover:border-blue-500/25 hover:bg-slate-900/40"
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
                                      className="text-xs sm:text-sm font-bold text-slate-200 hover:text-blue-400 cursor-pointer flex items-center gap-1"
                                    >
                                      <span>{srv.name}</span>
                                      {srv.owner?.isVerified && (
                                        <span className="text-blue-400" title="Tài khoản đã xác minh">💎</span>
                                      )}
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

                            {/* Extra specs */}
                            <div className="flex flex-wrap gap-1 text-[9px]">
                              {srv.priceRange && (
                                <span className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded border border-slate-700">
                                  💰 Giá: {srv.priceRange}
                                </span>
                              )}
                              {srv.isEmergency && (
                                <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/35 font-extrabold uppercase animate-pulse">
                                  🚨 Hỗ trợ 24/7
                                </span>
                              )}
                              {srv.vehicleInfo && (
                                <span className="bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/35 font-semibold">
                                  🚗 Xe: {srv.vehicleInfo}
                                </span>
                              )}
                              {srv.workType && (
                                <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/35 font-semibold">
                                  ⏱️ {srv.workType}
                                </span>
                              )}
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
                                         : "bg-gradient-to-r from-amber-600 to-yellow-600 border-amber-500 hover:from-amber-550 hover:to-yellow-555 text-white shadow-md shadow-amber-500/10"
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

              {/* Right Column (50%): Sticky Radar Map */}
              <div className="lg:col-span-6 lg:sticky lg:top-20 lg:h-[calc(100vh-120px)] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/10 backdrop-blur-md relative h-[450px] lg:h-[calc(100vh-120px)] shadow-2xl flex flex-col items-center justify-center overflow-hidden animate-fadeIn">
                {/* Radar Grid Backdrop */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-955 to-slate-950 z-0" />
                
                {/* Concentric Radar Rings */}
                <div className="absolute h-80 w-80 rounded-full border border-blue-500/10 flex items-center justify-center z-0">
                  <div className="h-60 w-60 rounded-full border border-blue-500/15 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-full border border-blue-500/20 flex items-center justify-center">
                      <div className="h-20 w-20 rounded-full border border-blue-500/25 flex items-center justify-center">
                        <div className="h-4 w-4 rounded-full bg-blue-500 animate-ping absolute" />
                        <div className="h-3 w-3 rounded-full bg-blue-500 relative z-10" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Radar Sweep Line */}
                <div 
                  className="absolute inset-0 z-0 origin-center bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full"
                  style={{
                    clipPath: "polygon(50% 50%, 100% 0, 100% 100%)",
                    animation: "radarSweep 5s linear infinite"
                  }}
                />

                {/* Crosshair coordinate lines */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-900/80 z-0" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-900/80 z-0" />

                {/* Active Pulsing Markers (Grab style ping animation) */}
                {[
                  { name: "Phạm Minh Hải", role: "Vận tải", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80", x: "25%", y: "30%" },
                  { name: "Lê Hoàng Nam", role: "Sửa chữa", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80", x: "70%", y: "45%" },
                  { name: "Trần Thị Mai", role: "Spa & Beauty", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80", x: "35%", y: "75%" },
                  { name: "Nguyễn Thùy Chi", role: "F&B Owner", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80", x: "65%", y: "25%" }
                ].map((worker) => (
                  <div
                    key={worker.name}
                    className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group/marker hover:z-20 transition-all duration-300"
                    style={{ left: worker.x, top: worker.y }}
                    onClick={() => toast.success(`📍 ${worker.name} (${worker.role}) đang online gần đây!`)}
                  >
                    {/* Glowing ring */}
                    <div className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping opacity-75" />
                    
                    {/* Outer border shape */}
                    <div className="h-10 w-10 rounded-full border-2 border-emerald-500 bg-slate-950 p-0.5 relative z-10 transition-transform duration-300 group-hover/marker:scale-120 group-hover/marker:border-blue-500">
                      <img
                        src={worker.avatar}
                        alt={worker.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    </div>

                    {/* Marker Info Card on Hover */}
                    <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-2xl w-40 opacity-0 invisible group-hover/marker:opacity-100 group-hover/marker:visible transition-all duration-300 z-30 pointer-events-none text-left">
                      <p className="text-3xs font-extrabold text-slate-200">{worker.name}</p>
                      <p className="text-[9px] text-slate-450 mt-0.5">{worker.role}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Đang trực tuyến</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Radar Title Overlay */}
                <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-slate-850 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                  <span className="flex items-center gap-1.5 text-2xs font-extrabold text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    BẢN ĐỒ RADAR KHU VỰC
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
      
      {/* Radar Sweeping Keyframes definition */}
      <style jsx global>{`
        @keyframes radarSweep {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
