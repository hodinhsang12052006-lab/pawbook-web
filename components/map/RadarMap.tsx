"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Crosshair } from "lucide-react";
import toast from "react-hot-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

interface MapJob {
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

interface RadarMapProps {
  jobs: MapJob[];
  onLocationFound?: (lat: number, lng: number) => void;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
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
  { name: "Tiệm sửa xe Thành Đạt", spec: "Sửa xe ga, vá lốp lưu động", phone: "0909 333 444", rating: 4.8, icon: "🛠️", avatar: MOCK_AVATARS[0] },
  { name: "Vệ sinh máy lạnh 24h", spec: "Rửa máy lạnh, nạp gas giá rẻ", phone: "0911 555 666", rating: 4.9, icon: "❄️", avatar: MOCK_AVATARS[1] },
  { name: "Quán phở gia truyền Hà Nội", spec: "Phở bò chín/tái thơm ngon", phone: "0922 777 888", rating: 4.7, icon: "🍜", avatar: MOCK_AVATARS[2] },
  { name: "Spa & Nail Thùy Lâm", spec: "Làm nail, chăm sóc da mặt chuyên sâu", phone: "0933 999 111", rating: 5.0, icon: "💅", avatar: MOCK_AVATARS[3] },
  { name: "Cơm tấm bãi rác Q4", spec: "Sườn bì chả nướng than thơm phức", phone: "0944 222 333", rating: 4.6, icon: "🍛", avatar: MOCK_AVATARS[4] },
  { name: "Grab Đội Giao Hàng Siêu Tốc", spec: "Chạy ship, giao tài liệu khẩn cấp", phone: "0955 888 999", rating: 4.9, icon: "🛵", avatar: MOCK_AVATARS[5] },
  { name: "Điện nước dân dụng Bách Khoa", spec: "Sửa chập điện, ống nước rò rỉ", phone: "0966 111 222", rating: 4.8, icon: "⚡", avatar: MOCK_AVATARS[6] },
  { name: "Cắt tóc nam barber shop", spec: "Tạo kiểu undercut, cạo râu", phone: "0977 444 555", rating: 4.7, icon: "✂️", avatar: MOCK_AVATARS[7] },
  { name: "Thú y Pet Clinic & Spa", spec: "Khám chữa bệnh, tỉa lông thú cưng", phone: "0988 666 777", rating: 4.9, icon: "🐶", avatar: MOCK_AVATARS[8] },
  { name: "Trà sữa DingTea & Snacks", spec: "Trà sữa trân châu, khoai tây chiên", phone: "0999 888 111", rating: 4.5, icon: "🧋", avatar: MOCK_AVATARS[9] }
];

export default function RadarMap({ jobs, onLocationFound }: RadarMapProps) {
  const [center, setCenter] = useState<[number, number]>([16.0471, 108.2062]);
  const [zoom, setZoom] = useState<number>(6);
  const [isMounted, setIsMounted] = useState(false);
  const [mockList, setMockList] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter([latitude, longitude]);
        setZoom(15);
        if (onLocationFound) {
          onLocationFound(latitude, longitude);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast("📍 Hãy bật định vị để tìm dịch vụ gần bạn nhất nhé!", {
          icon: "📍",
          style: {
            borderRadius: "12px",
            background: "#0f172a",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
          },
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Generate 10 mock services dynamically around the GPS map center
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
          niche: "LOCAL",
          latitude: lat + offset[0],
          longitude: lng + offset[1],
          is_premium: idx % 3 === 0,
          employerId: "self",
          rating: item.rating,
          phone: item.phone,
          avatarUrl: item.avatar,
          isMock: true,
        };
      });
      setMockList(generated);
    }
  }, [center, mockList]);

  // Combine database jobs and mock services list
  const allLocations = [
    ...jobs.map(j => ({
      ...j,
      isMock: false,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(j.companyName)}&background=2563eb&color=ffffff&bold=true`
    })),
    ...mockList
  ];

  // Helper to construct custom HTML leaflet DivIcon displaying rating
  const createCustomIcon = (rating: number, isPremium: boolean) => {
    if (typeof window === "undefined" || !isMounted) return undefined;
    return L.divIcon({
      html: `
        <div class="relative flex flex-col items-center select-none">
          <div class="flex items-center gap-0.5 rounded-full px-2 py-0.5 shadow-md border ${
            isPremium
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400"
              : "bg-blue-600 text-white border-blue-500"
          } text-[9px] font-bold">
            <span>⭐</span><span>${rating}</span>
          </div>
          <div class="-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b ${
            isPremium ? "bg-orange-500 border-amber-400" : "bg-blue-600 border-blue-500"
          }"></div>
        </div>
      `,
      className: "custom-leaflet-rating-icon",
      iconSize: [45, 30],
      iconAnchor: [22, 30],
      popupAnchor: [0, -30]
    });
  };

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#f4f6f8] relative z-10 shadow-2xl min-h-[500px]">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <ChangeView center={center} zoom={zoom} />
        
        {/* CartoDB Voyager Tile Layer - Premium bright street layout styled like Grab */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {allLocations.map((loc) => {
          const ratingVal = loc.rating || (loc.reviews && loc.reviews.length > 0
            ? parseFloat((loc.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / loc.reviews.length).toFixed(1))
            : parseFloat((4.2 + (loc.id.charCodeAt(0) % 9) / 10).toFixed(1)));

          const customIcon = createCustomIcon(ratingVal, !!loc.is_premium);

          return (
            <Marker
              key={loc.id}
              position={[loc.latitude, loc.longitude]}
              icon={customIcon}
            >
              <Popup>
                <div className="p-3.5 space-y-2.5 min-w-[245px] text-slate-800 font-sans bg-white rounded-xl shadow-lg border border-slate-100">
                  {/* Header with Avatar and Title */}
                  <div className="flex gap-2.5 items-center">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-50">
                      <img 
                        src={loc.avatarUrl} 
                        alt={loc.companyName} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded font-extrabold uppercase border border-amber-100">
                          {loc.is_premium ? "🔥 PREMIUM" : "ĐỊA PHƯƠNG"}
                        </span>
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-900 leading-tight m-0 truncate mt-0.5">
                        {loc.companyName}
                      </h4>
                    </div>
                  </div>

                  {/* Subinfo specs */}
                  <p className="text-4xs text-slate-500 leading-relaxed font-semibold m-0">
                    {loc.title}
                  </p>

                  {/* Stars and Phone */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold">
                    <div className="flex items-center gap-1 text-slate-700">
                      <span className="text-amber-500 text-xs">⭐</span>
                      <span className="text-slate-900">{ratingVal}</span>
                    </div>
                    <a
                      href={`tel:${loc.phone || "0900 123 456"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success(`Đang gọi điện đến ${loc.companyName}...`);
                      }}
                      className="text-emerald-600 hover:text-emerald-500 flex items-center gap-0.5"
                    >
                      📞 {loc.phone || "Liên hệ SĐT"}
                    </a>
                  </div>

                  {/* Chat CTA Button */}
                  <div className="pt-1.5 flex gap-1.5">
                    <a
                      href={loc.isMock ? `/messages` : `/messages?userId=${loc.employerId}`}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 py-1.5 text-4xs font-bold text-white shadow-sm transition-all text-center select-none"
                    >
                      <span>💬</span> Nhắn tin ngay
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Locate Me button */}
      <button
        onClick={requestLocation}
        title="Định vị hiện tại"
        className="absolute bottom-5 right-5 z-[500] p-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 hover:scale-105 transition-all shadow-lg cursor-pointer flex items-center justify-center group"
      >
        <Crosshair className="h-5 w-5 text-blue-600 group-hover:animate-spin" />
      </button>
    </div>
  );
}
