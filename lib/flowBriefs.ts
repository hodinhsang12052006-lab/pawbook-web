import MANIFEST_2026_11 from "@/lib/data/flow-briefs-2026-11.json";
import { DESIGN_ID_RE, filenameCodes } from "@/lib/flowMarks";

// Lô brief Google Flow 2026-11: chủ tiệm vẽ lại ảnh mẫu cũ bằng Flow (Nano Banana), mỗi ảnh đặt tên theo mã
// D001…D213 → bảng mã → mẫu ở lib/data/flow-briefs-2026-11.json. Lô SAU dùng thẳng id mẫu làm mã (xem
// "Xuất brief" trong components/designs/FlowImport) nên không cần bảng mã mới. Dùng được cả ở trình duyệt.

export interface FlowBrief { code: string; designId: string; title: string; occasion: string | null }
export const FLOW_BATCH = "2026-11";
export const FLOW_MANIFEST: readonly FlowBrief[] = MANIFEST_2026_11 as FlowBrief[];

const byCode = new Map(FLOW_MANIFEST.map((b) => [b.code, b]));
const byDesign = new Map(FLOW_MANIFEST.map((b) => [b.designId, b]));
/** D-mã lô 2026-11 của 1 mẫu (nếu có) — "Xuất brief" dùng lại mã này thay vì id mẫu dài. */
export const manifestCodeOf = (designId: string): string | null => byDesign.get(designId)?.code ?? null;

export interface ResolvedCode { code: string; designId: string; brief: FlowBrief | null }

/** Mã ảnh Flow → mẫu: D-mã trong bảng 2026-11 (không phân biệt hoa thường) hoặc id mẫu. Sai/không có → null. */
export function resolveCode(raw: unknown): ResolvedCode | null {
  const s = String(raw ?? "").trim();
  if (/^[Dd]\d{3}$/.test(s)) {
    const b = byCode.get(s.toUpperCase());
    return b ? { code: b.code, designId: b.designId, brief: b } : null;
  }
  if (DESIGN_ID_RE.test(s)) return { code: s, designId: s, brief: byDesign.get(s) ?? null };
  return null;
}

export type FilenameIssue = "none" | "ambiguous" | "mismatch";
/** Mã của 1 file ảnh Flow. Tên có nhiều mã khác nhau ("D012-D013.png") → ambiguous; có cả D-mã lẫn id mẫu mà 2 mã
 *  không cùng 1 mẫu → mismatch (không bao giờ đoán). D-mã + đúng id của nó → D-mã. */
export function parseFlowFilename(name: string): { code: string | null; issue?: FilenameIssue } {
  const { dcodes, ids } = filenameCodes(name);
  if (!dcodes.length && !ids.length) return { code: null, issue: "none" };
  if (dcodes.length > 1 || ids.length > 1) return { code: null, issue: "ambiguous" };
  if (dcodes.length && ids.length) {
    return byCode.get(dcodes[0])?.designId === ids[0] ? { code: dcodes[0] } : { code: null, issue: "mismatch" };
  }
  return { code: dcodes[0] ?? ids[0] };
}
