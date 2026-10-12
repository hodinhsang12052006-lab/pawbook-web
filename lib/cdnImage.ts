// Ảnh Cloudinary đúng cỡ hiển thị: chèn biến đổi f_auto (WebP/AVIF tuỳ máy) + q_auto + giới hạn chiều
// rộng vào URL — ảnh mẫu nail gốc 1024px nặng 400–500KB, thẻ chỉ hiện ~200–400px. URL đã có biến đổi
// hoặc không phải Cloudinary thì giữ nguyên.
export function cdnImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m || /^(?:[a-z]{1,3}_[^/]*,?)+\//.test(m[2])) return url;
  return `${m[1]}f_auto,q_auto,c_limit,w_${Math.round(width)}/${m[2]}`;
}
