import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// GET /api/admin/leads — Radar chủ tiệm (leads) + thợ, dành riêng cho ADMIN.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    // Không tin thẳng role trong JWT (có thể đã stale nếu quyền được cấp
    // sau khi phiên đăng nhập được tạo) — luôn xác minh lại trực tiếp
    // trong database cho endpoint nhạy cảm này vì nó trả về SĐT/PII của
    // toàn bộ user trên hệ thống.
    const currentUser = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, role: true },
    });

    if (!currentUser || currentUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập trang này." }, { status: 403 });
    }

    const owners = await prisma.user.findMany({
      where: { role: Role.OWNER },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        market: true,
        state: true,
        city: true,
        diagnosedPains: true,
        surveyAnswers: true,
        createdAt: true,
        jobs: {
          select: {
            id: true,
            title: true,
            salonName: true,
            skills: true,
            salaryType: true,
            salaryAmount: true,
            benefits: true,
            phone: true,
            isUrgent: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const safeOwners = owners.map((o) => {
      const pains = o.diagnosedPains ? o.diagnosedPains.split(",").filter(Boolean) : [];
      return {
        id: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        market: o.market,
        state: o.state,
        city: o.city,
        pains,
        leadScore: Math.min(5, pains.length),
        surveyAnswers: safeParseJson<any[]>(o.surveyAnswers, []),
        createdAt: o.createdAt.toISOString(),
        jobs: o.jobs.map((j) => ({
          ...j,
          skills: j.skills ? j.skills.split(",").filter(Boolean) : [],
          benefits: j.benefits ? j.benefits.split(",").filter(Boolean) : [],
          createdAt: j.createdAt.toISOString(),
        })),
      };
    });

    const technicians = await prisma.user.findMany({
      where: { role: Role.TECHNICIAN },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        market: true,
        state: true,
        city: true,
        createdAt: true,
        technicianProfile: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const safeTechnicians = technicians.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      phone: t.phone,
      market: t.market,
      state: t.state,
      city: t.city,
      createdAt: t.createdAt.toISOString(),
      technicianProfile: t.technicianProfile
        ? {
            bio: t.technicianProfile.bio,
            yearsOfExperience: t.technicianProfile.yearsOfExperience,
            specialties: t.technicianProfile.specialties ? t.technicianProfile.specialties.split(",").filter(Boolean) : [],
            status: t.technicianProfile.status,
            desiredSalaryType: t.technicianProfile.desiredSalaryType,
            desiredSalaryAmount: t.technicianProfile.desiredSalaryAmount,
            desiredBenefits: t.technicianProfile.desiredBenefits ? t.technicianProfile.desiredBenefits.split(",").filter(Boolean) : [],
            portfolioImages: safeParseJson<string[]>(t.technicianProfile.portfolioImages, []),
          }
        : null,
    }));

    return NextResponse.json({ owners: safeOwners, technicians: safeTechnicians });
  } catch (error: any) {
    console.error("GET /api/admin/leads error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tải dữ liệu lead." }, { status: 500 });
  }
}
