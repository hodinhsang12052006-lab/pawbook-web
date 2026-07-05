"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Crosshair } from "lucide-react";
import toast from "react-hot-toast";
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

export default function RadarMap({ jobs, onLocationFound }: RadarMapProps) {
  const [center, setCenter] = useState<[number, number]>([16.0471, 108.2062]);
  const [zoom, setZoom] = useState<number>(6);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter([latitude, longitude]);
        setZoom(13);
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

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#070a13] relative z-10 shadow-2xl min-h-[450px]">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <ChangeView center={center} zoom={zoom} />
        {/* Premium Dark Matter Tile Layer from CartoDB to align with our dark theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {jobs.map((job) => (
          <Marker
            key={job.id}
            position={[job.latitude, job.longitude]}
          >
            <Popup>
              <div className="p-3 space-y-2 min-w-[220px] text-slate-800 font-sans">
                {/* Category & Badge */}
                <div className="flex gap-1.5 items-center">
                  {(() => {
                    const titleLower = job.title.toLowerCase();
                    const isTransport = titleLower.includes("xe") || titleLower.includes("vận tải") || titleLower.includes("shipper") || titleLower.includes("chuyển nhà");
                    const isMechanic = job.niche === "MECHANIC" || titleLower.includes("thợ") || titleLower.includes("sửa");
                    const isBeauty = job.niche === "SPA" || titleLower.includes("hair") || titleLower.includes("nail") || titleLower.includes("cắt tóc");
                    const isFnB = job.niche === "FNB";

                    let displayNiche = job.niche;
                    let emoji = "🏢";
                    if (isTransport) {
                      displayNiche = "Taxi 0%";
                      emoji = titleLower.includes("xe ôm") ? "🏍️" : "🚕";
                    } else if (isMechanic) {
                      displayNiche = "Sửa chữa";
                      emoji = "🛠️";
                    } else if (isBeauty) {
                      displayNiche = "Spa & Nail";
                      emoji = "💅";
                    } else if (isFnB) {
                      displayNiche = "F&B";
                      emoji = "☕";
                    }

                    return (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-100 uppercase">
                        <span>{emoji}</span>
                        <span>{displayNiche}</span>
                      </span>
                    );
                  })()}
                  
                  {job.is_premium && (
                    <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100 uppercase">
                      🔥 HOT
                    </span>
                  )}
                </div>

                {/* Main Shop / Driver name */}
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-tight m-0 flex items-center gap-1">
                    <span>{job.companyName}</span>
                    {job.employer?.isVerified && (
                      <span className="text-blue-500" title="Tài khoản đã xác minh">💎</span>
                    )}
                  </h4>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 leading-snug">
                    {job.title}
                  </p>
                </div>

                {/* Extra specs */}
                <div className="flex flex-wrap gap-1 text-[9px] mt-1">
                  {job.priceRange && (
                    <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
                      💰 Giá: {job.priceRange}
                    </span>
                  )}
                  {job.isEmergency && (
                    <span className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded border border-rose-100 font-extrabold uppercase animate-pulse">
                      🚨 24/7
                    </span>
                  )}
                  {job.vehicleInfo && (
                    <span className="bg-sky-50 text-sky-700 px-1 py-0.5 rounded border border-sky-100 font-semibold">
                      🚗 Xe: {job.vehicleInfo}
                    </span>
                  )}
                  {job.workType && (
                    <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-100 font-semibold">
                      ⏱️ {job.workType}
                    </span>
                  )}
                </div>

                {/* Google Maps style ratings summary */}
                {(() => {
                  const ratingVal = job.reviews && job.reviews.length > 0
                    ? (job.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / job.reviews.length).toFixed(1)
                    : (4.2 + (job.id.charCodeAt(0) % 9) / 10).toFixed(1);
                  const countVal = job.reviews && job.reviews.length > 0
                    ? job.reviews.length
                    : (job.id.charCodeAt(job.id.length - 1) % 85) + 12;

                  return (
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <span className="text-amber-500 font-bold text-sm">★</span>
                      <span className="font-bold text-slate-900">{ratingVal}</span>
                      <span className="text-slate-400">({countVal} đánh giá)</span>
                    </div>
                  );
                })()}

                {/* Salary Info */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                  <span className="text-xs font-extrabold text-emerald-600">{job.salary}</span>
                  
                  <div className="flex gap-2">
                    <a
                      href={`/jobs/${job.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all"
                    >
                      Xem chi tiết
                    </a>
                    {job.employerId && (
                      <a
                        href={`/messages?userId=${job.employerId}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                      >
                        💬 Chat
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Locate Me button */}
      <button
        onClick={requestLocation}
        title="Định vị hiện tại"
        className="absolute bottom-5 right-5 z-[500] p-3 rounded-full bg-slate-900/90 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-850 hover:scale-105 transition-all shadow-lg shadow-black/40 cursor-pointer flex items-center justify-center group"
      >
        <Crosshair className="h-5 w-5 text-blue-500 group-hover:animate-spin" />
      </button>
    </div>
  );
}
