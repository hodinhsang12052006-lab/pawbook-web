import { NextResponse } from "next/server";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { exportCandidates, flowStorage, listImported, listManifest, lookupCodes } from "@/lib/flowBridge";

// GET /api/admin/designs/flow                — lô brief 2026-11 (mã, mẫu, ảnh hiện tại, đã có ảnh Flow chưa)
//                                              + MỌI mẫu đang là ảnh Flow (mọi lô) để hoàn tác
// GET /api/admin/designs/flow?codes=D001,c…  — tra các mã đọc từ tên file ảnh (tối đa 300, mỗi mã ≤ 40 ký tự)
// GET /api/admin/designs/flow?export=1       — mẫu đã đăng chưa có ảnh Flow (để xuất brief)
// Chỉ ADMIN (lib/flowAdmin).
export async function GET(req: Request) {
  const a = await flowAdmin("list", req);
  if (a.error) return a.error;
  const sp = new URL(req.url).searchParams;
  const storage = !!flowStorage();
  if (sp.has("codes")) {
    const codes = String(sp.get("codes") ?? "").slice(0, 300 * 41).split(",").slice(0, 300).map((c) => c.slice(0, 40));
    return NextResponse.json({ storage, rows: await lookupCodes(codes) }, { headers: noStore });
  }
  if (sp.get("export") === "1") {
    return NextResponse.json({ storage, candidates: await exportCandidates() }, { headers: noStore });
  }
  const [m, importedRows] = await Promise.all([listManifest(), listImported()]);
  return NextResponse.json({ storage, ...m, imported: m.rows.filter((r) => r.flow).length, importedRows }, { headers: noStore });
}
