// Tên miền chính thức — dùng cho sitemap, robots, link chia sẻ, dữ liệu có cấu trúc.
// (Trước đây sitemap ghi nhầm pawnailjobs.com, robots trỏ tới tên miền vercel cũ →
// Google không lập chỉ mục được tin tuyển.)
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bitpawos.com").replace(/\/+$/, "");
