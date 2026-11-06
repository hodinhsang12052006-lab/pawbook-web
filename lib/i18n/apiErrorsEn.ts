// Bản tiếng Anh của câu báo lỗi API. Route trả { error: <vi>, errorEn: <en> }; trình duyệt chọn theo
// ngôn ngữ trang qua apiError() (lib/i18n/apiError.ts) — người dùng tiếng Anh không bao giờ thấy câu
// lỗi tiếng Việt.
//
// Câu cố định đã được ghi thẳng errorEn ngay trong route. Bảng này dành cho câu lỗi do hàm thư viện
// trả về (parseBooking, parseMenuItem, giới hạn chống spam…) và câu có số / tên trường.
// Chỉ import ở máy chủ (route handler).

const EN: Record<string, string> = {
  // Đặt lịch (lib/booking.ts)
  "Thiếu thợ / tiệm.": "Missing the technician or salon.",
  "Nhập tên của bạn.": "Enter your name.",
  "Số điện thoại chưa đúng (Mỹ 10 số, Úc 04xx…).": "Check your phone number (US: 10 digits, AU: 04xx xxx xxx).",
  "Số điện thoại chưa đúng (Mỹ: 10 số, Úc: 04xx xxx xxx).": "Check your phone number (US: 10 digits, AU: 04xx xxx xxx).",
  "Ngày chưa hợp lệ.": "Please choose a valid date.",
  "Mẫu này không còn trong menu.": "This design is no longer on the menu.",
  // Menu (lib/menu.ts)
  "Nhập tên mẫu (ít nhất 2 ký tự).": "Enter a name (at least 2 characters).",
  "Nhập giá (0–5000 USD/AUD).": "Enter a price between 0 and 5,000.",
  "Ảnh phải tải lên qua PawNail.": "Photos must be uploaded through PawNail.",
  // Chống spam (lib/abuseGuard.ts)
  "Bạn gửi hơi nhiều, thử lại sau ít phút nhé.": "Too many requests. Please try again in a few minutes.",
  "Bạn gửi hơi nhiều, thử lại sau nhé.": "Too many requests. Please try again later.",
  "Bạn thao tác quá nhanh, thử lại sau.": "You're going a little fast. Please try again shortly.",
  // SMS / đăng nhập bằng số điện thoại (lib/sms.ts, lib/phoneAuth.ts)
  "Không gửi được mã, thử lại sau.": "Couldn't send the code. Please try again later.",
  "Bạn đã yêu cầu mã quá nhiều lần — thử lại sau 1 giờ.": "Too many code requests. Please try again in an hour.",
  "Nhập sai quá nhiều lần — thử lại sau 1 giờ.": "Too many incorrect attempts. Please try again in an hour.",
  "Số điện thoại chưa đúng — chỉ nhận số Mỹ (+1) hoặc Úc (+61).": "Check your phone number. Only US (+1) and Australian (+61) numbers are supported.",
  "Tính năng xác minh SMS chưa bật.": "SMS verification isn't available right now.",
  "Đăng nhập bằng SĐT chưa bật.": "Phone sign-in isn't available right now.",
  "Mã gồm 6 chữ số.": "The code has 6 digits.",
  "Mã không đúng hoặc đã hết hạn.": "That code is incorrect or has expired.",
  "Số điện thoại không hợp lệ.": "That phone number isn't valid.",
  "Gửi quá nhiều lần, thử lại sau.": "Too many attempts. Please try again later.",
  "Số này đã nhận mã nhiều lần — thử lại sau ít phút nữa.": "This number has received several codes. Please try again in a few minutes.",
  "Bạn đã yêu cầu mã quá nhiều lần hôm nay — thử lại ngày mai hoặc đăng nhập bằng email.": "Too many code requests today. Try again tomorrow or log in with email.",
  "Hệ thống gửi SMS đang tạm nghỉ — vui lòng đăng nhập bằng email hoặc Google.": "Text messages are paused right now. Please log in with email or Google.",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Hôm nay bạn đã nhắn cho (\d+) người mới/, (m) => `You've messaged ${m[1]} new people today. To prevent spam, you can message new people again tomorrow. Your existing conversations still work.`],
  [/^Nhóm tối đa (\d+) người\.$/, (m) => `A group can have up to ${m[1]} people.`],
  [/^Hôm nay bạn đã tạo (\d+) nhóm/, (m) => `You've created ${m[1]} groups today. You can create more tomorrow.`],
  [/^Mỗi tiệm đăng tối đa (\d+) tin \/ ngày/, (m) => `Each salon can post up to ${m[1]} jobs a day to keep the job board free of spam. You can post again tomorrow.`],
  [/^Menu tối đa (\d+) mẫu\.$/, (m) => `A menu can have up to ${m[1]} items.`],
  [/^Trường "(.+)" không hợp lệ hoặc quá dài\.$/, (m) => `The "${m[1]}" field is invalid or too long.`],
  [/^Trường "(.+)" không hợp lệ\.$/, (m) => `The "${m[1]}" field is invalid.`],
  [/^Điểm "(.+)" phải là số nguyên từ 1 đến 5\.$/, (m) => `The "${m[1]}" score must be a whole number from 1 to 5.`],
];

const GENERIC = "Something went wrong. Please try again.";

/** Câu lỗi tiếng Việt → tiếng Anh. Không có trong bảng → câu chung (không bao giờ trả tiếng Việt). */
export function errorEn(vi: string | null | undefined): string {
  if (!vi) return GENERIC;
  const hit = EN[vi];
  if (hit) return hit;
  for (const [re, f] of PATTERNS) {
    const m = vi.match(re);
    if (m) return f(m);
  }
  // Câu không dấu (đã là tiếng Anh, ví dụ "Unauthorized") giữ nguyên.
  return /[À-ỹ]/.test(vi) ? GENERIC : vi;
}
