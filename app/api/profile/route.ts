import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// GET user profile data (own profile, or ?id=<userId> for public view)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("id");

    const session = await getServerSession(authOptions);
    const userId = targetUserId || (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem hồ sơ." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        phone: true,
        market: true,
        state: true,
        city: true,
        diagnosedPains: true,
        turnSplitPolicy: true,
        clientTypePolicy: true,
        housingSupport: true,
        jobs: {
          select: {
            id: true,
            title: true,
            salonName: true,
            market: true,
            state: true,
            city: true,
            salaryType: true,
            salaryAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        technicianProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Tài khoản người dùng không tồn tại." },
        { status: 404 }
      );
    }

    const safeJobs = (user.jobs || []).map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ...user,
      jobs: safeJobs,
      technicianProfile: user.technicianProfile
        ? {
            ...user.technicianProfile,
            portfolioImages: JSON.parse(user.technicianProfile.portfolioImages || "[]"),
            createdAt: user.technicianProfile.createdAt.toISOString(),
            updatedAt: user.technicianProfile.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err: any) {
    console.error("GET profile error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải thông tin hồ sơ." },
      { status: 500 }
    );
  }
}

// PUT update user profile (basic info) + technician profile (portfolio/specialties/status)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để chỉnh sửa hồ sơ." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();

    const { name, phone, state, city, avatarUrl, technician, turnSplitPolicy, clientTypePolicy, housingSupport } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (state !== undefined) updateData.state = state;
    if (city !== undefined) updateData.city = city;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    // "Chính sách tiệm" — chỉ có ý nghĩa với OWNER nhưng không cần chặn ở
    // đây vì trường rỗng/null với TECHNICIAN cũng vô hại.
    if (turnSplitPolicy !== undefined) updateData.turnSplitPolicy = turnSplitPolicy;
    if (clientTypePolicy !== undefined) updateData.clientTypePolicy = clientTypePolicy;
    if (housingSupport !== undefined) updateData.housingSupport = Boolean(housingSupport);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, name: true, email: true, avatarUrl: true, role: true,
        phone: true, market: true, state: true, city: true,
        turnSplitPolicy: true, clientTypePolicy: true, housingSupport: true,
      },
    });

    let updatedTechnicianProfile = null;
    if (technician && updatedUser.role === "TECHNICIAN") {
      const {
        bio, yearsOfExperience, specialties, status, portfolioImages,
        desiredSalaryType, desiredSalaryAmount, desiredBenefits, avgTenureMonths,
      } = technician;
      const techUpdateData: any = {};
      if (bio !== undefined) techUpdateData.bio = bio;
      if (yearsOfExperience !== undefined) techUpdateData.yearsOfExperience = Number(yearsOfExperience) || 0;
      if (specialties !== undefined) techUpdateData.specialties = specialties;
      if (status !== undefined) techUpdateData.status = status;
      if (portfolioImages !== undefined) techUpdateData.portfolioImages = JSON.stringify(portfolioImages);
      if (desiredSalaryType !== undefined) techUpdateData.desiredSalaryType = desiredSalaryType;
      if (desiredSalaryAmount !== undefined) techUpdateData.desiredSalaryAmount = desiredSalaryAmount;
      if (desiredBenefits !== undefined) techUpdateData.desiredBenefits = desiredBenefits;
      if (avgTenureMonths !== undefined) techUpdateData.avgTenureMonths = avgTenureMonths === null || avgTenureMonths === "" ? null : Number(avgTenureMonths);
      if (state !== undefined) techUpdateData.state = state;
      if (city !== undefined) techUpdateData.city = city;

      updatedTechnicianProfile = await prisma.technicianProfile.upsert({
        where: { userId },
        update: techUpdateData,
        create: {
          userId,
          bio: bio || "",
          yearsOfExperience: Number(yearsOfExperience) || 0,
          specialties: specialties || "",
          status: status || "AVAILABLE",
          desiredSalaryType: desiredSalaryType || null,
          desiredSalaryAmount: desiredSalaryAmount || null,
          desiredBenefits: desiredBenefits || null,
          avgTenureMonths: avgTenureMonths ? Number(avgTenureMonths) : null,
          market: updatedUser.market,
          state: state || updatedUser.state || "",
          city: city || updatedUser.city || "",
          portfolioImages: JSON.stringify(portfolioImages || []),
        },
      });
    }

    return NextResponse.json({
      message: "Cập nhật hồ sơ thành công! 🎉",
      user: updatedUser,
      technicianProfile: updatedTechnicianProfile
        ? {
            ...updatedTechnicianProfile,
            portfolioImages: JSON.parse(updatedTechnicianProfile.portfolioImages || "[]"),
          }
        : undefined,
    });
  } catch (err: any) {
    console.error("PUT profile error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi cập nhật hồ sơ." },
      { status: 500 }
    );
  }
}

// DELETE own account — required by both App Store (Guideline 5.1.1(v)) and
// Google Play for any app that supports account creation: users must be able
// to delete their account from inside the app, not just via a support email.
// Cascades (see prisma/schema.prisma onDelete: Cascade) take care of Job,
// TechnicianProfile, Message (sent by this user), and UnlockContact rows.
// Conversations/messages from the OTHER participant are intentionally left
// untouched — deleting your account doesn't erase someone else's data.
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xóa tài khoản." },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ message: "Đã xóa tài khoản thành công." });
  } catch (err: any) {
    console.error("DELETE profile error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xóa tài khoản." },
      { status: 500 }
    );
  }
}
