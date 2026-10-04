import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

// POST /api/upload/sign — chữ ký để trình duyệt tải VIDEO thẳng lên Cloudinary
// (Vercel giới hạn body request ~4.5MB nên video không thể đi qua /api/upload).
// Chữ ký khoá cứng thư mục + định dạng video cho phép + hết hạn sau ~1 giờ
// (Cloudinary tự từ chối timestamp cũ) — không ai dùng được để tải thứ khác.
const VIDEO_FORMATS = "mp4,mov,webm,m4v";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const key = `upload-sign:${userId}`;
  if (isRateLimited(key, 30, 60 * 60 * 1000)) return NextResponse.json({ error: "Bạn tải lên quá nhiều, thử lại sau." }, { status: 429 });
  recordAttempt(key, 60 * 60 * 1000);

  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình kho video." }, { status: 503 });
  }
  const timestamp = Math.round(Date.now() / 1000);
  const params = { allowed_formats: VIDEO_FORMATS, folder: "pawbook/video", timestamp };
  const signature = cloudinary.utils.api_sign_request(params, secret);
  return NextResponse.json({ cloudName, apiKey, signature, ...params });
}
