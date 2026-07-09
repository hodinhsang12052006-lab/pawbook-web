import { NextResponse } from "next/server";

export function proxy() {
  // Tạm thời "sa thải" bảo vệ Edge để trị dứt điểm bộ nhớ đệm của Vercel
  return NextResponse.next();
}

export const config = {
  // Để trống matcher để không chặn bất cứ đường dẫn nào ở vòng ngoài
  matcher: [],
};