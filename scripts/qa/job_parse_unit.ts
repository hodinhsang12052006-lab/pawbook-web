// Kiểm thử bộ tách tin tuyển thợ (lib/jobIngest/parse.ts) bằng các kiểu bài hay gặp trong nhóm.
// Bài & số điện thoại dưới đây là HƯ CẤU (đầu số 555-01xx dành cho ví dụ).   npx tsx scripts/qa/job_parse_unit.ts
import { stateFromUsPhone } from "../../lib/jobIngest/areaCodes";
import { parseJobPost, findPhone, parseLocation, isSalonSale, safeToolSalary, cleanSalonName, cleanCity, findSalary } from "../../lib/jobIngest/parse";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`);
};

const p1 = parseJobPost(`CẦN GẤP THỢ BỘT, DIP, GEL-X
Tiệm Lucky Nails & Spa ở Houston TX cần gấp 2 thợ biết làm bột và dip. Bao lương $1,200 - $1,500/tuần, tip cao, bao ăn ở.
Địa chỉ: 10250 Bellaire Blvd Ste 120, Houston, TX 77072
Gọi/text: (281) 555-0142 anh Tuấn`);
ok("P1a", "SĐT Mỹ (281) 555-0142 → +12815550142", p1.phone === "+12815550142" && p1.phoneDisplay === "(281) 555-0142", JSON.stringify(p1.phone));
ok("P1b", "Tên tiệm 'Lucky Nails & Spa'", p1.salonName === "Lucky Nails & Spa", String(p1.salonName));
ok("P1c", "Địa chỉ đầy đủ + ZIP + Houston, TX", p1.address === "10250 Bellaire Blvd Ste 120, Houston, TX 77072" && p1.city === "Houston" && p1.state === "TX" && p1.zip === "77072" && p1.market === "US", JSON.stringify({ a: p1.address, c: p1.city, s: p1.state }));
ok("P1d", "Lương khoảng + loại Bao lương tuần", p1.salaryAmount === "$1,200-1,500/tuần" && p1.salaryType === "Bao lương tuần", `${p1.salaryType} | ${p1.salaryAmount}`);
ok("P1e", "Kỹ năng Bột + Dip + Gel-X; có chỗ ở, tip cao; tin gấp; là bài tuyển", ["Bột/Acrylic", "Dip/SNS", "Gel-X"].every((x) => p1.skills.includes(x)) && p1.benefits.includes("Có chỗ ở") && p1.benefits.includes("Tip cao") && p1.isUrgent && p1.isHiring, JSON.stringify(p1.skills));

const p2 = parseJobPost(`Cần thợ chân tay nước + wax, tiệm khu Garden Grove. Ăn chia 6/4, khách Mỹ trắng tip tốt. Liên lạc 714.555.0199`);
ok("P2a", "SĐT dạng chấm 714.555.0199; thành phố → CA", p2.phone === "+17145550199" && p2.city === "Garden Grove" && p2.state === "CA", JSON.stringify(p2));
ok("P2b", "Ăn chia 6/4 → '% Ăn chia', 'Chia 6/4'", p2.salaryType === "% Ăn chia" && p2.salaryAmount === "Chia 6/4", `${p2.salaryType} | ${p2.salaryAmount}`);
ok("P2c", "Kỹ năng Chân tay nước + Wax; không ghi gấp", p2.skills.includes("Chân tay nước") && p2.skills.includes("Wax") && !p2.isUrgent);

const p3 = parseJobPost(`Hiring nail tech ASAP at Bella Nail Lounge, Shop 4/112 Station St, Bankstown NSW 2200. $30-35/hr cash. Call 0412 555 019 or +61 2 5550 1234`);
ok("P3a", "Úc: di động 0412 555 019 → +61412555019", p3.phone === "+61412555019" && p3.phoneDisplay === "0412 555 019" && p3.market === "AU", JSON.stringify(p3.phone));
ok("P3b", "Úc: địa chỉ shop + Bankstown NSW 2200", p3.state === "NSW" && p3.city === "Bankstown" && p3.zip === "2200" && !!p3.address?.startsWith("Shop 4/112 Station St"), JSON.stringify({ a: p3.address, c: p3.city }));
ok("P3c", "Úc: $30-35/giờ → 'Theo giờ AUD'; tên Bella Nail Lounge; trả cash", p3.salaryAmount === "$30-35/giờ" && p3.salaryType === "Theo giờ AUD" && p3.salonName === "Bella Nail Lounge" && p3.benefits.includes("Trả cash"), `${p3.salaryType} | ${p3.salaryAmount} | ${p3.salonName}`);

const p4 = parseJobPost(`Mình cần tìm việc làm nail ở Dallas, biết làm bột. Ai cần thợ inbox 469-555-0110`);
ok("P4", "Bài TÌM VIỆC (không phải tiệm tuyển) → isHiring=false", p4.isHiring === false);

const p5 = parseJobPost(`Cần thợ nail gấp ở Atlanta, Georgia. Lương thỏa thuận. ĐT 4045550123`);
ok("P5", "10 số liền 4045550123; Atlanta → GA; lương thỏa thuận", p5.phone === "+14045550123" && p5.state === "GA" && p5.city === "Atlanta" && p5.salaryAmount === "Thỏa thuận", JSON.stringify(p5));

const p6 = parseJobPost(`Tiệm ở bang Washington cần thợ biết gel-x, lương $1500+/tuần. Zip 98101. Text 206 555 0177`);
ok("P6", "SĐT cách trống; 'Washington' → WA; $1,500+/tuần", p6.phone === "+12065550177" && p6.state === "WA" && p6.salaryAmount === "$1,500+/tuần", `${p6.phone} ${p6.state} ${p6.salaryAmount}`);

const p7 = parseJobPost(`Tiệm nail ở Melbourne cần thợ làm bột, có chỗ ở. Lương $1200/tuần. LH 0433 555 888`);
ok("P7", "Úc: Melbourne → VIC; 0433 555 888; $1,200/tuần → Theo tuần AUD", p7.phone === "+61433555888" && p7.state === "VIC" && p7.salaryType === "Theo tuần AUD" && p7.salaryAmount === "$1,200/tuần", `${p7.phone} ${p7.state} ${p7.salaryType} ${p7.salaryAmount}`);

ok("P8", "Không có SĐT → phone null (không bịa)", parseJobPost("Cần thợ nail ở Texas, inbox mình").phone === null);
ok("P9", "Số rác (ngày tháng, ZIP, giá tiền) không bị nhận nhầm là SĐT", findPhone("Lương $1,200-1,500, zip 77072, ngày 10/11/2026") === null);
ok("P10", "Tên tiệm không nhận nhầm câu 'Cần thợ Nail'", parseJobPost("Cần thợ Nail gấp ở Houston, gọi 713-555-0100").salonName === null);
const pz = parseJobPost("Cần thợ bột gấp. 1234 Main St, Plano, TX 75074. Gọi 972-555-0123");
ok("P11", "Plano, TX 75074 → TX, Plano; tiêu đề 'Cần thợ Bột/Acrylic gấp'", pz.state === "TX" && pz.city === "Plano" && pz.title === "Cần thợ Bột/Acrylic gấp", `${pz.state} ${pz.city} ${pz.title}`);

// Ô "location" của tool — đúng các kiểu đã gặp khi tool gửi thật
const L = (s: string) => JSON.stringify(parseLocation(s));
ok("L1", "'Winthrop, MA' → Winthrop, MA (thành phố lạ vẫn đọc được)", L("Winthrop, MA") === JSON.stringify({ city: "Winthrop", state: "MA", zip: null, market: "US" }), L("Winthrop, MA"));
ok("L2", "'Senatobia, MS 38668' → Senatobia, MS, 38668", L("Senatobia, MS 38668") === JSON.stringify({ city: "Senatobia", state: "MS", zip: "38668", market: "US" }), L("Senatobia, MS 38668"));
ok("L3", "'TX 77521' → TX, ZIP 77521 (không bịa thành phố)", L("TX 77521") === JSON.stringify({ city: null, state: "TX", zip: "77521", market: "US" }), L("TX 77521"));
ok("L4", "'CA 91016**' (có dấu * thừa) → CA 91016", L("CA 91016**") === JSON.stringify({ city: null, state: "CA", zip: "91016", market: "US" }), L("CA 91016**"));
ok("L5", "'Bankstown NSW 2200' → Úc", L("Bankstown NSW 2200") === JSON.stringify({ city: "Bankstown", state: "NSW", zip: "2200", market: "AU" }), L("Bankstown NSW 2200"));
ok("L6", "'Mỹ (USA)' → không đoán bậy", parseLocation("Mỹ (USA)").state === null && parseLocation("Mỹ (USA)").city === null, L("Mỹ (USA)"));
ok("L7", "'Houston, TX 77083' → Houston, TX, 77083", L("Houston, TX 77083") === JSON.stringify({ city: "Houston", state: "TX", zip: "77083", market: "US" }), L("Houston, TX 77083"));

// ---- Lỗi gặp trên web thật 17/10/2026 (SĐT đổi sang số hư cấu 555) ----
const al = "Tiem ở Alabama cần gấp 1 thợ everything dũa shape chuẩn design tốt, income đảm bảo từ 2000-2200 1 tuần chua típ , nếu cần mình sẽ bao lương 2055550142 có phòng cho thợ";
ok("S1", "SĐT dính sau \"bao lương\" không bị hiểu là lương; lấy đúng income 2000-2200/tuần", findSalary(al, "US").salaryAmount === "$2,000-2,200/tuần", findSalary(al, "US").salaryAmount);
ok("S2", "Lương tool gửi kèm \"bao lương 2055\" (mảnh SĐT) bị bỏ; lương thật được giữ", safeToolSalary("bao lương 2055", al) === null && safeToolSalary("$1,200-1,500/tuần", al) === "$1,200-1,500/tuần" && safeToolSalary("Thỏa thuận", al) === null, String(safeToolSalary("bao lương 2055", al)));
const sale1 = "CẦN SANG GẤP TIỆM NAIL – SAN FRANCISCO, CA 94114. Tiệm rộng 900 sqft, 5 ghế Spa. Rent $3,850/tháng, lease còn 4 năm. Giá sang $120,000 có thương lượng. Call/Text Nhi: 714-555-0101";
const sale2 = "Cần Bán Tiệm Nail Gấp Ở Vùng Pembroke Pines FLORIDA!! 1200SF có 11 ban nails 7 ghe pedicures. Rent $5430 !!! liên lạc 954-555-0134";
const sale3 = "Chúc mừng tiệm Nail tại Inverness, FL 34450 đã nhận cọc thành công chỉ sau 5 ngày gửi bán. Liên hệ 714-555-0148";
const sp = [sale1, sale2, sale3].map((t) => parseJobPost(t));
ok("S3", "Bài SANG / BÁN tiệm (kể cả có \"gấp\") → không phải bài tuyển, không lấy tiền thuê / giá sang làm lương", sp.every((x) => x.isSale && !x.isHiring) && sp.every((x) => x.salaryAmount === "Thỏa thuận"), JSON.stringify(sp.map((x) => [x.isSale, x.isHiring, x.salaryAmount])));
const both = "Cần thợ bột gấp, tiệm khu Houston TX. Bao lương $1,000/tuần. (Tiệm cũ bên kia mình đã sang tiệm rồi nên tuyển lại). Gọi 281-555-0177";
ok("S4", "Bài tuyển thợ có nhắc chuyện sang tiệm vẫn là bài tuyển", !isSalonSale(both) && parseJobPost(both).isHiring && parseJobPost(both).salaryAmount === "$1,000/tuần", JSON.stringify([isSalonSale(both), parseJobPost(both).isHiring, parseJobPost(both).salaryAmount]));
ok("S5", "Tên tiệm gọn: bỏ \"(tên người đăng)\", tên kiểu câu tuyển → \"Tiệm nail <thành phố>\"; tên thật giữ nguyên",
  cleanSalonName("Tiệm Nail (Annie Linhh Nguyen)", "San Francisco", "CA") === "Tiệm nail San Francisco" &&
  cleanSalonName("Tiem Ở Alabama Cần Gấp 1 Thợ Nữ Trẻ", "", "AL") === "Tiệm nail AL" &&
  cleanSalonName("Tiệm Khách Đông (Jimmy Le)", null, "MD") === "Tiệm nail MD" &&
  cleanSalonName("Lucky Nails & Spa", "Houston", "TX") === "Lucky Nails & Spa" &&
  cleanSalonName("Viet Nails", "Inverness", "FL") === "Viet Nails",
  [cleanSalonName("Tiệm Nail (Annie Linhh Nguyen)", "San Francisco", "CA"), cleanSalonName("Tiem Ở Alabama Cần Gấp 1 Thợ Nữ Trẻ", "", "AL"), cleanSalonName("Tiệm Khách Đông (Jimmy Le)", null, "MD")].join(" | "));
ok("S6", "Thành phố \"I Inverness\" → \"Inverness\"; tên bình thường giữ nguyên", cleanCity("I Inverness") === "Inverness" && cleanCity("San Jose") === "San Jose" && cleanCity("O'Fallon") === "O'Fallon", cleanCity("I Inverness"));

const nd = "TUYỂN THỢ NAIL – BAO LƯƠNG ĐẾN $4,000 / 2 TUẦN NORTH DAKOTA. Bao lương: $4,000 / 2 tuần – Thợ làm đủ thứ. $3,500 / 2 tuần – Thợ chân tay nước. Pedicure: $43 – $135. Acrylic & Special Shape: $55. Gọi 701-555-0110";
ok("S7", "Lương 2 tuần/lần \"$4,000 / 2 tuần\" được nhận; giá dịch vụ \"Pedicure: $43 – $135\" không bị hiểu là lương", findSalary(nd, "US").salaryAmount === "$4,000/2 tuần" && findSalary("Pedicure: $43 – $135, tip cao", "US").salaryAmount === "Thỏa thuận", findSalary(nd, "US").salaryAmount);
ok("S8", "Tên NGƯỜI ĐĂNG tool gửi kèm (\"Thuy Cao\", \"Kaia Vu\", \"Huynh Tien Tien\") → \"Tiệm nail <thành phố>\"; tên tiệm thật giữ",
  cleanSalonName("Thuy Cao", "", "NC") === "Tiệm nail NC" && cleanSalonName("Kaia Vu", "Houston", "TX") === "Tiệm nail Houston" && cleanSalonName("Huynh Tien Tien", "", "ND") === "Tiệm nail ND" &&
  cleanSalonName("Glam Nails", "", "TX") === "Glam Nails" && cleanSalonName("Blossom Nail Lounge", "Plano", "TX") === "Blossom Nail Lounge" && cleanSalonName("GA Towne Lake Nails", "", "GA") === "GA Towne Lake Nails",
  [cleanSalonName("Thuy Cao", "", "NC"), cleanSalonName("Kaia Vu", "Houston", "TX"), cleanSalonName("Glam Nails", "", "TX")].join(" | "));

ok("S9", "Tên kiểu câu nói (\"Tiệm Nails Ở Acworth\", \"Tiệm Mình Ở York\", \"Tiệm Em Đông Khách\", \"Chủ Tiệm Nails USA\") → \"Tiệm nail <thành phố>\"",
  cleanSalonName("Tiệm Nails Ở Acworth", "Acworth", "GA") === "Tiệm nail Acworth" && cleanSalonName("Tiệm Mình Ở York", "York", "PA") === "Tiệm nail York" &&
  cleanSalonName("Tiệm Ở South Carolina", "", "SC") === "Tiệm nail SC" && cleanSalonName("Tiệm Em Đông Khách", "Tampa", "FL") === "Tiệm nail Tampa" &&
  cleanSalonName("Chủ Tiệm Nails USA", "Moncks Corner", "SC") === "Tiệm nail Moncks Corner" && cleanSalonName("Lucky Nails & Spa", "Houston", "TX") === "Lucky Nails & Spa",
  [cleanSalonName("Tiệm Nails Ở Acworth", "Acworth", "GA"), cleanSalonName("Tiệm Em Đông Khách", "Tampa", "FL"), cleanSalonName("Chủ Tiệm Nails USA", "Moncks Corner", "SC")].join(" | "));

ok("S10", "Mã vùng SĐT → bang: 281 TX · 714 CA · 404 GA · 770 GA · 336 NC · +1 954 FL · 718 NY; số Úc / mã lạ / thiếu số → null",
  stateFromUsPhone("+12815550142") === "TX" && stateFromUsPhone("(714) 555-0199") === "CA" && stateFromUsPhone("404-555-0100") === "GA" && stateFromUsPhone("770 555 0100") === "GA" &&
  stateFromUsPhone("336-929-7543") === "NC" && stateFromUsPhone("+1 954 555 0134") === "FL" && stateFromUsPhone("718.555.0101") === "NY" &&
  stateFromUsPhone("+61412555019") === null && stateFromUsPhone("(783) 523-4566") === null && stateFromUsPhone("12345") === null && stateFromUsPhone(null) === null,
  [stateFromUsPhone("+12815550142"), stateFromUsPhone("(783) 523-4566"), stateFromUsPhone("+61412555019")].join(","));

ok("S11", "Thành phố \". LARGO\" → \"Largo\", \"SAN FRANCISCO\" → \"San Francisco\"; tên người 1 chữ \"Noah\" → \"Tiệm nail Portland\"; \"TN Nails\", \"Wynn Nail Spa\" giữ",
  cleanCity(". LARGO") === "Largo" && cleanCity("SAN FRANCISCO") === "San Francisco" && cleanCity("Fort Worth") === "Fort Worth" && cleanCity("NY") === "NY" &&
  cleanSalonName("Noah", "Portland", "OR") === "Tiệm nail Portland" && cleanSalonName("TN Nails", "Escondido", "CA") === "TN Nails" && cleanSalonName("Wynn Nail Spa", "Dallas", "TX") === "Wynn Nail Spa",
  [cleanCity(". LARGO"), cleanCity("SAN FRANCISCO"), cleanSalonName("Noah", "Portland", "OR")].join(" | "));

ok("S12", "Tên tự tạo \"Tiệm nail . LARGO\" → \"Tiệm nail Largo\"; \"Tiệm nail Kim\" giữ", cleanSalonName("Tiệm nail . LARGO", "Largo", "FL") === "Tiệm nail Largo" && cleanSalonName("Tiệm nail Kim", "Houston", "TX") === "Tiệm nail Kim", [cleanSalonName("Tiệm nail . LARGO", "Largo", "FL"), cleanSalonName("Tiệm nail Kim", "Houston", "TX")].join(" | "));

ok("S13", "\"bao lương 1000 and up 1 tuần\" → \"$1,000+/tuần\"; lương tool \"bao lương 1000\" → \"$1,000\"; \"income đảm bảo 1,200 mỗi tuần\" → \"$1,200/tuần\"",
  findSalary("Tiệm mình cần thêm 1 thợ làm everything, sẽ bao lương 1000 and up 1 tuần. Gọi 770-555-0136", "US").salaryAmount === "$1,000+/tuần" &&
  safeToolSalary("bao lương 1000", "bao lương 1000 and up") === "$1,000" &&
  findSalary("income đảm bảo 1,200 mỗi tuần, tip cao", "US").salaryAmount === "$1,200/tuần",
  [findSalary("Tiệm mình cần thêm 1 thợ làm everything, sẽ bao lương 1000 and up 1 tuần. Gọi 770-555-0136", "US").salaryAmount, safeToolSalary("bao lương 1000", "x"), findSalary("income đảm bảo 1,200 mỗi tuần, tip cao", "US").salaryAmount].join(" | "));

console.log(`\nTách tin tuyển thợ: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
