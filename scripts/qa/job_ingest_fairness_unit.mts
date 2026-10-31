// Tin đăng hộ tiệm: gỡ yêu cầu giới tính / tuổi (luật chống phân biệt đối xử khi tuyển dụng ở Mỹ và Úc), không bắt nhầm
// "nam nữ đều được", tên người (anh Nam), địa danh (miền Nam).
//   npx tsx scripts/qa/job_ingest_fairness_unit.mts
import { hasDiscriminatoryRequirement as has, stripDiscriminatoryRequirements as strip, parseJobPost } from "../../lib/jobIngest/parse";

const cases: [string, boolean, string?][] = [
  ["Tiem Ở Alabama Cần Gấp 1 Thợ Nữ Trẻ", true, "Tiem Ở Alabama Cần Gấp 1 Thợ"],
  ["Cần thợ nữ trẻ đẹp biết làm bột", true, "Cần thợ biết làm bột"],
  ["Tiệm cần thợ nam nữ đều được, bao lương $1,200", false],
  ["Cần thợ nam hoặc nữ, có chỗ ở", false],
  ["Ưu tiên nữ, dưới 30 tuổi. Lương cao", true, "Lương cao"],
  ["Cần nhân viên nữ làm receptionist", true, "Cần nhân viên làm receptionist"],
  ["Tuyển thợ, độ tuổi 20 - 35, có kinh nghiệm", true, "Tuyển thợ, có kinh nghiệm"],
  ["Liên hệ anh Nam 713-555-0100", false],
  ["Tiệm ở miền Nam California cần thợ bột", false],
  ["Hiring young female nail tech, full time", true, "Hiring nail tech, full time"],
  ["Female only. Must be under 35 years old.", true],
  ["Cần thợ nữ, lương cao", true, "Cần thợ, lương cao"],
  ["Tuyển thợ nam/nữ, bao lương", false],
  ["Cần thợ nữ và nam, có chỗ ở", false],
  ["Now hiring nail techs, male or female welcome", false],
  ["Cần thợ dip, gel-x. Thợ trẻ năng động", true, "Cần thợ dip, gel-x. Thợ năng động"],
  ["Cần thợ tay chân nước, lương 60/40, tip cao", false],
  ["Cần gấp thợ bột, không cần tiếng Anh", false],
];
let fail = 0;
for (const [input, expect, out] of cases) {
  const got = has(input);
  const s = strip(input);
  const ok = got === expect && (out === undefined || s === out) && (expect || s === input);
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", JSON.stringify(input), "→", got, JSON.stringify(s));
}
console.log("parse flag:", parseJobPost("Cần Gấp 1 Thợ Nữ Trẻ ở Houston TX 713-555-0100").discriminatory);
console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
