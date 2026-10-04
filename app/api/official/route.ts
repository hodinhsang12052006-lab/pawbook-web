import { NextResponse } from "next/server";
import { getOfficialAccount } from "@/lib/official";

// GET /api/official — tài khoản chính thức (tick xanh) để ghim kênh hỗ trợ
// lên đầu danh sách tin nhắn. Chỉ id, tên, ảnh — không dữ liệu riêng tư.
export async function GET() {
  const acc = await getOfficialAccount();
  return NextResponse.json(
    { account: acc },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  );
}
