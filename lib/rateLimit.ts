// Bộ đếm chống spam/brute-force dùng chung, lưu trong bộ nhớ tiến trình.
// Giới hạn: chỉ có tác dụng trong 1 tiến trình Node.js đơn lẻ (đúng với cách
// app đang chạy qua `npm start`) — nếu sau này scale ra nhiều
// instance/serverless, cần chuyển xuống DB hoặc Redis dùng chung.
const buckets = new Map<string, { count: number; firstAttemptAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const entry = buckets.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > windowMs) {
    buckets.delete(key);
    return false;
  }
  return entry.count >= limit;
}

export function recordAttempt(key: string, windowMs: number): void {
  const entry = buckets.get(key);
  if (!entry || Date.now() - entry.firstAttemptAt > windowMs) {
    buckets.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string): void {
  buckets.delete(key);
}

// req.ip không tồn tại trên NextRequest chạy Node runtime — phải tự đọc từ
// header do proxy (Vercel/nginx...) gắn vào. Không có header nào thì coi mọi
// request là chung 1 "IP" ẩn danh — vẫn còn tác dụng chặn spam từ 1 nguồn
// duy nhất (kịch bản phổ biến nhất của bot đơn giản), dù kém chính xác hơn.
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
