// BOT NỘI DUNG PAWNAIL — soạn bài đăng cho tài khoản chính thức, đánh đúng điều
// thợ nail & chủ tiệm tại Mỹ/Úc quan tâm nhất: TIỀN (thuế, tip, lương),
// AN TOÀN (lừa đảo), SỨC KHOẺ, TAY NGHỀ, QUẢN LÝ TIỆM, XU HƯỚNG.
// Bài có bản tiếng Anh (`en`) mới hiện với người xem tiếng Anh (lib/postEn.ts); bài chỉ có tiếng Việt
// (kho kiến thức, "Tiếng Anh tiệm nail"…) chỉ hiện với người dùng tiếng Việt.
//
// Nguyên tắc:
//   • Đúng lúc: bài theo mùa (hạn thuế quý, mùa thuế, mùa lễ…) được ưu tiên.
//   • Đúng sự thật: số liệu thuế lấy từ nguồn chính thống (IRS, ATO, Fair Work —
//     đã kiểm tra 10/2026), luôn kèm nguồn + lời nhắc hỏi CPA/kế toán.
//   • Dùng được ngay: mở bài bằng 1 câu "đánh trúng" + 3–5 ý thực tế + lời kêu
//     gọi lưu/chia sẻ/bình luận (tâm lý: sợ mất tiền, muốn kiếm thêm, muốn an toàn).
//   • Không tự đăng: admin đọc, sửa nếu cần, rồi mới đăng.

import { LIBRARY_TOPICS } from "@/lib/contentLibrary";

export type Pillar = "money" | "safety" | "health" | "skills" | "owner" | "trend" | "community";
export type Audience = "tech" | "owner" | "all";

export interface BotDraft {
  id: string; // ổn định → không đăng trùng
  pillar: Pillar;
  audience: Audience;
  market: "US" | "AU" | "ALL";
  pinned: boolean; // bài ghim đầu hồ sơ (📌)
  seasonal: boolean;
  title: string;
  text: string; // bài hoàn chỉnh để đăng
  textEn?: string; // bản tiếng Anh (nếu chủ đề có) — lưu kèm bài, hiện cho người xem tiếng Anh
  caption: string; // bản ngắn cho Facebook / TikTok
  sources: { label: string; url: string }[];
}

export const PILLAR_LABEL: Record<Pillar, string> = {
  money: "💵 Tiền & thuế", safety: "🛡️ An toàn", health: "🩺 Sức khoẻ thợ", skills: "📈 Tay nghề & thu nhập",
  owner: "🏪 Quản lý tiệm", trend: "🎨 Xu hướng", community: "💬 Cộng đồng",
};

const TAX_NOTE = "ℹ️ Thông tin chung, không thay cho tư vấn thuế — trường hợp cụ thể hãy hỏi CPA / kế toán của bạn.";
const TAX_NOTE_EN = "ℹ️ General information, not tax advice — ask your CPA or accountant about your situation.";
const SRC = {
  irsTips: { label: "IRS — No tax on tips", url: "https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors" },
  irsEst: { label: "IRS — Estimated taxes", url: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes" },
  irsSE: { label: "IRS — Self-employment tax", url: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes" },
  irsTipRec: { label: "IRS — Tip recordkeeping & reporting", url: "https://www.irs.gov/businesses/small-businesses-self-employed/tip-recordkeeping-and-reporting" },
  irs1099: { label: "IRS — Form 1099-NEC", url: "https://www.irs.gov/forms-pubs/about-form-1099-nec" },
  atoSuper: { label: "ATO — Super guarantee", url: "https://www.ato.gov.au/businesses-and-organisations/super-for-employers" },
  atoLodge: { label: "ATO — Lodging your tax return", url: "https://www.ato.gov.au/individuals-and-families/your-tax-return" },
  atoGst: { label: "ATO — Registering for GST", url: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst" },
  fairWork: { label: "Fair Work Ombudsman — Contractors vs employees", url: "https://www.fairwork.gov.au/find-help-for/independent-contractors" },
  ftc: { label: "FTC — Job scams", url: "https://consumer.ftc.gov/articles/job-scams" },
  osha: { label: "OSHA — Nail salon workers", url: "https://www.osha.gov/nail-salons" },
} as const;

export interface Topic {
  id: string;
  pillar: Pillar;
  audience: Audience;
  market: "US" | "AU" | "ALL";
  pinned?: boolean;
  /** Bài theo mùa: hàm trả về true nếu hôm nay đúng lúc (thường ~2–6 tuần trước hạn). */
  when?: (d: Date) => boolean;
  title: (ctx: Ctx) => string;
  bullets: (ctx: Ctx) => string[];
  cta: string;
  tax?: boolean;
  sources?: { label: string; url: string }[];
  tags: string;
  /** Bản tiếng Anh (không bắt buộc). Cùng khuôn: emoji + tiêu đề / các ý / lời kêu gọi / nguồn / hashtag. */
  en?: { title: (ctx: Ctx) => string; bullets: (ctx: Ctx) => string[]; cta: string; tags: string };
}
export interface Ctx { now: Date; theme?: { title: string; emoji: string } | null }

const md = (d: Date) => (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); // 1015 = 15/10
const between = (from: number, to: number) => (d: Date) => (from <= to ? md(d) >= from && md(d) <= to : md(d) >= from || md(d) <= to);

// Hạn đóng thuế ước tính (Mỹ): 15/4, 15/6, 15/9, 15/1 — nhắc trong 21 ngày trước hạn.
const QUARTERLY = [[4, 15], [6, 15], [9, 15], [1, 15]] as const;
function nextQuarterly(now: Date) {
  const y = now.getUTCFullYear();
  const cands = [y, y + 1].flatMap((yy) => QUARTERLY.map(([m, d]) => new Date(Date.UTC(yy, m - 1, d))));
  return cands.filter((c) => c.getTime() >= now.getTime() - 86_400_000).sort((a, b) => a.getTime() - b.getTime())[0];
}
const daysTo = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
const vnDate = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;

const BASE_TOPICS: Topic[] = [
  // ---------- Bài ghim ----------
  {
    id: "welcome", pillar: "community", audience: "all", market: "ALL", pinned: true,
    title: () => "📌 Chào mừng đến với PawNail — nền tảng dành cho ngành nail tại Mỹ và Úc",
    bullets: () => [
      "Thợ và tiệm liên hệ trực tiếp — nhắn tin và gọi ngay trong app. PawNail không thu phí thợ và tiệm.",
      "Đánh giá hai chiều từ những người đã thực sự làm việc cùng nhau.",
      "Mẫu nail mới mỗi ngày kèm vật tư và các bước làm, mức lương tham khảo theo bang, và chợ vật tư.",
      "Cần hỗ trợ tài khoản, báo lừa đảo hay góp ý tính năng? Hãy nhắn cho tài khoản này.",
    ],
    cta: "Theo dõi PawNail để nhận tin tuyển mới, mẹo nghề và thông tin thuế quan trọng.",
    tags: "#PawNail #ThoNail #TiemNail #ViecLamNail",
    en: {
      title: () => "📌 Welcome to PawNail — the platform for the nail industry in the US and Australia",
      bullets: () => [
        "Techs and salons connect directly: message and call in the app. PawNail doesn't charge techs or salons.",
        "Two-way reviews from people who actually worked together.",
        "Daily nail designs with materials and steps, pay benchmarks by state, and a supply exchange.",
        "Need account help, want to report a scam or suggest a feature? Message this account.",
      ],
      cta: "Follow PawNail for new jobs, pro tips and important tax updates.",
      tags: "#PawNail #NailTech #NailSalon #NailJobs",
    },
  },
  {
    id: "safety-pinned", pillar: "safety", audience: "all", market: "ALL", pinned: true,
    title: () => "📌 3 nguyên tắc an toàn trên PawNail — đọc trong 30 giây",
    bullets: () => [
      "PawNail và tiệm uy tín không bao giờ đòi chuyển tiền cọc để \"giữ chỗ làm\", \"mua đồ nghề\" hay \"làm giấy tờ\". Ai đòi, hãy dừng ngay.",
      "Thoả thuận lương, chia turn, chỗ ở qua tin nhắn trong app để có bằng chứng khi cần.",
      "Thấy dấu hiệu lạ: bấm ⋮ → Báo cáo. Báo cáo được đội ngũ PawNail xem xét và người báo được giữ kín.",
    ],
    cta: "Chia sẻ cho người mới vào nghề — một lần nhắc có thể giữ lại cả tháng lương.",
    sources: [SRC.ftc],
    tags: "#PawNail #AnToan #LuaDao",
    en: {
      title: () => "📌 3 safety rules on PawNail — a 30-second read",
      bullets: () => [
        "PawNail and legitimate salons never ask for a deposit to \"hold a job\", \"buy tools\" or \"do paperwork\". If anyone asks, stop.",
        "Agree on pay, commission split and housing in app messages, so you have a record if you need it.",
        "See something off? Tap ⋮ → Report. Reports are reviewed by the PawNail team, and the person reporting stays anonymous.",
      ],
      cta: "Share this with someone new to the trade — one reminder can save a month's pay.",
      tags: "#PawNail #StaySafe #NailTech",
    },
  },

  // ---------- 💵 Tiền & thuế (Mỹ) ----------
  {
    id: "no-tax-on-tips", pillar: "money", audience: "tech", market: "US", tax: true,
    title: () => "💵 Thợ nail được trừ tới $25,000 tiền TIP khỏi thu nhập chịu thuế (2025–2028) — bạn đã biết chưa?",
    bullets: () => [
      "Nghề thợ nail (manicurist & pedicurist) NẰM TRONG danh sách nghề được hưởng của IRS.",
      "Tính cho tip khách TỰ NGUYỆN cho — tiền mặt hay quẹt thẻ, kể cả tip chia lại. Phí dịch vụ bắt buộc thì không tính.",
      "Mức trừ giảm dần nếu thu nhập (MAGI) trên $150,000 (khai độc thân) hoặc $300,000 (vợ chồng khai chung).",
      "Vẫn PHẢI khai đủ tip: khoản trừ chỉ giảm thuế thu nhập, Social Security & Medicare vẫn tính như thường.",
      "Cần SSN hợp lệ để đi làm; vợ chồng phải khai chung mới được trừ.",
    ],
    cta: "👉 Ghi tip mỗi ngày (mục \"Thu nhập & tip\" trong app) để mùa thuế có số liệu rõ ràng. Lưu bài này & gửi cho bạn thợ nhé!",
    sources: [SRC.irsTips],
    tags: "#ThueThoNail #NoTaxOnTips #TipThoNail",
  },
  {
    id: "1099-vs-w2", pillar: "money", audience: "all", market: "US", tax: true,
    title: () => "🧾 Nhận lương 1099 hay W-2? 5 điều thợ nail cần hiểu TRƯỚC khi nhận việc",
    bullets: () => [
      "W-2 (nhân viên): tiệm khấu trừ thuế mỗi kỳ lương và đóng một nửa Social Security/Medicare cho bạn.",
      "1099 (tự kinh doanh): không ai khấu trừ — bạn tự đóng thuế thu nhập + thuế tự kinh doanh 15.3% (Social Security + Medicare).",
      "Làm 1099 nên để riêng một phần thu nhập mỗi tuần cho thuế (nhiều kế toán khuyên 25–30%) để cuối năm không bị \"sốc\".",
      "1099 được trừ chi phí làm nghề có hoá đơn: dụng cụ, vật tư tự mua, phí gia hạn license, khoá học nâng cao tay nghề.",
      "Hỏi rõ ngay từ đầu: tiệm trả theo hình thức nào, có gửi W-2/1099 cuối năm không.",
    ],
    cta: "💬 Tiệm bạn đang trả W-2 hay 1099? Bình luận để mọi người tham khảo nhé.",
    sources: [SRC.irsSE],
    tags: "#ThueThoNail #1099 #W2",
  },
  {
    id: "1099-threshold-2026", pillar: "money", audience: "all", market: "US", tax: true,
    when: between(1001, 228),
    title: () => "📄 Từ 2026: tiệm chỉ phải gửi 1099-NEC khi trả bạn từ $2,000/năm (trước đây $600)",
    bullets: () => [
      "Áp dụng cho các khoản trả từ năm 2026 (khai trong mùa thuế 2027); từ 2027 ngưỡng còn được điều chỉnh theo lạm phát.",
      "Không nhận 1099 KHÔNG có nghĩa là không phải khai: mọi thu nhập, kể cả dưới $2,000, vẫn phải khai thuế.",
      "Chủ tiệm: vẫn nên lưu sổ chi trả từng thợ, và luôn xin W-9 đầy đủ trước khi trả lương.",
    ],
    cta: "🔁 Gửi bài này cho thợ part-time ở tiệm bạn — nhiều người đang hiểu nhầm điểm này.",
    sources: [SRC.irs1099],
    tags: "#ThueThoNail #1099NEC #ChuTiemNail",
  },
  {
    id: "quarterly-tax", pillar: "money", audience: "tech", market: "US", tax: true,
    when: (d) => daysTo(d, nextQuarterly(d)) <= 21,
    title: ({ now }) => `⏰ Thợ 1099 lưu ý: hạn đóng thuế ước tính quý là ${vnDate(nextQuarterly(now))} (còn ${daysTo(now, nextQuarterly(now))} ngày)`,
    bullets: () => [
      "Ai cần đóng: thường là người làm 1099 dự kiến nợ thuế từ $1,000 trở lên cho cả năm.",
      "4 hạn trong năm: 15/4 · 15/6 · 15/9 · 15/1 năm sau. Trễ hạn có thể bị tính tiền phạt + lãi.",
      "Đóng online qua IRS Direct Pay hoặc tài khoản IRS — nhớ lưu biên nhận.",
      "Mẹo: mỗi tuần chuyển sẵn một phần thu nhập sang tài khoản riêng \"tiền thuế\" — đến hạn chỉ việc đóng.",
    ],
    cta: "⏰ Đặt nhắc lịch ngay và chia sẻ cho bạn thợ đang làm 1099 nhé!",
    sources: [SRC.irsEst],
    tags: "#ThueThoNail #ThueQuy #1099",
  },
  {
    id: "year-end-tax", pillar: "money", audience: "all", market: "US", tax: true,
    when: between(1101, 1231),
    title: () => "🗓️ Trước 31/12: 5 việc thợ & chủ tiệm nên làm để mùa thuế nhẹ hơn",
    bullets: () => [
      "Gom hoá đơn vật tư, dụng cụ, phí license, khoá học trong năm — chụp ảnh lưu vào 1 thư mục.",
      "Cộng lại sổ tip cả năm (tiền mặt + thẻ) cho khớp — năm nay tip còn liên quan khoản trừ \"No tax on tips\".",
      "Cập nhật địa chỉ / email với tiệm để nhận đúng W-2 / 1099 trước 31/1.",
      "Chủ tiệm: kiểm tra đủ W-9 của thợ 1099, đối chiếu sổ lương từng người.",
      "Đặt lịch với CPA từ tháng 12 — tháng 2–4 thường kín lịch.",
    ],
    cta: "📌 Lưu lại để cuối tháng 12 mở ra làm theo từng mục.",
    sources: [SRC.irsTipRec],
    tags: "#ThueThoNail #CuoiNam #ChuTiemNail",
  },
  {
    id: "tax-season", pillar: "money", audience: "all", market: "US", tax: true,
    when: between(105, 415),
    title: () => "📬 Mùa thuế: W-2 / 1099 phải tới tay bạn trước 31/1 — hạn khai thuế 15/4",
    bullets: () => [
      "Chưa nhận W-2/1099 sau 31/1? Nhắn tiệm trước, rồi mới liên hệ IRS nếu vẫn không có.",
      "Giấy tờ cần: W-2 và/hoặc 1099, sổ tip, hoá đơn chi phí (nếu làm 1099), ID & SSN, thông tin ngân hàng để nhận refund.",
      "Xin gia hạn (extension) chỉ gia hạn KHAI, không gia hạn ĐÓNG — vẫn phải đóng thuế ước tính trước 15/4.",
      "Cẩn thận dịch vụ khai thuế hứa \"refund thật to\" hay đòi chuyển refund vào tài khoản của họ.",
    ],
    cta: "🔁 Chia sẻ cho cả tiệm — mùa thuế năm nào cũng có người bị lừa.",
    sources: [SRC.irsTipRec],
    tags: "#MuaThue #ThueThoNail",
  },
  {
    id: "tip-records", pillar: "money", audience: "tech", market: "US", tax: true,
    title: () => "📒 Ghi tip mỗi ngày trong 30 giây — và vì sao bây giờ việc này càng quan trọng",
    bullets: () => [
      "Ghi 4 thứ: ngày · tip tiền mặt · tip thẻ · tip chia cho người khác (nếu có).",
      "Là nhân viên: tip từ $20/tháng trở lên phải báo cho chủ tiệm trước ngày 10 tháng sau.",
      "Sổ tip rõ ràng giúp chứng minh thu nhập khi thuê nhà, vay mua xe — và để được trừ thuế tip đúng.",
      "Mục \"Thu nhập & tip\" trong app ghi được ngay sau mỗi khách.",
    ],
    cta: "💬 Bạn đang ghi tip bằng gì: sổ tay, điện thoại hay chưa ghi? Bình luận nhé.",
    sources: [SRC.irsTipRec],
    tags: "#TipThoNail #ThueThoNail",
  },

  // ---------- 💵 Tiền & thuế (Úc) ----------
  {
    id: "au-super", pillar: "money", audience: "tech", market: "AU", tax: true,
    title: () => "🇦🇺 Làm nail ở Úc: từ 1/7/2025 chủ phải đóng super 12% lương cho bạn — bạn đã kiểm tra chưa?",
    bullets: () => [
      "Super guarantee hiện là 12% trên lương thường (ordinary time earnings) của nhân viên.",
      "Kiểm tra tiền super đã vào quỹ chưa qua myGov (liên kết ATO) — nên xem vài tháng một lần.",
      "Ký giấy \"contractor\" nhưng làm như nhân viên (tiệm xếp giờ, cung cấp đồ nghề, trả theo giờ) — có thể bạn vẫn là nhân viên. Hỏi Fair Work nếu không chắc.",
    ],
    cta: "🔁 Gửi cho bạn thợ mới sang Úc — nhiều người không biết mình đang bị thiếu super.",
    sources: [SRC.atoSuper, SRC.fairWork],
    tags: "#ThoNailUc #Super #FairWork",
  },
  {
    id: "au-tax-time", pillar: "money", audience: "all", market: "AU", tax: true,
    when: between(701, 1031),
    title: () => "🧾 Mùa thuế Úc: tự khai thuế thì hạn chót là 31/10",
    bullets: () => [
      "Năm tài chính Úc tính từ 1/7 đến 30/6; tự khai (myTax) hạn 31/10. Khai qua tax agent đã đăng ký thường được hạn muộn hơn.",
      "Giữ hoá đơn chi phí liên quan công việc (dụng cụ tự mua, khoá học nâng cao tay nghề…) để khai khấu trừ đúng.",
      "Có ABN và tự làm: nhớ khai đủ thu nhập kinh doanh, kể cả tiền mặt.",
    ],
    cta: "⏰ Còn chưa khai? Đặt lịch với tax agent ngay tuần này.",
    sources: [SRC.atoLodge],
    tags: "#ThoNailUc #ThueUc #TaxTime",
  },
  {
    id: "au-gst", pillar: "money", audience: "owner", market: "AU", tax: true,
    title: () => "🏪 Tiệm/thợ có ABN ở Úc: doanh thu từ A$75,000/năm là phải đăng ký GST",
    bullets: () => [
      "Ngưỡng tính theo doanh thu GST (GST turnover) — vượt hoặc dự kiến vượt A$75,000 thì phải đăng ký.",
      "Đăng ký rồi thì giá dịch vụ phải tính GST 10% và nộp BAS định kỳ.",
      "Gần ngưỡng: theo dõi doanh thu hằng tháng và hỏi kế toán trước khi vượt.",
    ],
    cta: "💬 Chủ tiệm đã từng vướng GST/BAS chia sẻ kinh nghiệm cho mọi người nhé.",
    sources: [SRC.atoGst],
    tags: "#TiemNailUc #GST #ChuTiemNail",
  },

  // ---------- 🛡️ An toàn ----------
  {
    id: "deposit-scam", pillar: "safety", audience: "tech", market: "ALL",
    title: () => "🚨 Chưa đi làm đã đòi chuyển tiền \"giữ chỗ\" / \"mua đồ nghề\"? Đó là dấu hiệu lừa đảo",
    bullets: () => [
      "Dấu hiệu: lương hứa cao bất thường, giục chuyển tiền gấp, chỉ nhắn tin không cho gọi video, không cho địa chỉ tiệm rõ ràng.",
      "Tiệm thật trả lương cho bạn — không bao giờ thu tiền của thợ để nhận việc.",
      "Gặp trường hợp này: không chuyển tiền, chụp lại tin nhắn, bấm ⋮ → Báo cáo trên PawNail.",
    ],
    cta: "Chia sẻ để người mới vào nghề không mất tiền oan.",
    sources: [SRC.ftc],
    tags: "#LuaDao #AnToan #ThoNail",
    en: {
      title: () => "🚨 Asked to pay to \"hold a job\" or \"buy tools\" before you start? That's a scam",
      bullets: () => [
        "Warning signs: unusually high pay, pressure to send money fast, text-only contact with no video call, no clear salon address.",
        "A real salon pays you — it never charges a tech to get a job.",
        "If this happens: don't send money, screenshot the messages, and tap ⋮ → Report on PawNail.",
      ],
      cta: "Share this so people new to the trade don't lose money.",
      tags: "#ScamAlert #StaySafe #NailTech",
    },
  },
  {
    id: "check-scam", pillar: "safety", audience: "owner", market: "US",
    title: () => "🚨 Chủ tiệm cẩn thận: khách \"trả dư bằng check rồi nhờ chuyển lại phần thừa\"",
    bullets: () => [
      "Kiểu lừa quen thuộc: gửi check/money order nhiều hơn giá, nhờ tiệm chuyển lại phần dư qua Zelle/thẻ quà tặng → vài ngày sau check bị trả về.",
      "Ngân hàng KHÔNG bao giờ gọi xin mã xác nhận, mật khẩu hay bảo bạn \"chuyển tiền sang tài khoản an toàn\".",
      "Nghi ngờ: cúp máy, tự gọi lại số in sau thẻ ngân hàng.",
    ],
    cta: "💬 Tiệm bạn từng gặp chiêu nào? Kể để mọi người cùng tránh.",
    sources: [SRC.ftc],
    tags: "#LuaDao #ChuTiemNail",
    en: {
      title: () => "🚨 Salon owners: watch for clients who \"overpay by check and ask for the difference back\"",
      bullets: () => [
        "The usual setup: a check or money order for more than the price, then a request to send back the extra by Zelle or gift card. A few days later the check bounces.",
        "Your bank will never call to ask for a verification code or password, or tell you to \"move money to a safe account\".",
        "If in doubt, hang up and call the number on the back of your bank card yourself.",
      ],
      cta: "Has your salon seen a scam like this? Share it so others can avoid it.",
      tags: "#ScamAlert #SalonOwner",
    },
  },
  {
    id: "housing", pillar: "safety", audience: "tech", market: "ALL",
    title: () => "🏠 Đi làm xa, tiệm bao ở: 5 điều hỏi kỹ trước khi dọn tới",
    bullets: () => [
      "Địa chỉ chỗ ở cụ thể, ở chung mấy người, phòng riêng hay chung.",
      "Bao ở là miễn phí hay trừ vào lương — trừ bao nhiêu mỗi tuần.",
      "Lương trả ngày nào, tiền mặt hay check, chia turn thế nào.",
      "Gọi video xem tiệm & chỗ ở trước khi mua vé.",
      "Báo cho người thân địa chỉ mới và số điện thoại chủ tiệm.",
    ],
    cta: "Lưu lại — lần sau nhận việc xa chỉ cần hỏi theo danh sách này.",
    tags: "#ThoNail #DiLamXa #AnToan",
  },

  // ---------- 🩺 Sức khoẻ ----------
  {
    id: "dust", pillar: "health", audience: "all", market: "ALL",
    title: () => "😷 Mài bột cả ngày: bảo vệ phổi thế nào cho đúng?",
    bullets: () => [
      "Khẩu trang y tế thường KHÔNG cản được bụi mịn khi mài — dùng loại N95 lúc dũa/mài.",
      "Bàn có máy hút bụi, mở thông gió, đóng nắp lọ liquid/hoá chất khi không dùng.",
      "Đeo găng tay khi dùng hoá chất; không ăn uống ngay tại bàn làm.",
    ],
    cta: "Gửi cho người thân đang làm nail — sức khoẻ là vốn lâu dài của nghề.",
    sources: [SRC.osha],
    tags: "#SucKhoeThoNail #ThoNail",
  },
  {
    id: "back-neck", pillar: "health", audience: "tech", market: "ALL",
    title: () => "🧘 Ngồi 10 tiếng đau lưng mỏi cổ? 4 động tác 2 phút giữa các khách",
    bullets: () => [
      "Xoay vai ra sau 10 lần, kéo nhẹ cằm về sau giữ 5 giây.",
      "Đứng dậy, chống tay sau hông, ưỡn nhẹ lưng 5 lần.",
      "Duỗi cổ tay: tay thẳng, lòng bàn tay hướng ra trước, kéo nhẹ ngón về sau 15 giây mỗi bên.",
      "Chỉnh ghế để khuỷu tay ngang mặt bàn, đèn chiếu đủ sáng để không phải cúi sát.",
    ],
    cta: "💬 Bạn hay bị đau ở đâu nhất? Bình luận để PawNail làm thêm bài hướng dẫn.",
    tags: "#SucKhoeThoNail #ThoNail",
  },

  // ---------- 📈 Tay nghề & thu nhập ----------
  {
    id: "upsell", pillar: "skills", audience: "tech", market: "ALL",
    title: () => "💡 Tăng thu nhập mỗi khách mà không \"ép\": 4 gợi ý khách thường gật đầu",
    bullets: () => [
      "Gợi ý 2 ngón design / charm nhỏ trên nền khách đã chọn — chọn sẵn 2–3 mẫu để khách đỡ phân vân.",
      "Thêm hiệu ứng: mắt mèo, tráng gương, nhũ — cho khách xem mẫu thật trên tay giả.",
      "Sửa móng gãy / dặm lại ngay trong buổi, báo giá trước rõ ràng.",
      "Giới thiệu dầu dưỡng móng để giữ móng lâu — khách quay lại đúng hẹn hơn.",
    ],
    cta: "💬 Dịch vụ thêm nào khách tiệm bạn chọn nhiều nhất? Bình luận chia sẻ nhé!",
    tags: "#ThoNail #TangThuNhap #MauNail",
  },
  {
    id: "portfolio", pillar: "skills", audience: "tech", market: "ALL",
    title: () => "📸 Chủ tiệm lướt ẢNH trước khi nhắn thợ — 5 mẹo chụp móng đẹp bằng điện thoại",
    bullets: () => [
      "Chụp dưới ánh sáng tự nhiên gần cửa sổ, tránh đèn vàng.",
      "Nền trơn (khăn trắng, bàn sáng), tay đặt thả lỏng.",
      "Lau sạch bụi & dầu quanh móng trước khi chụp.",
      "Chụp cận 1 tấm + toàn bàn tay 1 tấm; không lạm dụng filter làm sai màu.",
      "Đăng 3–6 ảnh mẫu thật lên hồ sơ PawNail để tiệm thấy tay nghề ngay.",
    ],
    cta: "👉 Vào Hồ sơ → thêm ảnh mẫu ngay hôm nay.",
    tags: "#ThoNail #Portfolio #MauNail",
  },

  // ---------- 🏪 Quản lý tiệm ----------
  {
    id: "holiday-staffing", pillar: "owner", audience: "owner", market: "ALL",
    when: between(1001, 1210),
    title: () => "🎄 Mùa lễ cuối năm: chủ tiệm nên tuyển thợ từ BÂY GIỜ",
    bullets: () => [
      "Từ giờ tới Năm Mới là mùa đông khách nhất — thợ giỏi được nhiều tiệm mời cùng lúc.",
      "Đăng tin sớm, ghi rõ lương, chia turn, bao ở (nếu có) — tin rõ ràng được nhắn nhiều hơn.",
      "Bán gift card mùa lễ (VD mua $100 tặng $15): có tiền trước, khách quay lại sau lễ.",
    ],
    cta: "👉 Đăng tin tuyển miễn phí trên PawNail — thợ gần tiệm nhận báo ngay.",
    tags: "#ChuTiemNail #TuyenTho #MuaLe",
  },
  {
    id: "google-reviews", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "⭐ Xin khách review Google mà không ngại: 1 câu nói + 1 mã QR ở quầy",
    bullets: () => [
      "Hỏi lúc khách đang khen móng đẹp: \"Chị thích thì review giúp em 1 dòng nha, tiệm nhỏ cần lắm!\"",
      "Đặt mã QR dẫn thẳng tới trang review ở quầy thu ngân và bàn làm.",
      "Trả lời MỌI review (kể cả review xấu) lịch sự trong 1–2 ngày — khách mới đọc phần trả lời rất kỹ.",
    ],
    cta: "💬 Tiệm bạn đang có bao nhiêu review Google?",
    tags: "#ChuTiemNail #GoogleReview #MarketingTiemNail",
  },
  {
    id: "keep-staff", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "🤝 Giữ thợ giỏi: 5 điều thợ nhắc nhiều nhất khi đánh giá tiệm",
    bullets: () => [
      "Trả lương đúng ngày, đúng như đã hứa.",
      "Chia turn công bằng, minh bạch.",
      "Tôn trọng thợ trước mặt khách.",
      "Chỗ làm sạch sẽ, thông thoáng, đủ đồ nghề.",
      "Ghi nhận thợ làm tốt — một lời khen, một khoản thưởng nhỏ mùa lễ.",
    ],
    cta: "💬 Chủ tiệm: bí quyết giữ thợ lâu năm của bạn là gì? Bình luận để mọi người cùng học nhé.",
    tags: "#ChuTiemNail #GiuTho",
  },
  {
    id: "slow-days", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "📉 Thứ 2–4 vắng khách: 4 cách lấp lịch trống",
    bullets: () => [
      "Ưu đãi giờ vắng cho sinh viên / người về hưu (VD giảm 10% thứ 2–4 trước 2 giờ chiều).",
      "Nhắn tin nhắc khách quen đến hạn làm lại (sau 2–3 tuần).",
      "Combo tay + chân giá trọn gói chỉ áp dụng ngày thường.",
      "Đăng mẫu mới lên mạng xã hội vào tối Chủ nhật — đầu tuần khách hay đặt lịch.",
    ],
    cta: "💬 Cách nào hiệu quả nhất ở tiệm bạn? Bình luận chia sẻ nhé!",
    tags: "#ChuTiemNail #MarketingTiemNail",
  },

  // ---------- 11/2026: thêm bài thường (kho 25 bài cạn sau ~12 ngày) — song ngữ, không chủ đề thuế / luật ----------
  {
    id: "gel-lasting", pillar: "skills", audience: "tech", market: "ALL",
    title: () => "💅 Gel bong sau 1 tuần? 5 bước chuẩn bị móng giúp gel bền 3 tuần",
    bullets: () => [
      "Đẩy và lấy sạch da chết trên mặt móng — gel không bám lên lớp da mỏng này.",
      "Dũa nhẹ bóng mặt móng, lau sạch bụi rồi mới lau khô (dehydrate).",
      "Sơn lớp mỏng, chừa 1 đường nhỏ cách da — gel chạm da là dễ bong từ chân.",
      "Bọc mép đầu móng (cap the edge) ở mọi lớp.",
      "Hướng dẫn khách đeo găng khi rửa chén / dùng hoá chất 24 giờ đầu.",
    ],
    cta: "💬 Khách bạn hay bong ở chân móng hay đầu móng? Bình luận nhé!",
    tags: "#ThoNail #GelBen #KyThuatNail",
    en: {
      title: () => "💅 Gel lifting after a week? 5 prep steps for 3-week wear",
      bullets: () => [
        "Push back and remove the cuticle film on the nail plate — gel won't grip it.",
        "Lightly buff off the shine, dust off, then dehydrate.",
        "Apply thin coats and leave a hairline gap from the skin — gel touching skin lifts first.",
        "Cap the free edge on every layer.",
        "Ask clients to wear gloves for dishes and cleaning products for the first 24 hours.",
      ],
      cta: "💬 Do your clients lift at the cuticle or at the tip? Tell us below!",
      tags: "#NailTech #GelNails #NailPrep",
    },
  },
  {
    id: "consult-3q", pillar: "skills", audience: "tech", market: "ALL",
    title: () => "🗣️ 3 câu hỏi trước khi làm giúp khách hài lòng và quay lại",
    bullets: () => [
      "\"Lần trước móng giữ được bao lâu, hay bị gì?\" — biết ngay cần chỉnh kỹ thuật nào.",
      "\"Chị thích dáng / độ dài nào, hay mở hình mẫu cho em xem?\" — tránh làm xong mới chê.",
      "\"Tuần này chị có đi tiệc / du lịch không?\" — gợi ý màu, độ bền phù hợp.",
      "Ghi lại câu trả lời vào ghi chú khách để lần sau hỏi tiếp.",
    ],
    cta: "💬 Câu hỏi nào giúp bạn giữ khách nhất? Chia sẻ nhé!",
    tags: "#ThoNail #ChamSocKhach",
    en: {
      title: () => "🗣️ 3 questions before you start that keep clients coming back",
      bullets: () => [
        "\"How long did your last set last, and what went wrong?\" — tells you what to adjust.",
        "\"Which shape and length do you like? Got a photo?\" — no surprises at the end.",
        "\"Any events or trips this week?\" — suggest colors and durability that fit.",
        "Write the answers in the client notes so you can follow up next time.",
      ],
      cta: "💬 Which question helps you keep clients the most? Share below!",
      tags: "#NailTech #ClientCare",
    },
  },
  {
    id: "rebook-before-leave", pillar: "owner", audience: "all", market: "ALL",
    title: () => "📅 Đặt hẹn lần sau ngay tại bàn — cách đơn giản nhất để giữ khách",
    bullets: () => [
      "Trước khi khách đứng dậy: \"Khoảng 2–3 tuần nữa mình dặm lại, em xếp lịch luôn nha?\"",
      "Đưa 2 giờ cụ thể để khách chọn, đừng hỏi chung chung.",
      "Nhắn tin nhắc 1 ngày trước hẹn — khách ít quên, tiệm ít trống ghế.",
      "Khách đặt trước → thợ có lịch đều, tiệm dễ xếp thợ.",
    ],
    cta: "👉 Gửi link đặt lịch của tiệm cho khách: Hồ sơ → Đặt lịch.",
    tags: "#ChuTiemNail #GiuKhach #DatLich",
    en: {
      title: () => "📅 Rebook at the table — the simplest way to keep a client",
      bullets: () => [
        "Before they get up: \"Fill in 2–3 weeks from now? Let me book it for you.\"",
        "Offer two specific times instead of an open question.",
        "Send a reminder text the day before — fewer no-shows, fewer empty chairs.",
        "Booked-ahead clients mean steadier schedules for techs.",
      ],
      cta: "👉 Share your salon's booking link: Profile → Bookings.",
      tags: "#SalonOwner #ClientRetention #Booking",
    },
  },
  {
    id: "no-show-policy", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "⏰ Khách trễ hẹn, bỏ hẹn: 4 quy định rõ ràng mà khách vẫn vui",
    bullets: () => [
      "Ghi rõ trên menu: trễ quá 15 phút có thể phải dời hẹn hoặc làm gọn dịch vụ.",
      "Nhắn xác nhận trước 1 ngày, khách trả lời \"OK\" là cam kết nhẹ nhàng.",
      "Dịch vụ dài (bộ bột, nghệ thuật) có thể xin đặt cọc nhỏ — nói trước, ghi biên nhận.",
      "Khách quen lỡ 1 lần thì nhắc nhẹ, đừng phạt ngay — giữ khách quan trọng hơn.",
    ],
    cta: "💬 Tiệm bạn xử lý khách bỏ hẹn thế nào? Bình luận nhé!",
    tags: "#ChuTiemNail #QuanLyTiem",
    en: {
      title: () => "⏰ Late clients and no-shows: 4 clear rules clients still like",
      bullets: () => [
        "Say it on the menu: more than 15 minutes late may mean rescheduling or a shorter service.",
        "Text a confirmation the day before — a reply of \"OK\" is a gentle commitment.",
        "Long services (full sets, art) can take a small deposit — say so up front and give a receipt.",
        "A regular who slips once gets a friendly reminder, not a penalty — keeping the client matters more.",
      ],
      cta: "💬 How does your salon handle no-shows? Tell us below!",
      tags: "#SalonOwner #SalonManagement",
    },
  },
  {
    id: "new-tech-week1", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "🤝 Thợ mới tuần đầu: 5 việc giúp thợ ở lại lâu",
    bullets: () => [
      "Nói rõ cách chia lương, bao lương, tip và ngày trả ngay buổi đầu — ghi ra giấy.",
      "Giới thiệu thợ với khách quen, chia vài khách dễ để làm quen.",
      "Chỉ chỗ để đồ nghề, cách khử trùng và quy trình của tiệm.",
      "Hỏi thăm cuối tuần đầu: có gì vướng không?",
      "Thợ thấy được tôn trọng thì ít nhảy tiệm hơn tăng lương.",
    ],
    cta: "💬 Điều gì giữ chân thợ ở tiệm bạn? Chia sẻ nhé!",
    tags: "#ChuTiemNail #GiuTho",
    en: {
      title: () => "🤝 A new tech's first week: 5 things that make them stay",
      bullets: () => [
        "Explain the pay split, guarantee, tips and payday on day one — in writing.",
        "Introduce them to regulars and hand them a few easy clients to start.",
        "Show where tools go, how the salon disinfects and the house routines.",
        "Check in at the end of the first week: anything getting in the way?",
        "Techs who feel respected leave less often than techs who only get a raise.",
      ],
      cta: "💬 What keeps techs at your salon? Share below!",
      tags: "#SalonOwner #TechRetention",
    },
  },
  {
    id: "interview-questions", pillar: "community", audience: "tech", market: "ALL",
    title: () => "📝 Đi thử việc tiệm mới: 6 điều nên hỏi rõ trước khi nhận",
    bullets: () => [
      "Chia lương bao nhiêu (6/4, 7/3…), có bao lương không, bao bao lâu?",
      "Tip trả bằng tiền mặt hay cộng vào lương, trả ngày nào?",
      "Vật tư tiệm lo hay thợ tự mua?",
      "Lịch làm: mấy ngày, nghỉ ngày nào, có phải làm Chủ nhật?",
      "Khách chia theo lượt (turn) hay theo khách quen?",
      "Xin ghi lại các điều trên bằng tin nhắn để sau này đỡ hiểu lầm.",
    ],
    cta: "👉 Xem việc làm mới mỗi ngày ở tab Việc làm.",
    tags: "#ThoNail #ViecLamNail",
    en: {
      title: () => "📝 Trying out at a new salon: 6 things to ask before you say yes",
      bullets: () => [
        "What's the split (60/40, 70/30…), is there a guarantee, and for how long?",
        "Are tips paid in cash or on the paycheck, and when?",
        "Does the salon provide supplies or do you buy your own?",
        "Schedule: how many days, which days off, Sundays?",
        "Are clients shared by turn or by regulars?",
        "Ask for the answers by text so there's a record later.",
      ],
      cta: "👉 New jobs every day in the Jobs tab.",
      tags: "#NailTech #NailJobs",
    },
  },
  {
    id: "wrist-breaks", pillar: "health", audience: "all", market: "ALL",
    title: () => "🙆 Ngồi làm móng cả ngày: 4 thói quen nhỏ cho cổ tay, mắt và lưng",
    bullets: () => [
      "Giữa 2 khách, đứng dậy duỗi cổ tay và vai 1–2 phút.",
      "Chỉnh ghế để khuỷu tay ngang mặt bàn, lưng tựa thẳng.",
      "Cứ khoảng 20 phút, nhìn ra xa vài giây cho mắt nghỉ.",
      "Đau kéo dài hay tê tay thì nên đi khám — đừng cố chịu.",
    ],
    cta: "💬 Bạn có mẹo nào giữ sức khỏe khi làm nail? Chia sẻ nhé!",
    tags: "#ThoNail #SucKhoe",
    en: {
      title: () => "🙆 Doing nails all day: 4 small habits for wrists, eyes and back",
      bullets: () => [
        "Between clients, stand up and stretch wrists and shoulders for a minute or two.",
        "Set your chair so your elbows are level with the table and your back is supported.",
        "About every 20 minutes, look into the distance for a few seconds.",
        "Pain or numbness that doesn't go away is worth a doctor's visit — don't push through.",
      ],
      cta: "💬 Got a habit that keeps you healthy at the table? Share it!",
      tags: "#NailTech #Wellness",
    },
  },
  {
    id: "tool-clean-routine", pillar: "safety", audience: "all", market: "ALL",
    title: () => "🧼 Quy trình dụng cụ sạch giữa 2 khách — khách để ý hơn bạn nghĩ",
    bullets: () => [
      "Làm sạch bụi và cặn trên dụng cụ kim loại trước, rồi mới khử trùng theo đúng thời gian ghi trên chai.",
      "Dũa, buffer dùng 1 lần thì bỏ sau mỗi khách hoặc tặng khách mang về.",
      "Để dụng cụ đã khử trùng vào hộp kín, có ghi rõ \"đã sạch\".",
      "Làm theo quy định của hội đồng thẩm mỹ tiểu bang / bang nơi bạn làm.",
    ],
    cta: "💬 Tiệm bạn khoe quy trình sạch với khách thế nào? Bình luận nhé!",
    tags: "#ThoNail #VeSinh #AnToan",
    en: {
      title: () => "🧼 A clean-tool routine between clients — clients notice more than you think",
      bullets: () => [
        "Clean dust and residue off metal tools first, then disinfect for the contact time on the label.",
        "Single-use files and buffers go in the trash after each client, or home with the client.",
        "Keep disinfected tools in a closed, labeled \"clean\" container.",
        "Follow your state (or AU state) board's rules where you work.",
      ],
      cta: "💬 How does your salon show clients it's clean? Tell us below!",
      tags: "#NailTech #Sanitation #Safety",
    },
  },
  {
    id: "content-week", pillar: "skills", audience: "all", market: "ALL",
    title: () => "📲 Hết ý đăng bài? Lịch 1 tuần cho trang của thợ / tiệm",
    bullets: () => [
      "Thứ 2: ảnh trước – sau của một bộ móng.",
      "Thứ 4: video 10 giây quá trình làm (tay, không cần mặt).",
      "Thứ 6: mẫu cho cuối tuần + giờ còn trống.",
      "Chủ nhật: cảm ơn khách / đánh giá thật của khách (xin phép trước).",
    ],
    cta: "👉 Đăng ảnh thật lên PawNail: bấm ＋ → Khoe tay nghề.",
    tags: "#ThoNail #MarketingTiemNail",
    en: {
      title: () => "📲 Out of post ideas? A one-week plan for a tech or salon page",
      bullets: () => [
        "Monday: a before-and-after of one set.",
        "Wednesday: a 10-second process video (hands only).",
        "Friday: a weekend look + your open times.",
        "Sunday: a thank-you or a real client review (ask first).",
      ],
      cta: "👉 Share real work on PawNail: tap ＋ → Showcase work.",
      tags: "#NailTech #SalonMarketing",
    },
  },
  {
    id: "menu-clarity", pillar: "owner", audience: "owner", market: "ALL",
    title: () => "🧾 Menu giá rõ ràng = ít cãi giá: 4 điều nên có",
    bullets: () => [
      "Giá từ… cho từng dịch vụ, ghi rõ cái gì tính thêm (design, tháo bột, dáng dài).",
      "Thời gian làm ước tính — khách biết trước, ít hối.",
      "Ảnh mẫu thật cho các dịch vụ phổ biến.",
      "Ghi chính sách sửa móng miễn phí trong mấy ngày nếu bị gãy / bong.",
    ],
    cta: "👉 Tạo menu online có mã QR miễn phí trên PawNail.",
    tags: "#ChuTiemNail #MenuTiemNail",
    en: {
      title: () => "🧾 A clear price menu means fewer price arguments: 4 must-haves",
      bullets: () => [
        "\"From\" prices for each service, with add-ons spelled out (art, soak-off, long length).",
        "Estimated time for each service — fewer rushed clients.",
        "Real photos for your most popular services.",
        "Your free-fix window if a nail breaks or lifts.",
      ],
      cta: "👉 Build a free online menu with a QR code on PawNail.",
      tags: "#SalonOwner #PriceMenu",
    },
  },
  {
    id: "chrome-tips", pillar: "skills", audience: "tech", market: "ALL",
    title: () => "✨ Tráng gương (chrome) loang, không bóng? 4 lỗi hay gặp",
    bullets: () => [
      "Top dùng để xoa chrome phải là loại no-wipe và chiếu đèn đúng thời gian hãng ghi.",
      "Để top nguội vài giây sau khi chiếu rồi mới xoa bột.",
      "Lấy ít bột, xoa đều bằng mút / cọ silicone, phủi sạch bột thừa trước khi phủ top.",
      "Bọc kín mép đầu móng ở lớp top cuối để chrome không tróc.",
    ],
    cta: "👉 Xem mẫu chrome có ảnh thật ở mục Mẫu nail.",
    tags: "#ThoNail #Chrome #KyThuatNail",
    en: {
      title: () => "✨ Patchy or dull chrome? 4 common mistakes",
      bullets: () => [
        "Rub chrome over a no-wipe top coat cured for the time the brand states.",
        "Let the top coat cool for a few seconds after curing before you apply the powder.",
        "Use a little powder, buff it evenly with a sponge or silicone tool, and dust off the excess before sealing.",
        "Cap the free edge with the final top coat so the chrome doesn't chip.",
      ],
      cta: "👉 See chrome designs with real photos in Nail designs.",
      tags: "#NailTech #ChromeNails",
    },
  },
  {
    id: "first-visit-wow", pillar: "owner", audience: "all", market: "ALL",
    title: () => "🌟 Khách mới lần đầu: 4 chi tiết nhỏ khiến họ quay lại",
    bullets: () => [
      "Chào bằng tên khi khách vào (đã có trong lịch hẹn).",
      "Hỏi khách muốn nói chuyện hay thư giãn yên lặng — rồi làm đúng như vậy.",
      "Cuối buổi cho khách xem kỹ từng ngón, hỏi có muốn chỉnh gì không.",
      "Nhắn cảm ơn sau 1–2 ngày kèm hỏi móng có ổn không.",
    ],
    cta: "💬 Tiệm bạn làm gì để khách mới thành khách quen? Bình luận nhé!",
    tags: "#ChuTiemNail #KhachMoi",
    en: {
      title: () => "🌟 A first-time client: 4 small touches that bring them back",
      bullets: () => [
        "Greet them by name when they walk in (it's in the booking).",
        "Ask whether they'd like to chat or relax quietly — then do exactly that.",
        "At the end, let them check each nail and ask if anything needs a tweak.",
        "Text a thank-you a day or two later and ask how the nails are holding up.",
      ],
      cta: "💬 What turns a first-timer into a regular at your salon? Share below!",
      tags: "#SalonOwner #NewClients",
    },
  },

  // ---------- 🎨 Xu hướng ----------
  {
    id: "theme-collection", pillar: "trend", audience: "all", market: "ALL",
    when: () => true, // chỉ hiện khi đang có dịp lễ (xem build)
    title: ({ theme }) => `${theme?.emoji ?? "✨"} Bộ sưu tập ${theme?.title ?? "mẫu mới"} đã lên PawNail — có sẵn vật tư & cách làm`,
    bullets: ({ theme }) => [
      `Hàng chục mẫu ${theme?.title ?? "mới"}: mỗi mẫu có danh sách vật tư cần chuẩn bị, các bước làm, thời gian và giá gợi ý.`,
      "Bấm \"Lưu mẫu\" để để dành, bấm \"Tôi làm mẫu này\" để khoe ảnh thật sau khi làm.",
      "Chuẩn bị vật tư sớm 1–2 tuần trước dịp lễ để không bị hết hàng.",
    ],
    cta: "Xem ở mục Mẫu nail: bitpawos.com/designs",
    tags: "#MauNail #PawNail",
    en: {
      title: ({ theme }) => `${theme?.emoji ?? "✨"} The ${theme?.title ?? "new"} collection is on PawNail — with materials and steps`,
      bullets: ({ theme }) => [
        `Dozens of ${theme?.title ?? "new"} designs, each with a materials list, step-by-step instructions, timing and a suggested price.`,
        "Tap \"Save design\" to keep it for later, and \"I made this\" to share a photo of your version.",
        "Stock up on materials 1–2 weeks before the holiday so you don't run out.",
      ],
      cta: "See them under Designs: bitpawos.com/designs",
      tags: "#NailDesigns #PawNail",
    },
  },

  // ---------- 💬 Cộng đồng ----------
  {
    id: "ask-pay", pillar: "community", audience: "all", market: "US",
    title: () => "💬 Hỏi nhanh: tiệm bạn trả lương kiểu nào?",
    bullets: () => ["🅰️ Ăn chia (6/4, 7/3…)", "🅱️ Bao lương tuần", "🅲 Bao lương + ăn chia khi vượt mức", "🅳 Theo giờ"],
    cta: "👇 Bình luận A/B/C/D + tiểu bang của bạn — PawNail sẽ tổng hợp kết quả gửi cả cộng đồng.",
    tags: "#ThoNail #LuongThoNail",
  },
];

const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
};

function render(t: Topic, ctx: Ctx): BotDraft {
  const title = t.title(ctx);
  const lines = t.bullets(ctx).map((b) => `• ${b}`);
  const sourceNames = t.sources?.length ? t.sources.map((x) => x.label.split(" — ")[0]).join(", ") : "";
  const src = sourceNames ? `Nguồn: ${sourceNames}` : "";
  const text = [title, "", ...lines, "", t.cta, ...(t.tax ? ["", TAX_NOTE] : []), ...(src ? ["", src] : []), "", t.tags].join("\n").slice(0, 1990);
  const textEn = t.en
    ? [t.en.title(ctx), "", ...t.en.bullets(ctx).map((b) => `• ${b}`), "", t.en.cta, ...(t.tax ? ["", TAX_NOTE_EN] : []), ...(sourceNames ? ["", `Source: ${sourceNames}`] : []), "", t.en.tags].join("\n").slice(0, 1990)
    : undefined;
  const caption = `${title}\n\n${lines.slice(0, 3).join("\n")}\n\n${t.cta}\n${t.tags} #PawNail`.slice(0, 1200);
  return {
    id: `${t.id}-${hash(title)}`, pillar: t.pillar, audience: t.audience, market: t.market, pinned: !!t.pinned, seasonal: !!t.when && t.id !== "theme-collection",
    title, text, ...(textEn ? { textEn } : {}), caption, sources: t.sources ? [...t.sources] : [],
  };
}

export interface BotInput {
  market: "US" | "AU";
  now: Date;
  theme?: { title: string; emoji: string } | null; // dịp lễ đang/sắp diễn ra (có bộ mẫu)
  publishedTitles: Set<string>; // tiêu đề các bài đã đăng (dòng đầu) — không đề xuất lại
}

/** Bài nháp hôm nay: bài ghim chưa đăng → bài đúng mùa → bài xoay vòng theo ngày
 *  (trộn đủ mảng: tiền, an toàn, sức khoẻ, tay nghề, quản lý tiệm). */
// Kho chính (thuế/an toàn/theo mùa) + kho bài quanh năm (tiếng Anh đứng quầy, tay nghề, sức khoẻ…).
const TOPICS: Topic[] = [...BASE_TOPICS, ...LIBRARY_TOPICS];

export function buildBotDrafts(input: BotInput, max = 8): BotDraft[] {
  const ctx: Ctx = { now: input.now, theme: input.theme ?? null };
  const fits = TOPICS.filter((t) => (t.market === "ALL" || t.market === input.market) && (t.id !== "theme-collection" || !!input.theme));
  const all = fits.map((t) => ({ t, d: render(t, ctx) })).filter(({ d }) => !input.publishedTitles.has(d.title));
  const pinned = all.filter(({ t }) => t.pinned);
  const seasonal = all.filter(({ t }) => !t.pinned && t.when && t.when(input.now));
  const evergreen = all.filter(({ t }) => !t.pinned && !t.when);
  // Xoay vòng theo ngày để mỗi ngày đề xuất khác nhau, nhưng ổn định trong ngày.
  const day = Math.floor(input.now.getTime() / 86_400_000);
  // Mỗi ngày lùi 3 vị trí → trong 1 tuần gần như cả kho bài thường được đề xuất ít nhất 1 lần.
  const rotated = evergreen.map((x, i) => ({ x, k: (i - day * 3 + evergreen.length * 1000) % evergreen.length })).sort((a, b) => a.k - b.k).map((y) => y.x);
  const picked: typeof all = [];
  const usedPillar = new Map<Pillar, number>();
  for (const x of [...pinned, ...seasonal, ...rotated]) {
    if (picked.length >= max) break;
    const n = usedPillar.get(x.t.pillar) ?? 0;
    if (!x.t.pinned && !x.t.when && n >= 2) continue; // đa dạng: tối đa 2 bài thường mỗi mảng
    usedPillar.set(x.t.pillar, n + 1);
    picked.push(x);
  }
  return picked.map(({ d }) => d);
}

export const TOPIC_COUNT = TOPICS.length;
/** Dòng đầu (tiêu đề) của 1 bài đã đăng — để đối chiếu đã đăng chưa. */
export const firstLine = (content: string) => content.split("\n")[0].trim();
