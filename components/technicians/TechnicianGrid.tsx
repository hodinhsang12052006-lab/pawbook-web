"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Flame, Play } from "lucide-react";
import { useRouter } from "next/navigation";

export interface TechnicianType {
  id: string;
  userId: string;
  bio: string | null;
  yearsOfExperience: number;
  specialties: string[];
  status: string;
  market: "US" | "AU";
  state: string;
  city: string;
  portfolioImages: { url: string; type?: "image" | "video" }[] | string[];
  user: { id: string; name: string; avatarUrl: string | null };
}

interface TechnicianGridProps {
  market: "US" | "AU";
  state: string;
  city: string;
}

// Hiệu ứng bấm nút kiểu app native
const PRESS = "active:scale-95 transition-transform duration-100";

function firstMedia(images: any[]): { url: string; isVideo: boolean } | null {
  if (!images || images.length === 0) return null;
  const first = images[0];
  if (typeof first === "string") {
    return { url: first, isVideo: /\.(mp4|webm|mov)$/i.test(first) };
  }
  return { url: first.url, isVideo: first.type === "video" };
}

// Khung skeleton đúng tỉ lệ ô lưới thật — tránh layout shift khi đổi
// tab/vùng, và nền xám mờ-dần khi ảnh thật load xong (blur-up không dùng
// được placeholder="blur" chuẩn của next/image vì ảnh đến từ URL ngoài
// không có sẵn blurDataURL, nên thay bằng lớp nền xám fade-out khi onLoad).
function TechnicianCardSkeleton() {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-800/70 border border-slate-800 animate-pulse">
      <div className="absolute inset-x-0 bottom-0 p-2.5 space-y-1.5">
        <div className="h-2.5 w-2/3 rounded bg-slate-700" />
        <div className="h-2 w-1/2 rounded bg-slate-700/70" />
      </div>
    </div>
  );
}

function TechnicianGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3" aria-busy="true" aria-label="Đang tải portfolio thợ">
      {Array.from({ length: 9 }).map((_, i) => (
        <TechnicianCardSkeleton key={i} />
      ))}
    </div>
  );
}

function TechnicianCard({ tech, onClick }: { tech: TechnicianType; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const media = firstMedia(tech.portfolioImages as any[]);

  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group text-left ${PRESS}`}
    >
      {/* Nền xám chờ tải — fade ra khi ảnh/video thật đã sẵn sàng */}
      <div className={`absolute inset-0 bg-slate-800 transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100 animate-pulse"}`} />

      {media && (
        media.isVideo ? (
          <video
            src={media.url}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
          />
        ) : (
          <Image
            src={media.url}
            alt={tech.user.name}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            className={`object-cover group-hover:scale-105 transition-all duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
          />
        )
      )}

      {media?.isVideo && (
        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
          <Play className="h-3 w-3 text-white fill-white" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-8">
        <p className="text-xs font-bold text-white truncate">{tech.user.name}</p>
        <p className="text-[10px] text-slate-300 truncate">{tech.city}, {tech.state} · {tech.yearsOfExperience} năm KN</p>
      </div>

      {tech.status === "URGENT" && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
          <Flame className="h-2.5 w-2.5" /> Tìm việc gấp
        </span>
      )}
    </button>
  );
}

export default function TechnicianGrid({ market, state, city }: TechnicianGridProps) {
  const router = useRouter();
  const [techs, setTechs] = useState<TechnicianType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTechs() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ market });
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        const res = await fetch(`/api/technicians?${params.toString()}`);
        if (!res.ok) throw new Error("Không thể tải danh sách thợ.");
        const data = await res.json();
        if (!cancelled) setTechs(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTechs();

    return () => {
      cancelled = true;
    };
  }, [market, state, city]);

  if (loading) {
    return <TechnicianGridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (techs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-4xl">💅</p>
        <p className="text-base font-bold text-slate-300">Chưa có thợ nào đăng portfolio ở khu vực này</p>
        <p className="text-sm text-slate-500">Hãy thử đổi bang hoặc thành phố khác.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 animate-fadeIn">
      {techs.map((tech) => (
        <TechnicianCard key={tech.id} tech={tech} onClick={() => router.push(`/profile/${tech.userId}`)} />
      ))}
    </div>
  );
}
