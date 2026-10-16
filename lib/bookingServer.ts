// Phần chỉ chạy trên máy chủ của Đặt lịch / Đánh giá khách.

/** Link đánh giá tuyệt đối (gửi qua SMS) — dùng tên miền chính thức (NEXTAUTH_URL), không phải URL bản deploy. */
export function withReviewUrl<T extends { reviewToken: string | null }>(req: Request, b: T): T & { reviewUrl: string | null } {
  const origin = (process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, "");
  return { ...b, reviewUrl: b.reviewToken ? `${origin}/r/${b.reviewToken}` : null };
}
