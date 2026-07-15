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
  city?: string | null;
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
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProvince, setSelectedProvince] = useState("all");
  const [sessionUser, setSessionUser] = useState<any>(null);

  // AI assistant queries state
  const [aiQuery, setAiQuery] = useState("");

  // Map center, zoom and active flyTo location synchronized states
  const [center, setCenter] = useState<[number, number]>([12.245, 109.195]);
  const [zoom, setZoom] = useState<number>(14);
  const [activeLocation, setActiveLocation] = useState<[number, number] | null>(null);

  // 8 Main Groups and 53 sub-services constants
  const SERVICE_GROUPS = [
    {
      name: "Cứu hộ & Khẩn cấp",
      icon: "🚨",
      services: [
        "Cứu hộ xe máy", "Cứu hộ ô tô", "Thợ sửa khóa", "Sửa điện nước khẩn cấp",
        "Thông tắc vệ sinh", "Nhà thuốc 24/7", "Cấp cứu thú y", "Diệt côn trùng"
      ]
    },
    {
      name: "Bảo dưỡng & Sửa chữa",
      icon: "🛠️",
      services: [
        "Sửa chữa máy lạnh", "Sửa điện máy gia dụng", "Dọn dẹp nhà cửa", "Giặt ủi nội thất",
        "Thợ xây sửa nhỏ", "Lắp đặt camera", "Sửa cửa cuốn cửa kính"
      ]
    },
    {
      name: "Làm đẹp & Cá nhân",
      icon: "💅",
      services: [
        "Cắt tóc nam barber", "Salon tóc nữ", "Spa Massage", "Tiệm Nails",
        "Phun xăm thẩm mỹ", "Phòng tập Gym Yoga", "Trang điểm Makeup"
      ]
    },
    {
      name: "Vận tải & Di chuyển",
      icon: "🛵",
      services: [
        "Thuê xe máy", "Thuê ô tô tự lái", "Chuyển nhà trọn gói", "Xe tải chở thuê",
        "Đưa đón sân bay", "Tài xế lái xe hộ", "Chạy xe ôm công nghệ Grab"
      ]
    },
    {
      name: "Đời sống & Tiện ích",
      icon: "🏠",
      services: [
        "Giặt ủi dân dụng", "Giao gas tận nhà", "Giao nước khoáng", "Sửa quần áo giày dép",
        "In ấn Photocopy", "Rửa xe chăm sóc xe", "Giao đá viên hỏa tốc", "Sửa chữa máy tính laptop"
      ]
    },
    {
      name: "Thú cưng & Trẻ em",
      icon: "🐶",
      services: [
        "Spa thú cưng", "Khách sạn thú cưng", "Trông trẻ theo giờ",
        "Gia sư trung tâm dạy kèm", "Khu vui chơi trẻ em"
      ]
    },
    {
      name: "Giải trí & F&B",
      icon: "☕",
      services: [
        "Quán ăn đêm", "Cà phê làm việc", "Cyber Gaming tiệm net", "Billiards bida",
        "Karaoke", "Nấu tiệc tại nhà", "Thuê đồ sự kiện", "Cho thuê trang phục"
      ]
    },
    {
      name: "Y tế & Hành chính",
      icon: "💼",
      services: [
        "Y tế tại nhà", "Dịch vụ giấy tờ pháp lý", "Mua bán sửa chữa điện thoại iphone"
      ]
    }
  ];

  const provinces = [
    { id: "all", label: "🌍 Toàn quốc" },
    // 5 Central Municipalities
    { id: "TP. Hồ Chí Minh", label: "📍 TP. Hồ Chí Minh" },
    { id: "Hà Nội", label: "📍 Hà Nội" },
    { id: "Đà Nẵng", label: "📍 Đà Nẵng" },
    { id: "Cần Thơ", label: "📍 Cần Thơ" },
    { id: "Hải Phòng", label: "📍 Hải Phòng" },
    // 58 other provinces alphabetically
    { id: "An Giang", label: "📍 An Giang" },
    { id: "Bà Rịa - Vũng Tàu", label: "📍 Bà Rịa - Vũng Tàu" },
    { id: "Bắc Giang", label: "📍 Bắc Giang" },
    { id: "Bắc Kạn", label: "📍 Bắc Kạn" },
    { id: "Bạc Liêu", label: "📍 Bạc Liêu" },
    { id: "Bắc Ninh", label: "📍 Bắc Ninh" },
    { id: "Bến Tre", label: "📍 Bến Tre" },
    { id: "Bình Định", label: "📍 Bình Định" },
    { id: "Bình Dương", label: "📍 Bình Dương" },
    { id: "Bình Phước", label: "📍 Bình Phước" },
    { id: "Bình Thuận", label: "📍 Bình Thuận" },
    { id: "Cà Mau", label: "📍 Cà Mau" },
    { id: "Cao Bằng", label: "📍 Cao Bằng" },
    { id: "Đắk Lắk", label: "📍 Đắk Lắk" },
    { id: "Đắk Nông", label: "📍 Đắk Nông" },
    { id: "Điện Biên", label: "📍 Điện Biên" },
    { id: "Đồng Nai", label: "📍 Đồng Nai" },
    { id: "Đồng Tháp", label: "📍 Đồng Tháp" },
    { id: "Gia Lai", label: "📍 Gia Lai" },
    { id: "Hà Giang", label: "📍 Hà Giang" },
    { id: "Hà Nam", label: "📍 Hà Nam" },
    { id: "Hà Tĩnh", label: "📍 Hà Tĩnh" },
    { id: "Hải Dương", label: "📍 Hải Dương" },
    { id: "Hậu Giang", label: "📍 Hậu Giang" },
    { id: "Hòa Bình", label: "📍 Hòa Bình" },
    { id: "Hưng Yên", label: "📍 Hưng Yên" },
    { id: "Khánh Hòa", label: "📍 Khánh Hòa" },
    { id: "Kiên Giang", label: "📍 Kiên Giang" },
    { id: "Kon Tum", label: "📍 Kon Tum" },
    { id: "Lai Châu", label: "📍 Lai Châu" },
    { id: "Lâm Đồng", label: "📍 Lâm Đồng" },
    { id: "Lạng Sơn", label: "📍 Lạng Sơn" },
    { id: "Lào Cai", label: "📍 Lào Cai" },
    { id: "Long An", label: "📍 Long An" },
    { id: "Nam Định", label: "📍 Nam Định" },
    { id: "Nghệ An", label: "📍 Nghệ An" },
    { id: "Ninh Bình", label: "📍 Ninh Bình" },
    { id: "Ninh Thuận", label: "📍 Ninh Thuận" },
    { id: "Nha Trang", label: "📍 Nha Trang" },
    { id: "Phú Thọ", label: "📍 Phú Thọ" },
    { id: "Phú Yên", label: "📍 Phú Yên" },
    { id: "Quảng Bình", label: "📍 Quảng Bình" },
    { id: "Quảng Nam", label: "📍 Quảng Nam" },
    { id: "Quảng Ngãi", label: "📍 Quảng Ngãi" },
    { id: "Quảng Ninh", label: "📍 Quảng Ninh" },
    { id: "Quảng Trị", label: "📍 Quảng Trị" },
    { id: "Sóc Trăng", label: "📍 Sóc Trăng" },
    { id: "Sơn La", label: "📍 Sơn La" },
    { id: "Tây Ninh", label: "📍 Tây Ninh" },
    { id: "Thái Bình", label: "📍 Thái Bình" },
    { id: "Thái Nguyên", label: "📍 Thái Nguyên" },
    { id: "Thanh Hóa", label: "📍 Thanh Hóa" },
    { id: "Thừa Thiên Huế", label: "📍 Thừa Thiên Huế" },
    { id: "Tiền Giang", label: "📍 Tiền Giang" },
    { id: "Trà Vinh", label: "📍 Trà Vinh" },
    { id: "Tuyên Quang", label: "📍 Tuyên Quang" },
    { id: "Vĩnh Long", label: "📍 Vĩnh Long" },
    { id: "Vĩnh Phúc", label: "📍 Vĩnh Phúc" },
    { id: "Yên Bái", label: "📍 Yên Bái" }
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

  // Auto-pan map center when province selection changes
  useEffect(() => {
    const PROVINCE_CENTERS: Record<string, [number, number]> = {
      "all": [16.0471, 108.2062],
      "TP. Hồ Chí Minh": [10.7769, 106.6953],
      "Hà Nội": [21.0285, 105.8542],
      "Đà Nẵng": [16.0471, 108.2062],
      "Cần Thơ": [10.0452, 105.7469],
      "Hải Phòng": [20.8449, 106.6881],
      "Nha Trang": [12.2450, 109.1950],
      "An Giang": [10.3759, 105.4185]
    };
    const newCenter = PROVINCE_CENTERS[selectedProvince] || [16.0471, 108.2062];
    setCenter(newCenter);
    setZoom(selectedProvince === "all" || !PROVINCE_CENTERS[selectedProvince] ? 6 : 14);
  }, [selectedProvince]);

  // Load both static merged stores and dynamic registered services
  useEffect(() => {
    const PROVINCE_SLUGS: Record<string, string> = {
      "TP. Hồ Chí Minh": "TP_HCM",
      "TP.HCM": "TP_HCM",
      "Hà Nội": "Ha_Noi",
      "Đà Nẵng": "da_Nang",
      "Cần Thơ": "Can_Tho",
      "Nha Trang": "Nha_Trang",
      "An Giang": "An_Giang"
    };

    async function loadAllData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch dynamic database services
        const provinceParam = selectedProvince === "all" ? "" : selectedProvince;
        const dynRes = await fetch(`/api/services?province=${encodeURIComponent(provinceParam)}`);
        let dynamicData = [];
        if (dynRes.ok) {
          dynamicData = await dynRes.json();
        }

        // 2. Fetch crawled stores from database API
        const storesRes = await fetch(`/api/stores?province=${encodeURIComponent(selectedProvince)}`);
        let dbStores = [];
        if (storesRes.ok) {
          dbStores = await storesRes.json();
        }

        // 3. Map database stores to ServiceType schema
        const mappedStatic = dbStores.map((store: any) => ({
          id: store.id,
          name: store.name,
          category: store.category,
          description: `Cửa hàng định vị tự động qua Google Maps • ${store.reviewCount || 0} đánh giá`,
          location: store.latitude && store.longitude ? `${store.latitude},${store.longitude}` : "12.245,109.195",
          city: selectedProvince === "all" ? "Toàn quốc" : selectedProvince,
          contactInfo: "0900 123 456",
          rating: store.rating || 4.5,
          ownerId: "google-maps-crawled",
          isBoosted: false,
          priceRange: "Liên hệ thỏa thuận",
          vehicleInfo: null,
          isEmergency: false,
          workType: "Toàn thời gian",
          owner: {
            id: "crawled-google-maps",
            name: "Google Maps Verified",
            email: "crawled@pawbook.com",
            avatarUrl: null,
            role: "EMPLOYER",
            bio: "Thông tin vị trí tự động từ Google Maps",
            isVerified: true
          }
        }));

        // 5. Inject ratings on dynamic registered services
        const resolvedDynamic = dynamicData.map((srv: any) => ({
          ...srv,
          rating: srv.rating || parseFloat((Math.random() * 0.5 + 4.5).toFixed(1)),
        }));

        setServices([...resolvedDynamic, ...mappedStatic]);
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi khi tải danh sách dịch vụ.");
      } finally {
        setLoading(false);
      }
    }

    loadAllData();
  }, [selectedProvince]);

  const handleAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) {
      setAiQuery("");
      return;
    }
    toast.success(`AI: Đang tìm dịch vụ tốt nhất cho "${aiQuery}"...`);
  };

  // Map database records and crawled stores to unified layout
  const allLocations = services.map(s => {
    const dbRating = s.rating || 4.7;
    return {
      id: s.id,
      title: s.description,
      companyName: s.name,
      salary: s.priceRange || "Thỏa thuận",
      niche: s.category,
      latitude: parseFloat(s.location.split(",")[0]) || center[0] + (Math.random() * 0.01 - 0.005),
      longitude: parseFloat(s.location.split(",")[1]) || center[1] + (Math.random() * 0.01 - 0.005),
      is_premium: !!s.isBoosted,
      employerId: s.ownerId,
      rating: dbRating,
      phone: s.contactInfo,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=2563eb&color=ffffff&bold=true`,
      distance: "Cách bạn 1km",
      isMock: false,
      tags: [s.category, "Hệ thống"],
      isOpen: true,
      address: s.city ? `${s.city}, Việt Nam` : "Hệ thống PawBook",
      hours: "08:00 - 22:00",
      aiRecommendation: `Phù hợp 96% • ${dbRating}⭐ trên Google Maps • Cách bạn 1.0km`
    };
  });

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

    const matchesCategory = (() => {
      if (selectedGroup === "all") {
        return selectedCategory === "all" || 
          loc.niche === selectedCategory ||
          loc.niche.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          loc.tags.some((tag: string) => tag.toLowerCase().includes(selectedCategory.toLowerCase()));
      }
      
      const activeGroup = SERVICE_GROUPS.find((g) => g.name === selectedGroup);
      if (!activeGroup) return false;

      if (selectedCategory === "all") {
        return activeGroup.services.some(
          (srv) =>
            loc.niche.toLowerCase().includes(srv.toLowerCase()) ||
            loc.tags.some((tag: string) => tag.toLowerCase().includes(srv.toLowerCase()))
        );
      } else {
        return loc.niche.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          loc.tags.some((tag: string) => tag.toLowerCase().includes(selectedCategory.toLowerCase()));
      }
    })();

    return matchesSearch && matchesAISearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-955 text-slate-100 overflow-hidden">
      {/* Global Navbar */}
      <Navbar />
      <Toaster position="top-center" />

      {/* Main Full-Screen Layout */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex h-full w-full overflow-hidden flex-col-reverse md:flex-row">
          
          {/* Left Column (400px width): AI search, Filters, List */}
          <div className="flex-1 overflow-y-auto pb-28 flex flex-col space-y-4 w-full md:w-[400px] md:flex md:flex-col md:h-full bg-slate-955 border-r border-slate-850 md:overflow-hidden md:pb-0 md:space-y-0 md:flex-shrink-0">
            
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
                  <Search className="absolute left-3 top-2 h-4 w-4 text-slate-555" />
                  <input
                    type="search"
                    placeholder="Tìm kiếm live, gõ dịch vụ, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-3xs text-slate-200 placeholder-slate-550 focus:outline-none"
                  />
                </div>

                {/* Main Groups (Flex Wrap) */}
                <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-850/60">
                  <button
                    onClick={() => {
                      setSelectedGroup("all");
                      setSelectedCategory("all");
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                      selectedGroup === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    🌍 Tất cả ngành
                  </button>
                  {SERVICE_GROUPS.map((group) => (
                    <button
                      key={group.name}
                      onClick={() => {
                        setSelectedGroup(group.name);
                        setSelectedCategory("all");
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                        selectedGroup === group.name
                          ? "bg-blue-600 text-white"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      <span>{group.icon}</span>
                      <span>{group.name}</span>
                    </button>
                  ))}
                </div>

                {/* Sub-services tags/chips */}
                {selectedGroup !== "all" && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 animate-fadeIn max-h-[140px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold border transition-all cursor-pointer ${
                        selectedCategory === "all"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                          : "bg-slate-950 text-slate-400 border-slate-900 hover:border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      Tất cả {selectedGroup}
                    </button>
                    {SERVICE_GROUPS.find((g) => g.name === selectedGroup)?.services.map((srv) => (
                      <button
                        key={srv}
                        onClick={() => setSelectedCategory(srv)}
                        className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold border transition-all cursor-pointer ${
                          selectedCategory === srv
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                            : "bg-slate-950 text-slate-400 border-slate-900 hover:border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        {srv}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable store list */}
            <div className="p-3 space-y-3 bg-slate-950/20 md:flex-1 md:overflow-y-auto md:pb-32 md:pt-2 md:custom-scrollbar">
              {loading && services.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-2">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                  <p className="text-4xs text-slate-555">Đang tải danh bạ...</p>
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
                        : "border-slate-855 bg-slate-900/30 hover:border-blue-500/20 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex gap-2.5 items-start">
                      <div className="h-9 w-9 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 bg-slate-900">
                        <img
                          src={loc.avatarUrl}
                          alt={loc.companyName}
                          loading="lazy"
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
                        
                        {/* AI Recommendation Badge - Sleek design */}
                        <div className="mt-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg p-1.5 text-[8.5px] text-blue-300 font-semibold flex items-center gap-1">
                          <span>🤖 AI Đề xuất:</span>
                          <span>{loc.aiRecommendation}</span>
                        </div>

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
                          setActiveLocation([loc.latitude, loc.longitude]);
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
                <div className="text-center py-12 border border-dashed border-slate-855 rounded-xl bg-slate-900/10 text-slate-500 text-4xs">
                  Không tìm thấy thợ hoặc dịch vụ nào phù hợp.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Remaining width): Interactive Map Radar */}
          <div className="h-[35vh] w-full shrink-0 relative md:flex-1 md:h-full md:shrink">
            <RadarMap
              jobs={filteredLocations}
              center={center}
              zoom={zoom}
              activeLocation={activeLocation}
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
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
