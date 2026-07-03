import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      password,
      persona,
      skills,
      bio,
      shopName,
      category,
    } = body;

    // Validation
    if (!name || !email || !password || !persona) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin bắt buộc." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng. Vui lòng chọn email khác." },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Initial avatar based on first letter of name
    const initial = encodeURIComponent(name.charAt(0).toUpperCase());
    const defaultAvatar = `https://ui-avatars.com/api/?name=${initial}&background=2563eb&color=ffffff&size=128&bold=true`;

    // Map role based on Persona selection
    // Persona options: CANDIDATE, SPECIALIST, BUSINESS
    const isBusiness = persona === "BUSINESS";
    const role = isBusiness ? Role.EMPLOYER : Role.USER;

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        avatarUrl: defaultAvatar,
        skills: !isBusiness && skills ? skills : "",
        bio: isBusiness ? `Chủ sở hữu của ${shopName || "Cửa hàng dịch vụ"}` : (bio || "Thành viên mới gia nhập PawBook."),
        pawCoin: 150, // Starting gift coins
        reputation: 10,
        trustScore: 5.0,
      },
    });

    // Auto-create Service Shop if Owner role is chosen
    if (isBusiness && shopName) {
      await prisma.service.create({
        data: {
          name: shopName,
          category: category || "Chưa phân loại",
          description: `Gian hàng dịch vụ của ${shopName} được tạo lập tự động qua cổng Onboarding Wizard của PawBook.`,
          location: "Chưa cập nhật",
          contactInfo: email,
          priceRange: "Thỏa thuận",
          rating: 5.0,
          ownerId: user.id,
        },
      });
    }

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(
      { message: "Đăng ký thành công!", user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration route error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống trong quá trình đăng ký." },
      { status: 500 }
    );
  }
}
