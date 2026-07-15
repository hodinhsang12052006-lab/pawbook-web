import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// GET user profile data
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

    const [user, posts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          bio: true,
          phone: true,
          address: true,
          cover_image: true,
          cv_url: true,
          skills: true,
          reputation: true,
          trustScore: true,
          isVerified: true,
          pawCoin: true,
          jobs: {
            select: {
              id: true,
              title: true,
              companyName: true,
              salary: true,
              niche: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc"
            }
          }
        },
      }),
      prisma.post.findMany({
        where: { authorId: userId },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
              bio: true,
            }
          }
        }
      })
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "Tài khoản người dùng không tồn tại." },
        { status: 444 }
      );
    }

    // Ensure nested jobs Date fields are serialized to ISO strings
    const safeJobs = (user.jobs || []).map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
    }));

    const safePosts = (posts || []).map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ...user,
      jobs: safeJobs,
      posts: safePosts,
      location: user.address,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải thông tin hồ sơ." },
      { status: 500 }
    );
  }
}

// PUT/PATCH update user profile
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

    const {
      name,
      bio,
      phone,
      address,
      location,
      cover_image,
      cv_url,
      skills,
      avatarUrl,
    } = body;

    // Build update object dynamically
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    
    const addressValue = address !== undefined ? address : location;
    if (addressValue !== undefined) updateData.address = addressValue;

    if (cover_image !== undefined) updateData.cover_image = cover_image;
    if (cv_url !== undefined) {
      updateData.cv_url = cv_url;
      updateData.cvUrl = cv_url; // sync camelCase cvUrl too so existing E2E/pages don't break!
    }
    if (skills !== undefined) updateData.skills = skills;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        cvUrl: true,
        skills: true,
        bio: true,
        phone: true,
        address: true,
        cover_image: true,
        cv_url: true,
        pawCoin: true,
        reputation: true,
        trustScore: true,
        isVerified: true,
        lastDailyReward: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Cập nhật hồ sơ thành công! 🎉",
      user: {
        ...updatedUser,
        location: updatedUser.address,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi hệ thống khi cập nhật hồ sơ." },
      { status: 500 }
    );
  }
}
