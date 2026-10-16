// Tài khoản DỮ LIỆU MẪU (seed/demo) có email đuôi pawnailjobs.demo (xem scripts/seed-*.ts).
// Không bao giờ giới thiệu dữ liệu mẫu như thật ở nơi người dùng tin là thật: email,
// Google (sitemap / JobPosting), thông báo.
export const DEMO_EMAIL_SUFFIX = "pawnailjobs.demo";
export const isDemoEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
/** Điều kiện Prisma cho bảng User: chỉ tài khoản thật. */
export const realUserWhere = { NOT: { email: { endsWith: DEMO_EMAIL_SUFFIX } } } as const;

// Dữ liệu mẫu KHÔNG hiện ở chỗ công khai (bảng tin, thợ rảnh, hàng sỉ, xu hướng, hoạt động, thông báo).
// Không xoá gì: tài khoản mẫu vẫn đăng nhập được (cho Apple / Google duyệt app). Muốn hiện lại (VD quay
// video demo): đặt SHOW_DEMO_DATA=1 trên Vercel.
export const showDemoData = () => process.env.SHOW_DEMO_DATA === "1";
/** Điều kiện Prisma cho quan hệ tới User: chỉ người thật (trừ khi SHOW_DEMO_DATA=1). */
export const realOnly = () => (showDemoData() ? {} : realUserWhere);
