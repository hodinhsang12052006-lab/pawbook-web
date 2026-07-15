"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Crosshair } from "lucide-react";
import toast from "react-hot-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MarkerClusterGroup from "react-leaflet-cluster";

const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div class="flex items-center justify-center bg-blue-600 border-2 border-white rounded-full text-white text-xs font-bold w-9 h-9 shadow-lg">${count}</div>`,
    className: "custom-marker-cluster",
    iconSize: L.point(36, 36, true),
  });
};

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
  rating?: number;
  address?: string;
  hours?: string;
  aiRecommendation?: string;
  isOpen?: boolean;
  phone?: string;
}

interface RadarMapProps {
  jobs: MapJob[];
  onLocationFound?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  activeLocation?: [number, number] | null;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

function ActiveLocationFlyer({ activeLocation }: { activeLocation: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (activeLocation) {
      map.flyTo(activeLocation, 16, { duration: 1.5 });
    }
  }, [activeLocation, map]);
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

export default function RadarMap({ jobs, onLocationFound, center: propsCenter, zoom: propsZoom, activeLocation }: RadarMapProps) {
  const [center, setCenter] = useState<[number, number]>(propsCenter || [16.0471, 108.2062]);
  const [zoom, setZoom] = useState<number>(propsZoom || 6);
  const [isMounted, setIsMounted] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (propsCenter) {
      setCenter(propsCenter);
    }
  }, [propsCenter]);

  useEffect(() => {
    if (propsZoom) {
      setZoom(propsZoom);
    }
  }, [propsZoom]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter([latitude, longitude]);
        setUserCoords([latitude, longitude]);
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

  // Map database and crawled stores directly to locations
  const allLocations = jobs.map(j => ({
    ...j,
    avatarUrl: j.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(j.companyName)}&background=${(j as any).type === "CANDIDATE" ? "10b981" : "2563eb"}&color=ffffff&bold=true`
  }));

  // Helper to construct custom HTML leaflet DivIcon displaying rating
  const createCustomIcon = (rating: number, isPremium: boolean, type?: string) => {
    if (typeof window === "undefined" || !isMounted) return undefined;
    
    let badgeClass = "bg-blue-600 border-blue-500 text-white";
    let arrowClass = "bg-blue-600 border-blue-500";
    let icon = "💼";

    if (type === "CANDIDATE") {
      badgeClass = "bg-emerald-600 border-emerald-500 text-white";
      arrowClass = "bg-emerald-600 border-emerald-500";
      icon = "👤";
    } else if (isPremium) {
      badgeClass = "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400";
      arrowClass = "bg-orange-500 border-amber-400";
      icon = "🔥";
    }

    return L.divIcon({
      html: `
        <div class="relative flex flex-col items-center select-none animate-fadeIn">
          <div class="flex items-center gap-0.5 rounded-full px-2 py-0.5 shadow-md border ${badgeClass} text-[9px] font-bold">
            <span>${icon}</span><span>${rating}</span>
          </div>
          <div class="-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b ${arrowClass}"></div>
        </div>
      `,
      className: "custom-leaflet-rating-icon",
      iconSize: [45, 30],
      iconAnchor: [22, 30],
      popupAnchor: [0, -30]
    });
  };

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#f4f6f8] relative z-10 shadow-2xl">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <ChangeView center={center} zoom={zoom} />
        <ActiveLocationFlyer activeLocation={activeLocation || null} />
        
        {/* CartoDB Voyager Tile Layer - Premium bright street layout styled like Grab */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MarkerClusterGroup iconCreateFunction={createClusterCustomIcon} maxClusterRadius={60} chunkedLoading>
          {allLocations.map((loc) => {
            const ratingVal = loc.rating || 5.0;
            const customIcon = createCustomIcon(ratingVal, !!loc.is_premium, (loc as any).type);

            const addressVal = loc.address || "Việt Nam";
            const hoursVal = loc.hours || "Tự do / Full-time";
            const aiRecVal = loc.aiRecommendation || `Phù hợp 98% • Khớp với kỹ năng yêu cầu`;

            const isCandidate = (loc as any).type === "CANDIDATE";

            return (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
                icon={customIcon}
              >
                <Popup>
                  <div className="p-3.5 space-y-2.5 min-w-[280px] text-slate-800 font-sans bg-white rounded-xl shadow-lg border border-slate-100">
                    {/* Header with Avatar and Title */}
                    <div className="flex gap-2.5 items-center">
                      <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-50">
                        <img
                          src={loc.avatarUrl}
                          alt={loc.companyName}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-[8px] px-1 py-0.2 rounded font-extrabold uppercase border ${
                            isCandidate 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : loc.is_premium 
                                ? "bg-amber-50 text-amber-700 border-amber-100" 
                                : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}>
                            {isCandidate ? "👤 ỨNG VIÊN" : loc.is_premium ? "🔥 PREMIUM" : "💼 VIỆC LÀM"}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 leading-tight m-0 truncate mt-0.5">
                          {loc.companyName}
                        </h4>
                      </div>
                    </div>

                    {/* Subinfo specs */}
                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed m-0">
                      {isCandidate ? `Kỹ năng: ${loc.title}` : loc.title}
                    </p>

                    {/* AI Recommendation Badge */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-2 text-[9px] text-blue-700 font-bold flex items-center gap-1.5 leading-relaxed">
                      <span>🤖</span>
                      <span>AI Gợi ý: {aiRecVal}</span>
                    </div>

                    {/* Address & Hours */}
                    <div className="text-[9px] text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                      <p className="truncate">📍 {addressVal}</p>
                      <p className="flex items-center gap-1.5">
                        <span>⏱️ Hình thức: {hoursVal}</span>
                        <span className={`inline-block px-1 rounded text-[8px] font-extrabold ${loc.isOpen !== false ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-650 border border-red-100"}`}>
                          {loc.isOpen !== false ? "🟢 Sẵn sàng" : "🔴 Bận"}
                        </span>
                      </p>
                    </div>

                    {/* Stars and Phone */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold">
                      <div className="flex items-center gap-1 text-slate-700">
                        <span className="text-amber-500 text-xs">⭐</span>
                        <span className="text-slate-900">{ratingVal}</span>
                      </div>
                      <span className="text-emerald-600 flex items-center gap-0.5">
                        💵 {loc.salary}
                      </span>
                    </div>

                    {/* Chat and Details CTA Button */}
                    <div className="pt-1.5 flex gap-1.5">
                      <a
                        href={`/messages?userId=${loc.employerId}`}
                        onClick={(e) => {
                          if (!loc.employerId) {
                            e.preventDefault();
                            toast.error("Không tìm thấy thông tin liên hệ!");
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all text-center select-none"
                      >
                        <span>💬</span> Nhắn tin
                      </a>
                      <a
                        href={isCandidate ? `/profile/${loc.id}` : `/jobs/${loc.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 py-1.5 text-[10px] font-bold text-slate-300 hover:text-white shadow-sm transition-all text-center select-none"
                      >
                        Xem chi tiết
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
        {userCoords && (
          <Marker
            position={userCoords}
            icon={typeof window !== "undefined" && isMounted ? L.divIcon({
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="absolute h-6 w-6 rounded-full bg-blue-500/30 animate-ping"></div>
                  <div class="h-3.5 w-3.5 rounded-full bg-blue-600 border-2 border-white shadow-lg relative z-10"></div>
                </div>
              `,
              className: "user-location-marker",
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            }) : undefined}
          >
            <Popup>
              <div className="p-2 text-center text-xs font-bold text-slate-800 font-sans">
                📍 Vị trí hiện tại của bạn
              </div>
            </Popup>
          </Marker>
        )}
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
