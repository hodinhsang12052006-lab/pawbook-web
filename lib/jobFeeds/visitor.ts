// Người xem THẬT cho tìm kiếm Careerjet: Careerjet yêu cầu mỗi lượt gọi là 1 lượt tìm của người thật, kèm IP + trình
// duyệt của chính người đó. Route /api/jobs/web-search chỉ gọi Careerjet khi:
//   - IP lấy từ header của Vercel (x-vercel-forwarded-for → x-real-ip → x-forwarded-for), là IP công cộng hợp lệ
//     (không tin cf-connecting-ip: app không đứng sau Cloudflare nên ai cũng tự đặt được header này);
//   - User-Agent có và không phải bot / script (curl, python, headless…);
//   - yêu cầu đến từ chính trang PawNail (Sec-Fetch-Site same-origin, hoặc Origin / Referer cùng host).
// Thuần hàm → kiểm thử được (scripts/qa/external_jobs_routes.mts).
import net from "node:net";

const BOT_UA = /bot\b|crawl|spider|slurp|curl\/|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|headless|phantom|puppeteer|playwright|lighthouse|preview|facebookexternalhit|scrapy|postman|insomnia/i;

/** IPv4 / IPv6 công cộng (loại mạng nội bộ, loopback, link-local, CGNAT, multicast, tài liệu mẫu…). */
export function isPublicIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false; // 192.0.0.0/24 + 192.0.2.0/24 (tài liệu)
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && ip.split(".")[2] === "113") return false; // 203.0.113.0/24 (tài liệu)
    return true;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return false;
    if (x.startsWith("::ffff:")) return isPublicIp(x.slice(7));
    if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("2001:db8")) return false;
    return true;
  }
  return false;
}

/** IP người xem theo header của Vercel; null nếu không có / không phải IP công cộng. */
export function visitorIp(req: Request): string | null {
  const h = req.headers;
  const raw = (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || h.get("x-forwarded-for") || "").split(",")[0].trim();
  return raw && isPublicIp(raw) ? raw : null;
}

export const isHumanUa = (ua: string | null | undefined) => {
  const s = String(ua || "").trim();
  return s.length >= 10 && /mozilla|opera/i.test(s) && !BOT_UA.test(s);
};

/** Yêu cầu do chính trang PawNail gửi (nút "Tìm thêm việc nail trên web"), không phải gọi thẳng từ nơi khác. */
export function fromOwnSite(req: Request): boolean {
  const h = req.headers;
  const site = h.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const origin = h.get("origin") || h.get("referer") || "";
  try {
    return !!host && !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}
