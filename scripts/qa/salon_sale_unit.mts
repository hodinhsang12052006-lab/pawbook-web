// Kiểm thử bộ tách bài SANG TIỆM (lib/salonSale/parse.ts) + đường bot gửi bài sang tiệm (prepareIngest → "sale").
// Bài & SĐT HƯ CẤU (đầu số 555-01xx).   npx tsx scripts/qa/salon_sale_unit.mts
import { parseSaleDetails, formatMoney, moneyValue } from "../../lib/salonSale/parse";
import { prepareIngest } from "../../lib/jobIngest/ingest";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail))}`);
};

const indiana = `Cần Thợ Nails/Mua Bán Tiệm Nail Tại Mỹ
SANG TIỆM NAIL: Lucky nail
Do move đi bang khác, em muốn sang gấp tiệm nails đang hoạt động ổn định, khách quen nhiều, khu mỹ trắng
8ghế spa + 1 ghế em bé
8 bàn làm tay
Tiệm rộng, sạch, đẹp. 1,400 sqft
In Come: $500k/ năm
Rent: $1,950 / tháng
Giá sang: $120k
Liên hệ: 317-555-0150`;
const d1 = parseSaleDetails(indiana);
ok("SS1", "Bài Indiana: giá sang $120,000 · thuê $1,950/tháng · doanh thu $500k/năm → $41,667/tháng · 8 ghế · 8 bàn · 1,400 sqft",
  d1.askingPrice === 120000 && d1.monthlyRent === 1950 && d1.monthlyRevenue === 41667 && d1.chairs === 8 && d1.tables === 8 && d1.sqft === 1400, d1);

const d2 = parseSaleDetails("Cần sang tiệm ở Houston TX, 6 pedi chairs, 5 manicure tables. Asking $85,000 OBO. Rent $3,200/month. Income 25k/tháng. Call 281-555-0151");
ok("SS2", "Bài tiếng Anh: asking $85,000 · rent $3,200 · income 25k/tháng · 6 ghế · 5 bàn", d2.askingPrice === 85000 && d2.monthlyRent === 3200 && d2.monthlyRevenue === 25000 && d2.chairs === 6 && d2.tables === 5, d2);

const d3 = parseSaleDetails("Sang tiệm nail khu Mỹ trắng, giá thương lượng, liên hệ 713-555-0152");
ok("SS3", "Không ghi số → null hết (không đoán bừa); SĐT không thành giá", Object.values(d3).every((v) => v === null), d3);

const d4 = parseSaleDetails("Bán tiệm 95K, doanh thu 18,000 mỗi tháng, tiền nhà 2500");
ok("SS4", "'Bán tiệm 95K' → $95,000; doanh thu 18,000 mỗi tháng; tiền nhà 2500", d4.askingPrice === 95000 && d4.monthlyRevenue === 18000 && d4.monthlyRent === 2500, d4);

ok("SS5", "moneyValue / formatMoney", moneyValue("1.2", "M") === 1200000 && moneyValue("120,000") === 120000 && formatMoney(120000) === "$120,000" && formatMoney(120000, "US", true) === "$120K" && formatMoney(1500000, "AU", true) === "A$1.5M",
  [moneyValue("1.2", "M"), moneyValue("120,000"), formatMoney(120000), formatMoney(120000, "US", true), formatMoney(1500000, "AU", true)]);

// Bot gửi bài sang tiệm → không còn bị bỏ: chuẩn bị thành tin Sang tiệm (đủ bang / SĐT / số liệu), tin tuyển vẫn là tin tuyển.
const prep = prepareIngest({ text: indiana, sourceUrl: "https://www.facebook.com/groups/1/posts/99", postedAt: new Date().toISOString() }, new Set());
ok("SS6", "Bot gửi bài sang tiệm → 'sale' (IN từ mã vùng 317, SĐT, giá $120k, tiêu đề 'Sang tiệm nail'), không phải tin tuyển",
  prep.status === "sale" && prep.sale.state === "IN" && prep.sale.market === "US" && prep.sale.phone === "(317) 555-0150" && prep.sale.askingPrice === 120000 && /Sang tiệm/.test(prep.sale.title) && prep.sale.source === "ingest",
  prep.status === "sale" ? { ...prep.sale, description: "…" } : prep);
const hire = prepareIngest({ text: "Cần Thợ Nails/Mua Bán Tiệm Nail Tại Mỹ\nTiệm ở Indianapolis cần gấp 2 thợ bột, bao lương $1,000/tuần. Gọi 317-555-0153" }, new Set());
ok("SS7", "Bài tuyển cùng nhóm vẫn là tin tuyển", hire.status === "ok", hire.status);
const blocked = prepareIngest({ text: indiana }, new Set(["+13175550150"]));
ok("SS8", "Số đã yêu cầu gỡ → bỏ qua cả bài sang tiệm", blocked.status === "skipped", blocked.status);
const noPhone = prepareIngest({ text: "Sang tiệm nail giá $90k, rent $2,000" }, new Set());
ok("SS9", "Bài sang tiệm không có SĐT Mỹ/Úc → bỏ qua (có lý do)", noPhone.status === "skipped" && /SĐT/.test(noPhone.reason), noPhone.status === "skipped" ? noPhone.reason : noPhone.status);
const assisted = prepareIngest({ text: indiana }, new Set(), { assisted: true });
ok("SS10", "Admin 'đăng hộ tin tuyển' dán bài sang tiệm → không thành tin tuyển", assisted.status !== "ok", assisted.status);

console.log(`\nSang tiệm (bộ tách): ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
