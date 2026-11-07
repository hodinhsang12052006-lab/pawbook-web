// GIPHY / Tenor có rất ít GIF gắn thẻ tiếng Việt → khi tìm tiếng Việt ra < 8 kết quả, tìm thêm bằng từ tiếng Anh tương ứng.
// So khớp không dấu (foldVi): "cam on" = "cảm ơn".
import { foldVi } from "@/lib/chat/fold";

const PAIRS: [vi: string[], en: string][] = [
  [["cảm ơn", "cám ơn"], "thank you"],
  [["yêu"], "love"],
  [["chúc mừng"], "congratulations"],
  [["buồn"], "sad"],
  [["vui"], "happy"],
  [["haha"], "lol"],
  [["chào", "xin chào"], "hello"],
  [["ngủ ngon"], "good night"],
  [["xin lỗi"], "sorry"],
  [["đói"], "hungry"],
  [["mệt"], "tired"],
  [["tuyệt vời"], "awesome"],
  [["móng", "nail"], "nails"],
  [["sinh nhật"], "happy birthday"],
  [["tết"], "lunar new year"],
  [["giáng sinh"], "merry christmas"],
];
const MAP = new Map<string, string>(PAIRS.flatMap(([vis, en]) => vis.map((v) => [foldVi(v), en] as [string, string])));

/** Từ tiếng Anh tương ứng với câu tìm tiếng Việt (nguyên câu, không dấu), hoặc null. */
export function gifQueryEn(q: string): string | null {
  const k = foldVi(q).trim().replace(/\s+/g, " ");
  return MAP.get(k) ?? null;
}
