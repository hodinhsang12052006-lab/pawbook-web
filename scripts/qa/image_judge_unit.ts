// Kiểm thử luật chấm ảnh mẫu nail (lib/imageJudge.ts) bằng đúng các lỗi đã gặp khi soi tay 167 ảnh
// đã đăng (17/10/2026): AI chấm cho 8–9 điểm nhưng ảnh có lỗi → luật phải ép xuống dưới ngưỡng đăng.
//   npx tsx scripts/qa/image_judge_unit.ts
import { finalScore, anatomyOk } from "../../lib/imageJudge";
import { PASS_SCORE as PASS, KEEP_SCORE as KEEP } from "../../lib/aiDesigns";

let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + detail}`);
};
const clean = { hands: 1, fingers: 5, nails: 4, extraDigits: false, fusedOrMelted: false, palmSideNails: false, floatingNail: false, artOnSkin: false, text: false, nailsClear: true, matches: true, realistic: true };
const v = (score: number, over: Record<string, unknown> = {}) => ({ ...clean, score, ...over });

ok("J1", "Ảnh sạch, AI cho 8.5 → giữ 8.5 (đạt)", finalScore(v(8.5)) === 8.5 && anatomyOk(v(8.5)));
ok("J2", "Lá phong caramel: 7 móng / 1 bàn tay, AI tự cho 9 và không khai lỗi → bị ép ≤ 3", finalScore(v(9, { nails: 7, fingers: 6 })) <= 3, String(finalScore(v(9, { nails: 7, fingers: 6 }))));
ok("J3", "6 ngón / 1 bàn tay → loại", finalScore(v(9, { fingers: 6 })) <= 3);
ok("J4", "Móng nhiều hơn ngón (5 móng, 4 ngón thấy được) → loại", finalScore(v(9, { fingers: 4, nails: 5 })) <= 3);
ok("J5", "2 bàn tay chồng nhau → loại (ảnh mẫu chỉ 1 bàn tay)", finalScore(v(9, { hands: 2, fingers: 10, nails: 8 })) <= 3);
ok("J6", "Lòng bàn tay mà vẫn thấy móng → loại", finalScore(v(9, { palmSideNails: true })) <= 3);
ok("J7", "Móng rời bay lơ lửng → loại", finalScore(v(9, { floatingNail: true })) <= 3);
ok("J8", "Hình mèo / mắt in lên da thay vì trên móng → loại", finalScore(v(9, { artOnSkin: true })) <= 3);
ok("J9", "Chữ / watermark mờ → loại", finalScore(v(9.5, { text: true })) <= 3);
ok("J10", "Ngón dính / chảy → loại", finalScore(v(9, { fusedOrMelted: true })) <= 3);
ok("J11", "Không thấy bàn tay (hands 0) → loại", finalScore(v(9, { hands: 0, fingers: 0, nails: 0 })) <= 3);
ok("J12", "Móng mờ / lem → tối đa 5 (dưới ngưỡng giữ 7)", finalScore(v(9, { nailsClear: false })) === 5 && 5 < KEEP);
ok("J13", "Sai hoạ tiết so với mô tả → tối đa 6 (dưới ngưỡng giữ 7)", finalScore(v(9, { matches: false })) === 6 && 6 < KEEP);
ok("J14", "Câu trả lời dạng cũ (fiveFingers=false) vẫn hiểu → loại", finalScore({ hand: true, fiveFingers: false, textFree: true, score: 9 }) <= 3);
ok("J15", "AI trả số đếm dạng chữ (\"7\") vẫn hiểu", finalScore(v(9, { nails: "7" })) <= 3);
ok("J16", "Ngưỡng: đạt ≥ 8, giữ ≥ 7", PASS === 8 && KEEP === 7);

console.log(`\nLuật chấm ảnh mẫu nail: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
