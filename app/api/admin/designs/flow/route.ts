import { NextResponse } from "next/server";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { exportCandidates, flowStorage, listManifest, lookupCodes } from "@/lib/flowBridge";

// GET /api/admin/designs/flow                — lô brief 2026-11: mã, mẫu, ảnh hiện tại, đã có ảnh Flow chưa
// GET /api/admin/designs/flow?codes=D001,c…  — tra các mã đọc từ tên file ảnh (tối đa 300)
// GET /api/admin/designs/flow?export=1       — mẫu đã đăng chưa có ảnh Flow (để xuất brief, mã = id mẫu)
// Chỉ ADMIN (lib/flowAdmin).
export async function GET(req: Request) {
  const a = await flowAdmin("list");
  if (a.error) return a.error;
  const sp = new URL(req.url).searchParams;
  const storage = !!flowStorage();
  if (sp.has("codes")) {
    const codes = String(sp.get("codes") ?? "").split(",").slice(0, 300);
    return NextResponse.json({ storage, rows: await lookupCodes(codes) }, { headers: noStore });
  }
  if (sp.get("export") === "1") {
    return NextResponse.json({ storage, candidates: await exportCandidates() }, { headers: noStore });
  }
  const m = await listManifest();
  return NextResponse.json({ storage, ...m, imported: m.rows.filter((r) => r.flow).length }, { headers: noStore });
}
