import { NextResponse } from "next/server";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { flowStorage, importFlowImage } from "@/lib/flowBridge";

// POST /api/admin/designs/flow/import { code, secure_url, public_id, width, height, bytes }
// Gắn ảnh vừa tải lên Cloudinary vào mẫu của mã: link phải đúng kho Cloudinary + thư mục ảnh Flow + public_id của
// mã, ảnh vuông (lệch ≤ 2%) và ≥ 1024px. Ảnh cũ cất trong [was:…] để hoàn tác. Nhập lại đúng ảnh đó: không đổi gì.
export async function POST(req: Request) {
  const a = await flowAdmin("import");
  if (a.error) return a.error;
  const s = flowStorage();
  if (!s) return NextResponse.json({ error: "Máy chủ chưa cấu hình Cloudinary / storage not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Yêu cầu không hợp lệ / bad request" }, { status: 400 });
  const r = await importFlowImage(
    {
      code: body.code,
      secure_url: typeof body.secure_url === "string" ? body.secure_url : undefined,
      public_id: typeof body.public_id === "string" ? body.public_id : undefined,
      width: Number(body.width), height: Number(body.height), bytes: Number(body.bytes),
    },
    { cloudName: s.cloudName },
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  return NextResponse.json(r, { headers: noStore });
}
