import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import prisma from "@/lib/prisma";
import { flowAdmin, noStore } from "@/lib/flowAdmin";
import { flowStorage } from "@/lib/flowBridge";
import { resolveCode } from "@/lib/flowBriefs";
import { FLOW_FOLDER, FLOW_FORMATS, FLOW_TAG, flowUploadId } from "@/lib/flowMarks";

// POST /api/admin/designs/flow/sign { code } — chữ ký để trình duyệt admin tải 1 ảnh Flow THẲNG lên Cloudinary.
// Chữ ký khoá cứng: thư mục pawbook/designs-flow, chỉ jpg/png/webp, public_id theo mẫu của mã + đuôi ngẫu nhiên mỗi
// lần ký, overwrite=false (tải lên không bao giờ thay ảnh đang hiện — ảnh chỉ lên trang khi /import duyệt), timestamp
// lúc ký (Cloudinary từ chối chữ ký cũ hơn 1 giờ). Không trả secret; api_key là khoá công khai của Cloudinary.
export async function POST(req: Request) {
  const a = await flowAdmin("sign", req);
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const r = resolveCode(body?.code);
  if (!r) return NextResponse.json({ error: "Mã ảnh không hợp lệ / unknown image code" }, { status: 400, headers: noStore });
  const exists = await prisma.nailDesign.findUnique({ where: { id: r.designId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Không tìm thấy mẫu / design not found" }, { status: 404, headers: noStore });
  const s = flowStorage();
  if (!s) return NextResponse.json({ error: "Máy chủ chưa cấu hình Cloudinary / storage not configured" }, { status: 503, headers: noStore });
  const publicId = flowUploadId(r.code, r.designId, crypto.randomBytes(5).toString("hex"));
  const params = { allowed_formats: FLOW_FORMATS, folder: FLOW_FOLDER, overwrite: "false", public_id: publicId, tags: FLOW_TAG, timestamp: Math.round(Date.now() / 1000) };
  const signature = cloudinary.utils.api_sign_request(params, s.secret);
  return NextResponse.json(
    { code: r.code, designId: r.designId, uploadUrl: `https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, apiKey: s.apiKey, signature, params },
    { headers: noStore },
  );
}
