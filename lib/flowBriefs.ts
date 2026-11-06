import MANIFEST_2026_11 from "@/lib/data/flow-briefs-2026-11.json";
import { DESIGN_ID_RE } from "@/lib/flowMarks";

// Lô brief Google Flow 2026-11: chủ tiệm vẽ lại ảnh mẫu cũ bằng Flow (Nano Banana), mỗi ảnh đặt tên theo mã
// D001…D213 → bảng mã → mẫu ở lib/data/flow-briefs-2026-11.json. Lô SAU dùng thẳng id mẫu làm mã (xem
// "Xuất brief" trong components/designs/FlowImport) nên không cần bảng mã mới.

export interface FlowBrief { code: string; designId: string; title: string; occasion: string | null }
export const FLOW_BATCH = "2026-11";
export const FLOW_MANIFEST: readonly FlowBrief[] = MANIFEST_2026_11 as FlowBrief[];

const byCode = new Map(FLOW_MANIFEST.map((b) => [b.code, b]));
const byDesign = new Map(FLOW_MANIFEST.map((b) => [b.designId, b]));

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
