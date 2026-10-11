// Tài khoản DỮ LIỆU MẪU (seed/demo) có email đuôi pawnailjobs.demo (xem scripts/seed-*.ts).
// Không bao giờ giới thiệu dữ liệu mẫu như thật ở nơi người dùng tin là thật: email,
// Google (sitemap / JobPosting), thông báo.
export const DEMO_EMAIL_SUFFIX = "pawnailjobs.demo";
export const isDemoEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
/** Điều kiện Prisma cho bảng User: chỉ tài khoản thật. */
export const realUserWhere = { NOT: { email: { endsWith: DEMO_EMAIL_SUFFIX } } } as const;
