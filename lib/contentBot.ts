// BOT NỘI DUNG PAWNAIL — soạn bài đăng cho tài khoản chính thức, đánh đúng điều
// thợ nail & chủ tiệm người Việt ở Mỹ/Úc quan tâm nhất: TIỀN (thuế, tip, lương),
// AN TOÀN (lừa đảo), SỨC KHOẺ, TAY NGHỀ, QUẢN LÝ TIỆM, XU HƯỚNG.
//
// Nguyên tắc:
//   • Đúng lúc: bài theo mùa (hạn thuế quý, mùa thuế, mùa lễ…) được ưu tiên.
//   • Đúng sự thật: số liệu thuế lấy từ nguồn chính thống (IRS, ATO, Fair Work —
//     đã kiểm tra 10/2026), luôn kèm nguồn + lời nhắc hỏi CPA/kế toán.
//   • Dùng được ngay: mở bài bằng 1 câu "đánh trúng" + 3–5 ý thực tế + lời kêu
//     gọi lưu/chia sẻ/bình luận (tâm lý: sợ mất tiền, muốn kiếm thêm, muốn an toàn).
//   • Không tự đăng: admin đọc, sửa nếu cần, rồi mới đăng.

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
  caption: string; // bản ngắn cho Facebook / TikTok
  sources: { label: string; url: string }[];
}

export const PILLAR_LABEL: Record<Pillar, string> = {
  money: "💵 Tiền & thuế", safety: "🛡️ An toàn", health: "🩺 Sức khoẻ thợ", skills: "📈 Tay nghề & thu nhập",
  owner: "🏪 Quản lý tiệm", trend: "🎨 Xu hướng", community: "💬 Cộng đồng",
};

const TAX_NOTE = "ℹ️ Thông tin chung, không thay cho tư vấn thuế — trường hợp cụ thể hãy hỏi CPA / kế toán của bạn.";
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

interface Topic {
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
}
interface Ctx { now: Date; theme?: { title: string; emoji: string } | null }

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

const TOPICS: Topic[] = [
  // ---------- Bài ghim ----------
  {
    id: "welcome", pillar: "community", audience: "all", market: "ALL", pinned: true,
    title: () => "📌 Chào mừng đến với PawNail Jobs — sàn việc làm nail miễn phí cho người Việt tại Mỹ & Úc",
    bullets: () => [
      "Thợ tìm tiệm, chủ tiệm tìm thợ — nhắn tin, gọi điện trực tiếp, KHÔNG qua môi giới, KHÔNG mất phí kết nối.",
      "Đánh giá 2 chiều từ người từng làm việc thật: thợ xem tiệm có sòng phẳng không, tiệm xem tay nghề thợ.",
      "Mẫu nail mới mỗi ngày kèm vật tư & cách làm, radar lương theo tiểu bang, kho vật tư giá sỉ.",
      "Cần hỗ trợ tài khoản, báo lừa đảo hay góp ý: nhắn thẳng cho tài khoản này — đội ngũ trả lời trong 24 giờ.",
    ],
    cta: "👉 Theo dõi PawNail Jobs để không bỏ lỡ việc gấp, mẹo nghề và thông tin thuế quan trọng.",
    tags: "#PawNail #ThoNail #TiemNail #ViecLamNail",
  },
  {
    id: "safety-pinned", pillar: "safety", audience: "all", market: "ALL", pinned: true,
    title: () => "📌 3 nguyên tắc an toàn trên PawNail — đọc 30 giây, tránh mất tiền oan",
    bullets: () => [
      "PawNail và tiệm uy tín KHÔNG BAO GIỜ đòi chuyển tiền cọc để \"giữ chỗ làm\", \"mua đồ nghề\" hay \"làm giấy tờ\". Ai đòi → dừng ngay.",
      "Thoả thuận lương, chia turn, chỗ ở qua tin nhắn trong app để có bằng chứng khi cần.",
      "Thấy dấu hiệu lạ: bấm ⋮ → Báo cáo. Mọi báo cáo được xem trong 24 giờ, người báo được giữ kín.",
    ],
    cta: "🔁 Chia sẻ cho người mới vào nghề — một lần nhắc có thể giữ lại cả tháng lương.",
    sources: [SRC.ftc],
    tags: "#PawNail #AnToan #LuaDao",
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
    title: () => "🚨 Chưa đi làm đã đòi chuyển tiền \"giữ chỗ\" / \"mua đồ nghề\"? 100% là lừa đảo",
    bullets: () => [
      "Dấu hiệu: lương hứa cao bất thường, giục chuyển tiền gấp, chỉ nhắn tin không cho gọi video, không cho địa chỉ tiệm rõ ràng.",
      "Tiệm thật trả lương CHO bạn — không bao giờ thu tiền của thợ để nhận việc.",
      "Gặp trường hợp này: không chuyển tiền, chụp lại tin nhắn, bấm ⋮ → Báo cáo trên PawNail.",
    ],
    cta: "🔁 Chia sẻ để bạn thợ mới qua không mất tiền oan.",
    sources: [SRC.ftc],
    tags: "#LuaDao #AnToan #ThoNail",
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
    cta: "📌 Lưu lại — lần sau nhận việc xa chỉ cần hỏi theo danh sách này.",
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
    cta: "🔁 Gửi cho người thân đang làm nail — sức khoẻ là vốn lâu dài của nghề.",
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
      "Từ Halloween tới Năm Mới là mùa đông khách nhất — thợ giỏi được nhiều tiệm mời cùng lúc.",
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
    cta: "👉 Xem ngay ở mục Mẫu nail: bitpawos.com/designs",
    tags: "#MauNail #PawNail",
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
  const src = t.sources?.length ? `Nguồn: ${t.sources.map((x) => x.label.split(" — ")[0]).join(", ")}` : "";
  const text = [title, "", ...lines, "", t.cta, ...(t.tax ? ["", TAX_NOTE] : []), ...(src ? ["", src] : []), "", t.tags].join("\n").slice(0, 1990);
  const caption = `${title}\n\n${lines.slice(0, 3).join("\n")}\n\n${t.cta}\n${t.tags} #PawNail`.slice(0, 1200);
  return {
    id: `${t.id}-${hash(title)}`, pillar: t.pillar, audience: t.audience, market: t.market, pinned: !!t.pinned, seasonal: !!t.when && t.id !== "theme-collection",
    title, text, caption, sources: t.sources ? [...t.sources] : [],
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
