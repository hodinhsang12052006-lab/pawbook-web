import { NextResponse } from "next/server";
import { openWelcomeChat } from "@/lib/welcomeChat";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Market } from "@prisma/client";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rateLimit";
import { attachReferral, readRef } from "@/lib/referral";
import { isLocale } from "@/lib/i18n/config";
import { localeFromRequest } from "@/lib/i18n/server";
import { setUserLocale } from "@/lib/userLocale";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["OWNER", "TECHNICIAN", "CLIENT"];
const VALID_MARKETS = ["US", "AU"];

// Không giới hạn tốc độ trước đây — bcrypt.hash(password, 10) cố tình chậm
// (~50-100ms/lần), nên spam POST liên tục (đổi email mỗi lần để né check
// trùng) là cách rẻ tiền để ghim CPU server, làm chậm/nghẽn cho toàn bộ
// người dùng thật khác — một kiểu "sập server" thực tế hơn cả DDoS network.
const REGISTER_LIMIT = 10;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

import { POSITION_SKILL, canonicalBenefits, canonicalSkills } from "@/lib/nailVocab";

function toCsv(val: unknown): string {
  if (Array.isArray(val)) return val.filter(Boolean).join(",");
  if (typeof val === "string") return val;
  return "";
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp, REGISTER_LIMIT, REGISTER_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau ít phút.", errorEn: "Too many sign-up attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }
    recordAttempt(clientIp, REGISTER_WINDOW_MS);

    const body = await req.json();
    const ref = readRef(req, body); // link mời bạn bè (?ref=) — gắn sau khi tạo tài khoản
    const { role, market } = body;
    // Ngôn ngữ của form đăng ký → tin chào, thông báo đẩy, email về sau.
    const locale = isLocale(body?.locale) ? body.locale : localeFromRequest(req);
    let { name, email, password, phone, state, city } = body;

    name = typeof name === "string" ? name.trim() : "";
    email = typeof email === "string" ? email.trim().toLowerCase() : "";
    password = typeof password === "string" ? password : "";
    phone = typeof phone === "string" ? phone.trim() : "";
    state = typeof state === "string" ? state.trim() : "";
    city = typeof city === "string" ? city.trim() : "";

    if (!name || !email || !password || !role || !market) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin bắt buộc.", errorEn: "Please fill in all required fields." },
        { status: 400 }
      );
    }
    if (name.length > 80) {
      return NextResponse.json({ error: "Tên quá dài (tối đa 80 ký tự).", errorEn: "Names can be up to 80 characters." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Địa chỉ email không hợp lệ.", errorEn: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Mật khẩu phải từ 8 đến 128 ký tự.", errorEn: "Passwords must be 8 to 128 characters." }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Loại tài khoản không hợp lệ.", errorEn: "Invalid account type." }, { status: 400 });
    }
    if (!VALID_MARKETS.includes(market)) {
      return NextResponse.json({ error: "Thị trường không hợp lệ.", errorEn: "Invalid market." }, { status: 400 });
    }
    if (phone.length > 40 || state.length > 100 || city.length > 100) {
      return NextResponse.json({ error: "Thông tin liên hệ quá dài.", errorEn: "The contact details are too long." }, { status: 400 });
    }
    // portfolioImages / surveyAnswers được lưu nguyên khối JSON — giới hạn để
    // 1 request đăng ký không thể nhét hàng chục MB vào DB.
    const { portfolioImages: rawPortfolio, surveyAnswers: rawSurvey } = body;
    if (
      rawPortfolio !== undefined &&
      (!Array.isArray(rawPortfolio) || rawPortfolio.length > 30 || JSON.stringify(rawPortfolio).length > 8_000_000)
    ) {
      return NextResponse.json({ error: "Danh sách ảnh portfolio không hợp lệ (tối đa 30 ảnh).", errorEn: "Invalid portfolio photos (up to 30)." }, { status: 400 });
    }
    if (rawSurvey !== undefined && JSON.stringify(rawSurvey).length > 50_000) {
      return NextResponse.json({ error: "Dữ liệu khảo sát quá lớn.", errorEn: "The survey data is too large." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được sử dụng. Vui lòng chọn email khác.", errorEn: "This email is already in use. Please use a different email." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const marketEnum = market === "AU" ? Market.AU : Market.US;

    // Không gán ảnh mặc định nữa (trước là emoji hoạt hình DiceBear, trông
    // thiếu chuyên nghiệp) — chưa có ảnh thì <Avatar> tự vẽ chữ cái đầu trên
    // nền gradient theo tên, xem lib/avatar.ts.
    const defaultAvatar = null;

    if (role === "CLIENT") {
      // Khách đi làm nail: không hồ sơ thợ, không tin tuyển mồi — chỉ tài khoản + khu vực.
      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role: Role.CLIENT, market: marketEnum, phone: phone || null, state: state || null, city: city || null, avatarUrl: defaultAvatar },
      });
      await attachReferral(user.id, name, ref);
      await setUserLocale(user.id, locale);
      await openWelcomeChat({ userId: user.id, name, role: "CLIENT", locale, email, phone, market: marketEnum, state, city, via: "email" }).catch((e) => console.error("welcome chat error:", e));
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ message: "Đăng ký thành công!", messageEn: "Account created.", user: userWithoutPassword }, { status: 201 });
    }

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
          // Bộ từ vựng chung (lib/nailVocab): giá trị cũ của form đăng ký → giá trị chuẩn của hồ sơ / bộ lọc.
          specialties: canonicalSkills(Array.isArray(specialties) ? specialties : []).join(","),
          status: ["AVAILABLE", "URGENT", "BETTER"].includes(status) ? status : "AVAILABLE",
          desiredSalaryType: desiredSalaryType || null,
          desiredSalaryAmount: desiredSalaryAmount || null,
          desiredBenefits: canonicalBenefits(Array.isArray(desiredBenefits) ? desiredBenefits : []).join(",") || null,
          market: marketEnum,
          state: state || "",
          city: city || "",
          portfolioImages: JSON.stringify(Array.isArray(portfolioImages) ? portfolioImages : []),
        },
      });

      await attachReferral(user.id, name, ref);
      // Admin (tài khoản chính thức) tự nhắn: thông tin đăng ký + lời chào. Làm xong TRƯỚC khi trả lời (~vài chục ms)
      // để vào trang là thấy ngay; lỗi ở bước này không làm hỏng việc đăng ký.
      await setUserLocale(user.id, locale);
      await openWelcomeChat({
        userId: user.id, name, role: "TECHNICIAN", locale, email, phone, market: marketEnum, state, city, via: "email",
        specialties: Array.isArray(specialties) ? specialties : [], desiredSalaryType, desiredSalaryAmount,
        desiredBenefits: Array.isArray(desiredBenefits) ? desiredBenefits : [], status,
        portfolioCount: Array.isArray(portfolioImages) ? portfolioImages.length : 0,
      }).catch((e) => console.error("welcome chat error:", e));
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json(
        { message: "Đăng ký thành công!", messageEn: "Account created.", user: userWithoutPassword },
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

    const safeSalonName = typeof salonName === "string" && salonName.trim() ? salonName.trim() : locale === "vi" ? `Tiệm của ${name}` : `${name}'s salon`;

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
      // Vị trí cần tuyển ("Thợ Bột", "Thợ Dip"…) → kỹ năng chuẩn: tiêu đề "Cần thợ Bột/Acrylic/Dip/SNS" (EN:
      // "Acrylic/Dip/SNS tech needed") và khớp bộ lọc / báo việc như tin đăng thường.
      const roleSkills = [...new Set((Array.isArray(urgentRole) ? urgentRole : []).map((r: unknown) => POSITION_SKILL[String(r)]).filter((s): s is string => !!s))];
      const benefits: string[] = [];
      if (hasHousing) benefits.push("Có chỗ ở");

      await prisma.job.create({
        data: {
          // Tiêu đề chuẩn "Cần thợ …" (dtEn dịch cho người xem tiếng Anh); nhãn "Cần gấp" do isUrgent hiển thị.
          title: roleSkills.length > 0 ? `Cần thợ ${roleSkills.join("/")}` : "Cần thợ Nail",
          salonName: safeSalonName,
          description: locale === "vi"
            ? `${safeSalonName} tại ${city}, ${state} đang tuyển thợ nail.`
            : `${safeSalonName} in ${city}, ${state} is hiring nail technicians.`,
          ownerId: user.id,
          market: marketEnum,
          state,
          city,
          salaryType: salaryType || (market === "AU" ? "Theo giờ AUD" : "Bao lương tuần"),
          salaryAmount: salaryAmount || "Thỏa thuận",
          skills: roleSkills.join(","),
          benefits: benefits.join(","),
          phone,
          isUrgent: true,
        },
      });
    }

    await attachReferral(user.id, name, ref);
    await setUserLocale(user.id, locale);
    await openWelcomeChat({
      userId: user.id, name, role: "OWNER", locale, email, phone, market: marketEnum, state, city, via: "email",
      salonName: safeSalonName, urgentRole: Array.isArray(urgentRole) ? urgentRole : [], salaryType, salaryAmount,
      hasHousing: typeof hasHousing === "boolean" ? hasHousing : undefined,
      surveyAnswers: Array.isArray(surveyAnswers) ? surveyAnswers.filter((a: any) => a && typeof a.key === "string" && (a.answer === "A" || a.answer === "B")) : [],
    }).catch((e) => console.error("welcome chat error:", e));
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(
      { message: "Đăng ký thành công!", messageEn: "Account created.", user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration route error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống trong quá trình đăng ký.", errorEn: "Couldn't create your account. Please try again." },
      { status: 500 }
    );
  }
}
