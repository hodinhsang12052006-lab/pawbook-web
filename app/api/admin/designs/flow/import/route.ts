import { NextResponse } from "next/server";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { flowStorage, importFlowImage } from "@/lib/flowBridge";

// POST /api/admin/designs/flow/import { code, secure_url, public_id, version, signature, width, height, bytes }
// Gắn ảnh vừa tải lên Cloudinary vào mẫu của mã: link phải đúng kho Cloudinary + thư mục ảnh Flow + public_id của
// mã (kèm đuôi ngẫu nhiên lúc ký), chữ ký phản hồi của Cloudinary đúng (ảnh có thật), ảnh vuông (lệch ≤ 2%) và
// ≥ 1024px. Ảnh cũ cất trong [was:…] để hoàn tác. Nhập lại đúng ảnh đang hiện: không đổi gì.
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : NaN);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export async function POST(req: Request) {
  const a = await flowAdmin("import", req);
  if (a.error) return a.error;
  const s = flowStorage();
  if (!s) return NextResponse.json({ error: "Máy chủ chưa cấu hình Cloudinary / storage not configured" }, { status: 503, headers: noStore });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Yêu cầu không hợp lệ / bad request" }, { status: 400, headers: noStore });
  const r = await importFlowImage(
    {
      code: body.code, secure_url: str(body.secure_url), public_id: str(body.public_id), signature: str(body.signature),
      version: num(body.version), width: num(body.width), height: num(body.height), bytes: num(body.bytes),
    },
    { cloudName: s.cloudName, secret: s.secret },
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  return NextResponse.json(r, { headers: noStore });
}
