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

    let whereClause: any = {
      latitude: { not: null },
      longitude: { not: null },
    };

    if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
      const deltaLat = radius / 111;
      const deltaLng = radius / (111 * Math.abs(Math.cos((lat * Math.PI) / 180)));

      whereClause = {
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

    const jobs = await prisma.job.findMany({
      where: whereClause,
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
          },
        },
      },
    });

    let results = jobs;
    if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
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

      results = jobs.filter((job) => {
        if (job.latitude === null || job.longitude === null) return false;
        const dist = getDistance(lat, lng, job.latitude, job.longitude);
        return dist <= radius;
      });
    }

    return NextResponse.json(results);
  } catch (err: any) {
    console.error("GET radar error:", err);
    return NextResponse.json(
      { error: "Không thể lấy thông tin định vị." },
      { status: 500 }
    );
  }
}
