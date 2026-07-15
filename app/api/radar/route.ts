export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusStr = searchParams.get("radius");

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;
    const radius = radiusStr ? parseFloat(radiusStr) : 10;

    // Helper to calculate coordinates dynamically for candidates based on user's address/id
    const getCandidateCoords = (address: string | null, id: string) => {
      const cities: { [key: string]: { lat: number; lng: number } } = {
        "Hà Nội": { lat: 21.0285, lng: 105.8542 },
        "TP. Hồ Chí Minh": { lat: 10.7626, lng: 106.6602 },
        "Đà Nẵng": { lat: 16.0544, lng: 108.2022 },
        "Cần Thơ": { lat: 10.0371, lng: 105.7882 },
        "Hải Phòng": { lat: 20.8449, lng: 106.6881 },
        "Nha Trang": { lat: 12.2388, lng: 109.1967 },
        "Huế": { lat: 16.4637, lng: 107.5909 },
        "Đà Lạt": { lat: 11.9404, lng: 108.4583 },
        "Vinh": { lat: 18.6734, lng: 105.6812 },
        "Buôn Ma Thuột": { lat: 12.6853, lng: 108.0383 },
      };

      let matchedCity = "TP. Hồ Chí Minh";
      if (address) {
        for (const cityName in cities) {
          if (address.toLowerCase().includes(cityName.toLowerCase())) {
            matchedCity = cityName;
            break;
          }
        }
      }

      const baseCity = cities[matchedCity];
      
      // Deterministic offset based on ID hash
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
      }
      const latOffset = ((hash % 100) / 1000) * 0.08; 
      const lngOffset = (((hash >> 8) % 100) / 1000) * 0.08;

      return {
        latitude: baseCity.lat + latOffset,
        longitude: baseCity.lng + lngOffset,
      };
    };

    let jobWhereClause: any = {
      latitude: { not: null },
      longitude: { not: null },
    };

    if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
      const deltaLat = radius / 111;
      const deltaLng = radius / (111 * Math.abs(Math.cos((lat * Math.PI) / 180)));

      jobWhereClause = {
        latitude: {
          gte: lat - deltaLat,
          lte: lat + deltaLat,
        },
        longitude: {
          gte: lng - deltaLng,
          lte: lng + deltaLng,
        },
      };
    }

    // 1. Fetch Jobs
    const jobs = await prisma.job.findMany({
      where: jobWhereClause,
      take: 100,
      select: {
        id: true,
        title: true,
        companyName: true,
        salary: true,
        niche: true,
        latitude: true,
        longitude: true,
        is_premium: true,
        employerId: true,
        reviews: true,
        priceRange: true,
        isEmergency: true,
        vehicleInfo: true,
        workType: true,
        employer: {
          select: {
            isVerified: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 2. Fetch Users with role USER (Candidates)
    const candidates = await prisma.user.findMany({
      where: {
        role: "USER",
      },
      take: 100,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        skills: true,
        bio: true,
        phone: true,
        address: true,
        trustScore: true,
        isVerified: true,
      },
    });

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Format Jobs uniformly
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      type: "JOB" as const,
      title: job.title,
      companyName: job.companyName,
      salary: job.salary,
      niche: job.niche,
      latitude: job.latitude!,
      longitude: job.longitude!,
      is_premium: job.is_premium,
      employerId: job.employerId,
      avatarUrl: job.employer?.avatarUrl || null,
      isVerified: job.employer?.isVerified || false,
      priceRange: job.priceRange,
      isEmergency: job.isEmergency,
      vehicleInfo: job.vehicleInfo,
      workType: job.workType,
      rating: job.reviews && job.reviews.length > 0 
        ? parseFloat((job.reviews.reduce((sum, r) => sum + r.rating, 0) / job.reviews.length).toFixed(1))
        : 4.8,
    }));

    // Format Candidates uniformly with coordinates
    const formattedCandidates = candidates.map((cand) => {
      const coords = getCandidateCoords(cand.address, cand.id);
      return {
        id: cand.id,
        type: "CANDIDATE" as const,
        title: cand.skills || "Chuyên viên MMO / Web3 tự do",
        companyName: cand.name,
        salary: "Thỏa thuận",
        niche: "MMO",
        latitude: coords.latitude,
        longitude: coords.longitude,
        is_premium: cand.isVerified,
        employerId: cand.id, // Direct user ID for chat
        avatarUrl: cand.avatarUrl || null,
        isVerified: cand.isVerified || false,
        priceRange: "Thỏa thuận",
        isEmergency: false,
        vehicleInfo: null,
        workType: "FULLTIME",
        rating: cand.trustScore || 5.0,
      };
    });

    let merged = [...formattedJobs, ...formattedCandidates];

    // Filter by radius if lat/lng is active
    if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
      merged = merged.filter((item) => {
        const dist = getDistance(lat, lng, item.latitude, item.longitude);
        return dist <= radius;
      });
    }

    return NextResponse.json(merged);
  } catch (err: any) {
    console.error("GET radar error:", err);
    return NextResponse.json(
      { error: "Không thể lấy thông tin định vị bản đồ." },
      { status: 500 }
    );
  }
}
