// dt(): tiêu đề tin tự sinh + lương + "Thỏa thuận" sang EN; placeLabel bỏ dấu phẩy thừa.
//   npx tsx scripts/qa/data_en_unit.mts
import { setTrLocale } from "../../lib/i18n/tr";
import { dt } from "../../lib/i18n/dataEn";
import { placeLabel } from "../../lib/stateNames";

let pass = 0, fail = 0;
const eq = (got: string, want: string) => { const c = got === want; c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} ${JSON.stringify(got)}${c ? "" : "  ≠ " + JSON.stringify(want)}`); };
setTrLocale("en");
eq(dt("Cần thợ Bột/Acrylic/Dip/SNS gấp"), "Urgent: Acrylic/Dip/SNS tech needed");
eq(dt("Cần thợ Gel-X/Bột/Acrylic"), "Gel-X/Acrylic tech needed");
eq(dt("Cần thợ Bột/Acrylic/Chân tay nước"), "Acrylic/Mani-pedi tech needed");
eq(dt("Cần thợ Bột/Dip gấp"), "Urgent: Acrylic/Dip tech needed");
eq(dt("Cần thợ Nail"), "Nail tech needed");
eq(dt("Cần thợ Nail gấp"), "Nail tech needed urgently");
eq(dt("Cần thợ biết vẽ hoa gấp"), "Cần thợ biết vẽ hoa gấp"); // lạ → giữ nguyên
eq(dt("Thỏa thuận"), "Negotiable");
eq(dt("$28-32/giờ"), "$28-32/hr");
eq(dt("$1,300-1,600/tuần"), "$1,300-1,600/wk");
eq(dt("$135"), "$135");
eq(dt("60/40 ăn chia"), "60/40 split");
eq(dt("Chia 6/4"), "6/4 split");
eq(dt("$1,500+/tuần"), "$1,500+/wk");
eq(dt("Bao lương $1,200/tuần"), "Guaranteed $1,200/wk");
eq(dt("Combo bao tay + khẩu trang y tế tiệm nail (100 cái)"), "Salon gloves + medical masks combo (100 pcs)");
eq(placeLabel("", "US", "GA"), "Georgia");
eq(placeLabel(null, "AU", "NSW"), "New South Wales");
eq(placeLabel("Houston", "US", "TX"), "Houston, Texas");
eq(placeLabel("Austin", "US", null), "Austin");
setTrLocale("vi");
eq(dt("Cần thợ Bột/Acrylic gấp"), "Cần thợ Bột/Acrylic gấp");
eq(dt("Thỏa thuận"), "Thỏa thuận");
console.log(`\ndataEn: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
