import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Market } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["OWNER", "TECHNICIAN"];
const VALID_MARKETS = ["US", "AU"];

function toCsv(val: unknown): string {
  if (Array.isArray(val)) return val.filter(Boolean).join(",");
  if (typeof val === "string") return val;
  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { name, email, password, role, market, phone, state, city } = body;

    name = typeof name === "string" ? name.trim() : "";
    email = typeof email === "string" ? email.trim().toLowerCase() : "";
    password = typeof password === "string" ? password : "";
    phone = typeof phone === "string" ? phone.trim() : "";
    state = typeof state === "string" ? state.trim() : "";
    city = typeof city === "string" ? city.trim() : "";

    if (!name || !email || !password || !role || !market) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin bắt buộc." },
        { status: 400 }
      );
    }
    if (name.length > 80) {
      return NextResponse.json({ error: "Tên quá dài (tối đa 80 ký tự)." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Địa chỉ email không hợp lệ." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Mật khẩu phải từ 8 đến 128 ký tự." }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Loại tài khoản không hợp lệ." }, { status: 400 });
    }
    if (!VALID_MARKETS.includes(market)) {
      return NextResponse.json({ error: "Thị trường không hợp lệ." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng. Vui lòng chọn email khác." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const marketEnum = market === "AU" ? Market.AU : Market.US;

    const initial = encodeURIComponent(name.charAt(0).toUpperCase());
    const defaultAvatar = `https://ui-avatars.com/api/?name=${initial}&background=ec4899&color=ffffff&size=128&bold=true&format=png`;

    if (role === "TECHNICIAN") {
      const {
        specialties, // string[]
        desiredSalaryType,
        desiredSalaryAmount,
        desiredBenefits, // string[]
        portfolioImages, // string[]
        status, // "AVAILABLE" | "URGENT" | "BETTER"
      } = body;

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.TECHNICIAN,
          market: marketEnum,
          phone: phone || null,
          state: state || null,
          city: city || null,
          avatarUrl: defaultAvatar,
        },
      });

      await prisma.technicianProfile.create({
        data: {
          userId: user.id,
          specialties: toCsv(specialties),
          status: ["AVAILABLE", "URGENT", "BETTER"].includes(status) ? status : "AVAILABLE",
          desiredSalaryType: desiredSalaryType || null,
          desiredSalaryAmount: desiredSalaryAmount || null,
          desiredBenefits: toCsv(desiredBenefits) || null,
          market: marketEnum,
          state: state || "",
          city: city || "",
          portfolioImages: JSON.stringify(Array.isArray(portfolioImages) ? portfolioImages : []),
        },
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json(
        { message: "Đăng ký thành công!", user: userWithoutPassword },
        { status: 201 }
      );
    }

    // role === "OWNER"
    const {
      salonName,
      urgentRole, // string[] skills needed
      salaryType,
      salaryAmount,
      hasHousing, // boolean
      diagnosedPains, // string[] tags from 5-question survey
      surveyAnswers, // full per-question answer log for Admin Lead Radar
    } = body;

    const safeSalonName = typeof salonName === "string" && salonName.trim() ? salonName.trim() : `Tiệm của ${name}`;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.OWNER,
        market: marketEnum,
        phone: phone || null,
        state: state || null,
        city: city || null,
        avatarUrl: defaultAvatar,
        diagnosedPains: toCsv(diagnosedPains) || null,
        surveyAnswers: Array.isArray(surveyAnswers) ? JSON.stringify(surveyAnswers) : null,
      },
    });

    // Tin tuyển dụng mồi — tạo ngay lúc đăng ký để tiệm có tin đầu tiên hiển thị
    if (state && city && phone) {
      const benefits: string[] = [];
      if (hasHousing) benefits.push("Có chỗ ở");

      await prisma.job.create({
        data: {
          title: Array.isArray(urgentRole) && urgentRole.length > 0
            ? `Cần thợ ${urgentRole.join("/")} gấp`
            : "Cần thợ Nail gấp",
          salonName: safeSalonName,
          description: `${safeSalonName} tại ${city}, ${state} đang cần tuyển thợ nail gấp.`,
          ownerId: user.id,
          market: marketEnum,
          state,
          city,
          salaryType: salaryType || (market === "AU" ? "Theo giờ AUD" : "Bao lương tuần"),
          salaryAmount: salaryAmount || "Thỏa thuận",
          skills: toCsv(urgentRole),
          benefits: benefits.join(","),
          phone,
          isUrgent: true,
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
