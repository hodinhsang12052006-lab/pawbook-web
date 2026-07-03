import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
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
      },
    });

    return NextResponse.json(jobs);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Không thể lấy thông tin định vị." },
      { status: 500 }
    );
  }
}
