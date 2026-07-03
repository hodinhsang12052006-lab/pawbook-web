"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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
}

interface RadarMapProps {
  jobs: MapJob[];
}

export default function RadarMap({ jobs }: RadarMapProps) {
  // Center map around Danang city to easily display pins from both Hanoi & HCMC
  const center: [number, number] = [16.0471, 108.2062];

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#070a13] relative z-10 shadow-2xl min-h-[450px]">
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
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
              <div className="p-2 space-y-1.5 min-w-[200px] text-slate-800">
                <div className="flex gap-1 items-center">
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-200 uppercase">
                    {job.niche}
                  </span>
                  {job.is_premium && (
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200 uppercase">
                      🔥 HOT
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                  {job.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">{job.companyName}</p>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 mt-1">
                  <span className="text-xs font-bold text-emerald-600">{job.salary}</span>
                  <a
                    href={`/jobs/${job.id}`}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    Xem & Ứng tuyển &rarr;
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
