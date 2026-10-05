import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getBadges } from "@/lib/badges";
import { toE164 } from "@/lib/sms";

// GET user profile data (own profile, or ?id=<userId> for public view)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("id");

    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.id as string | undefined;
    const userId = targetUserId || sessionUserId;

    if (!userId) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem hồ sơ." },
        { status: 401 }
      );
    }

    // Viewing your own profile (no `id`, or `id` matches your session) gets
    // the full record. Viewing someone ELSE's profile — reachable with no
    // login at all, since /profile/[uid] is a public listing page — must
    // never include email/phone/private survey data: this endpoint used to
    // return those raw regardless of viewer, which both leaked PII to any
    // anonymous caller AND made the paid "Mở khóa liên hệ" feature pointless
    // (the phone number was already sitting in this response for free).
    const isSelf = !targetUserId || targetUserId === sessionUserId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: isSelf,
        role: true,
        avatarUrl: true,
        phone: isSelf,
        market: true,
        state: true,
        city: true,
        diagnosedPains: isSelf,
        turnSplitPolicy: true,
        clientTypePolicy: true,
        housingSupport: true,
        // "Tham gia từ…" trên hồ sơ — không phải dữ liệu nhạy cảm.
        createdAt: true,
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

    const technicianProfile = user.technicianProfile
      ? {
          ...user.technicianProfile,
          // Desired salary is the technician's own negotiation preference —
          // relevant only to themselves (and Admin's lead radar via a
          // separate, already-gated endpoint), not to public viewers.
          desiredSalaryType: isSelf ? user.technicianProfile.desiredSalaryType : null,
          desiredSalaryAmount: isSelf ? user.technicianProfile.desiredSalaryAmount : null,
          desiredBenefits: isSelf ? user.technicianProfile.desiredBenefits : null,
          portfolioImages: JSON.parse(user.technicianProfile.portfolioImages || "[]"),
          createdAt: user.technicianProfile.createdAt.toISOString(),
          updatedAt: user.technicianProfile.updatedAt.toISOString(),
        }
      : null;

    // Huy hiệu tính từ dữ liệu thật (nhiều truy vấn) — CHỈ khi trang hồ sơ xin
    // (?badges=1). Endpoint này còn được gọi mỗi lần mở app để nạp người dùng
    // (SessionUserContext), không được làm chậm mọi lượt tải trang.
    // Lỗi ở đây không được làm hỏng trang hồ sơ.
    const wantBadges = searchParams.get("badges") === "1";
    const badges = wantBadges
      ? await getBadges(user.id).catch((err) => {
          console.error("getBadges error:", err);
          return [];
        })
      : undefined;

    // Hồ sơ tài khoản chính thức (tick xanh): số liệu cộng đồng THẬT, công khai.
    let official: { members: number; availableTechs: number; jobs30d: number; posts: number } | undefined;
    if (wantBadges && user.role === "ADMIN") {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const [members, availableTechs, jobs30d, posts] = await Promise.all([
        prisma.user.count({ where: { role: { in: ["TECHNICIAN", "OWNER"] } } }),
        prisma.technicianProfile.count({ where: { status: { in: ["AVAILABLE", "URGENT"] } } }),
        prisma.job.count({ where: { createdAt: { gte: since } } }),
        prisma.post.count(),
      ]).catch(() => [0, 0, 0, 0]);
      official = { members, availableTechs, jobs30d, posts };
    }

    // "SĐT đã xác minh" — chỉ khi số đã xác minh KHỚP số đang lưu (đổi số là mất dấu).
    let phoneVerified: boolean | undefined;
    if (wantBadges) {
      phoneVerified = await Promise.all([
        prisma.phoneVerification.findUnique({ where: { userId: user.id }, select: { phone: true } }),
        prisma.user.findUnique({ where: { id: user.id }, select: { phone: true, market: true } }),
      ])
        .then(([v, u]) => !!v && !!u && v.phone === toE164(u.phone, u.market))
        .catch(() => false);
    }

    return NextResponse.json({
      ...user,
      badges,
      official,
      phoneVerified,
      createdAt: user.createdAt.toISOString(),
      jobs: safeJobs,
      technicianProfile,
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

    // Các trường này được echo lại công khai (profile, job board, chat) —
    // chặn kiểu lạ (object làm Prisma ném 500) và chuỗi khổng lồ.
    const textLimits: Record<string, [unknown, number]> = {
      name: [name, 80],
      phone: [phone, 40],
      state: [state, 100],
      city: [city, 100],
      turnSplitPolicy: [turnSplitPolicy, 200],
      clientTypePolicy: [clientTypePolicy, 200],
      avatarUrl: [avatarUrl, 500_000],
      bio: [technician?.bio, 2000],
      specialties: [technician?.specialties, 500],
      status: [technician?.status, 20],
      desiredSalaryType: [technician?.desiredSalaryType, 100],
      desiredSalaryAmount: [technician?.desiredSalaryAmount, 100],
      desiredBenefits: [technician?.desiredBenefits, 500],
    };
    for (const [key, [value, max]] of Object.entries(textLimits)) {
      if (value === undefined || value === null) continue;
      if (typeof value !== "string" || value.length > max) {
        return NextResponse.json({ error: `Trường "${key}" không hợp lệ hoặc quá dài.` }, { status: 400 });
      }
    }
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: "Tên không được để trống." }, { status: 400 });
    }
    const portfolio = technician?.portfolioImages;
    if (portfolio !== undefined) {
      if (
        !Array.isArray(portfolio) ||
        portfolio.length > 30 ||
        portfolio.some((u: unknown) => typeof u !== "string") ||
        JSON.stringify(portfolio).length > 8_000_000
      ) {
        return NextResponse.json({ error: "Danh sách ảnh portfolio không hợp lệ (tối đa 30 ảnh)." }, { status: 400 });
      }
    }

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
