"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { Store, MapPin, Phone, Search, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import dynamic from "next/dynamic";

// Load RadarMap dynamically with SSR disabled to avoid Leaflet window object errors
const RadarMap = dynamic(() => import("@/components/map/RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f4f6f8] text-xs text-slate-550">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
        <p>Đang tải bản đồ đường phố...</p>
      </div>
    </div>
  ),
});

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

const MOCK_AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80"
];

const mockNames = [
  { name: "Tiệm sửa xe Thành Đạt", spec: "Sửa xe ga, vá lốp lưu động", phone: "0909 333 444", rating: 4.8, icon: "🛠️", avatar: MOCK_AVATARS[0], niche: "Sửa chữa", distance: "Cách 1.2km", tags: ["Sửa xe", "Cứu hộ", "24/7"], isOpen: true },
  { name: "Vệ sinh máy lạnh 24h", spec: "Rửa máy lạnh, nạp gas giá rẻ", phone: "0911 555 666", rating: 4.9, icon: "❄️", avatar: MOCK_AVATARS[1], niche: "Gia đình", distance: "Cách 800m", tags: ["Điện lạnh", "Vệ sinh"], isOpen: true },
  { name: "Quán phở gia truyền Hà Nội", spec: "Phở bò chín/tái thơm ngon", phone: "0922 777 888", rating: 4.7, icon: "🍜", avatar: MOCK_AVATARS[2], niche: "F&B", distance: "Cách 1.5km", tags: ["Ăn uống", "Phở bò"], isOpen: true },
  { name: "Spa & Nail Thùy Lâm", spec: "Làm nail, chăm sóc da mặt chuyên sâu", phone: "0933 999 111", rating: 5.0, icon: "💅", avatar: MOCK_AVATARS[3], niche: "Spa", distance: "Cách 600m", tags: ["Nail", "Làm đẹp"], isOpen: false },
  { name: "Cơm tấm bãi rác Q4", spec: "Sườn bì chả nướng than thơm phức", phone: "0944 222 333", rating: 4.6, icon: "🍛", avatar: MOCK_AVATARS[4], niche: "F&B", distance: "Cách 2km", tags: ["Ăn sáng", "Cơm tấm"], isOpen: true },
  { name: "Grab Đội Giao Hàng Siêu Tốc", spec: "Chạy ship, giao tài liệu khẩn cấp", phone: "0955 888 999", rating: 4.9, icon: "🛵", avatar: MOCK_AVATARS[5], niche: "Vận tải", distance: "Cách 500m", tags: ["Giao hàng", "Xe ôm"], isOpen: true },
  { name: "Điện nước dân dụng Bách Khoa", spec: "Sửa chập điện, ống nước rò rỉ", phone: "0966 111 222", rating: 4.8, icon: "⚡", avatar: MOCK_AVATARS[6], niche: "Gia đình", distance: "Cách 1.8km", tags: ["Điện nước", "Sửa chữa"], isOpen: true },
  { name: "Cắt tóc nam barber shop", spec: "Tạo kiểu undercut, cạo râu", phone: "0977 444 555", rating: 4.7, icon: "✂️", avatar: MOCK_AVATARS[7], niche: "Spa", distance: "Cách 1km", tags: ["Cắt tóc", "Salon"], isOpen: true },
  { name: "Thú y Pet Clinic & Spa", spec: "Khám chữa bệnh, tỉa lông thú cưng", phone: "0988 666 777", rating: 4.9, icon: "🐶", avatar: MOCK_AVATARS[8], niche: "Spa", distance: "Cách 2.3km", tags: ["Thú cưng", "Bác sĩ"], isOpen: true },
  { name: "Trà sữa DingTea & Snacks", spec: "Trà sữa trân châu, khoai tây chiên", phone: "0999 888 111", rating: 4.5, icon: "🧋", avatar: MOCK_AVATARS[9], niche: "F&B", distance: "Cách 1.1km", tags: ["Trà sữa", "Ăn vặt"], isOpen: false }
];

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProvince, setSelectedProvince] = useState("all");
  const [sessionUser, setSessionUser] = useState<any>(null);

  // AI assistant queries state
  const [aiQuery, setAiQuery] = useState("");

  // Map center and zoom synchronized states
  const [center, setCenter] = useState<[number, number]>([16.0471, 108.2062]);
  const [zoom, setZoom] = useState<number>(6);
  const [mockList, setMockList] = useState<any[]>([]);

  const categories = [
    { id: "all", label: "Tất cả ngành" },
    { id: "Vận tải", label: "🛵 Vận tải" },
    { id: "Sửa chữa", label: "🛠️ Sửa chữa" },
    { id: "Gia đình", label: "🧹 Gia đình" },
    { id: "Spa", label: "💅 Spa & Nail" },
    { id: "F&B", label: "☕ F&B" },
  ];

  const provinces = [
    { id: "all", label: "🌍 Toàn quốc" },
    { id: "TP. Hồ Chí Minh", label: "📍 TP. Hồ Chí Minh" },
    { id: "Hà Nội", label: "📍 Hà Nội" },
    { id: "Đà Nẵng", label: "📍 Đà Nẵng" },
    { id: "Cần Thơ", label: "📍 Cần Thơ" },
    { id: "Hải Phòng", label: "📍 Hải Phòng" },
  ];

  // Geolocation navigator to center on user
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          setZoom(14);
        },
        (error) => {
          console.error(error);
        }
      );
    }
  }, []);

  // Generate 10 mock services dynamically around the GPS coordinates center
  useEffect(() => {
    if (center && mockList.length === 0) {
      const [lat, lng] = center;
      const offsets = [
        [0.003, -0.005],
        [-0.004, 0.006],
        [0.006, 0.004],
        [-0.007, -0.003],
        [0.002, 0.009],
        [-0.005, -0.008],
        [0.008, -0.006],
        [-0.002, 0.005],
        [0.005, -0.002],
        [-0.009, 0.008],
      ];

      const generated = mockNames.map((item, idx) => {
        const offset = offsets[idx % offsets.length];
        return {
          id: `mock-radar-${idx}`,
          title: item.spec,
          companyName: item.name,
          salary: "Liên hệ thỏa thuận",
          niche: item.niche,
          latitude: lat + offset[0],
          longitude: lng + offset[1],
          is_premium: idx % 3 === 0,
          employerId: "self",
          rating: item.rating,
          phone: item.phone,
          avatarUrl: item.avatar,
          distance: item.distance,
          isMock: true,
          tags: item.tags,
          isOpen: item.isOpen
        };
      });
      setMockList(generated);
    }
  }, [center, mockList]);

  // Load session user info
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

  // Load DB Services based on province selector
  useEffect(() => {
    async function fetchServices() {
      try {
        setLoading(true);
        setError(null);
        const provinceParam = selectedProvince === "all" ? "" : selectedProvince;
        const res = await fetch(`/api/services?province=${encodeURIComponent(provinceParam)}`);
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

  const handleAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) {
      setAiQuery("");
      return;
    }
    toast.success(`AI: Đang tìm dịch vụ tốt nhất cho "${aiQuery}"...`);
  };

  // Merge database records with mocks list
  const allLocations = [
    ...services.map(s => ({
      id: s.id,
      title: s.description,
      companyName: s.name,
      salary: s.priceRange || "Thỏa thuận",
      niche: s.category,
      latitude: parseFloat(s.location.split(",")[0]) || center[0] + (Math.random() * 0.01 - 0.005),
      longitude: parseFloat(s.location.split(",")[1]) || center[1] + (Math.random() * 0.01 - 0.005),
      is_premium: !!s.isBoosted,
      employerId: s.ownerId,
      rating: s.rating || 4.7,
      phone: s.contactInfo,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=2563eb&color=ffffff&bold=true`,
      distance: "Cách 1km",
      isMock: false,
      tags: [s.category, "Hệ thống"],
      isOpen: true
    })),
    ...mockList
  ];

  // Apply unified search and category filters (filtering by name, title, niche and tags)
  const filteredLocations = allLocations.filter((loc) => {
    const matchesSearch =
      loc.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.niche.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAISearch =
      !aiQuery.trim() ||
      loc.companyName.toLowerCase().includes(aiQuery.toLowerCase()) ||
      loc.title.toLowerCase().includes(aiQuery.toLowerCase()) ||
      loc.niche.toLowerCase().includes(aiQuery.toLowerCase()) ||
      loc.tags.some((tag: string) => tag.toLowerCase().includes(aiQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || loc.niche === selectedCategory;

    return matchesSearch && matchesAISearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Global Navbar */}
      <Navbar />
      <Toaster position="top-center" />

      {/* Main Full-Screen Layout */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex h-full w-full overflow-hidden flex-col md:flex-row">
          
          {/* Left Column (400px width): AI search, Filters, List */}
          <div className="w-full md:w-[400px] flex flex-col h-full bg-slate-955 border-r border-slate-850 overflow-hidden flex-shrink-0">
            
            {/* Header, AI Chat Box, Filters */}
            <div className="p-4 border-b border-slate-850 space-y-3.5 flex-shrink-0 bg-slate-955">
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Store className="h-4.5 w-4.5 text-blue-500" />
                  Hộp dịch vụ AI & Radar
                </h1>
                
                {/* Geo-filter Province Selector */}
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded-lg py-1 px-2 focus:outline-none cursor-pointer"
                >
                  {provinces.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Assistant Chat Box */}
              <div className="rounded-xl border border-slate-850 bg-gradient-to-r from-blue-950/20 to-indigo-950/20 p-3.5 relative overflow-hidden shadow-inner">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-455 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">Trợ lý định vị AI</span>
                </div>
                
                <h3 className="text-[11px] font-bold text-slate-350 mt-1">
                  Trợ lý AI: Bạn đang cần dịch vụ gì hôm nay?
                </h3>
                
                <form onSubmit={handleAISubmit} className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ví dụ: Tìm sửa xe máy 24/7..."
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-3xs text-slate-200 placeholder-slate-550 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-3xs font-bold transition-all cursor-pointer"
                  >
                    Tìm
                  </button>
                </form>
              </div>

              {/* Search & Category quick filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2 h-4 w-4 text-slate-550" />
                  <input
                    type="search"
                    placeholder="Tìm kiếm live, gõ dịch vụ, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-3xs text-slate-200 placeholder-slate-550 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded px-2 py-1 text-[10px] font-bold transition-all ${
                        selectedCategory === cat.id
                          ? "bg-blue-600 text-white"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable store list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950/20">
              {loading && services.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-2">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                  <p className="text-4xs text-slate-550">Đang tải danh bạ...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-[11px] text-red-400">
                  {error}
                </div>
              ) : filteredLocations.length > 0 ? (
                filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className={`rounded-xl border p-3.5 backdrop-blur-md flex flex-col justify-between gap-3 transition-all duration-300 hover:scale-[1.01] ${
                      loc.is_premium
                        ? "border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 hover:bg-amber-550/10 shadow-lg"
                        : "border-slate-850 bg-slate-900/30 hover:border-blue-500/20 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex gap-2.5 items-start">
                      <div className="h-9 w-9 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 bg-slate-900">
                        <img
                          src={loc.avatarUrl}
                          alt={loc.companyName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {loc.is_premium && (
                            <span className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.2 text-[8px] font-bold text-amber-400 border border-amber-500/20">
                              HOT
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-slate-200 truncate leading-tight">
                            {loc.companyName}
                          </h4>
                          <span className={`inline-block px-1 py-0.2 rounded text-[7px] font-extrabold ${loc.isOpen ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                            {loc.isOpen ? "🟢 Mở cửa" : "🔴 Đóng cửa"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-450 mt-0.5 line-clamp-2 leading-relaxed">
                          {loc.title}
                        </p>
                        
                        {/* Tags list display */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {loc.tags.map((tag: string) => (
                            <span key={tag} className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500">
                          <span className="text-amber-500 font-bold">⭐ {loc.rating}</span>
                          <span>•</span>
                          <span>📍 {loc.distance}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 border-t border-slate-850/60 pt-2.5 mt-0.5">
                      <button
                        onClick={() => {
                          setCenter([loc.latitude, loc.longitude]);
                          setZoom(16);
                          toast.success(`📍 Đang di chuyển bản đồ tới: ${loc.companyName}`);
                        }}
                        className="flex-1 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-all text-center text-4xs font-bold cursor-pointer"
                      >
                        📍 Chỉ đường
                      </button>
                      <a
                        href={loc.isMock ? `/messages` : `/messages?userId=${loc.employerId}`}
                        className="flex-1 py-1 rounded-lg bg-blue-650 hover:bg-blue-600 text-white transition-all text-center text-4xs font-bold cursor-pointer"
                      >
                        💬 Nhắn tin
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-slate-850 rounded-xl bg-slate-900/10 text-slate-500 text-4xs">
                  Không tìm thấy thợ hoặc dịch vụ nào phù hợp.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Remaining width): Interactive Map Radar */}
          <div className="flex-1 h-full relative">
            <RadarMap
              jobs={filteredLocations}
              center={center}
              zoom={zoom}
            />
          </div>

        </div>
      </main>
      
      {/* Scrollbar CSS */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
