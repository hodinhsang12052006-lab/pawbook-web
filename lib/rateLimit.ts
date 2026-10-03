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
  // Dọn entry hết hạn khi Map phình to — không thì mỗi IP/email mới thêm 1
  // entry tồn tại mãi trong bộ nhớ tiến trình.
  if (buckets.size > 10_000) {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (now - v.firstAttemptAt > windowMs) buckets.delete(k);
    }
  }
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
//
// Production đi qua Cloudflare -> Vercel: x-forwarded-for / x-real-ip lúc đó
// là IP của EDGE Cloudflare, không phải IP người dùng — mọi người dùng cùng 1
// PoP Cloudflare dùng chung 1 bộ đếm, ngày ra mắt đông người đăng ký cùng lúc
// sẽ bị 429 hàng loạt dù chẳng ai spam. cf-connecting-ip là IP thật do chính
// Cloudflare gắn vào nên được ưu tiên đọc trước.
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
