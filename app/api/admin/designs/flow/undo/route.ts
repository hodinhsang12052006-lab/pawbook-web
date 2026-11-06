import { NextResponse } from "next/server";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { undoFlowImage } from "@/lib/flowBridge";

// POST /api/admin/designs/flow/undo { designId } — trả lại ảnh trước khi nhập Flow (dấu [was:…]), gỡ dấu [flow:…].
export async function POST(req: Request) {
  const a = await flowAdmin("undo");
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { designId?: unknown };
  const r = await undoFlowImage(body.designId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  return NextResponse.json(r, { headers: noStore });
}
