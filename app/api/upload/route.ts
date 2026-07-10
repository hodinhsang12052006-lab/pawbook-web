import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tải lên tệp tin." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy tệp tin nào để tải lên." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB max size limit
      return NextResponse.json(
        { error: "File quá lớn (tối đa 10MB)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fallback if Cloudinary is not configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.log("Cloudinary not configured. Falling back to Base64 upload representation.");
      const mimeType = file.type || "application/octet-stream";
      const base64String = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64String}`;
      return NextResponse.json({
        url: dataUrl,
        publicId: "fallback_base64",
      });
    }

    // Upload buffer contents using Cloudinary upload stream to bypass local folder writing
    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "pawbook",
          resource_type: "auto", // Automatically detects whether resource is PDF or image
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (err: any) {
    console.error("Cloudinary upload API error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống trong quá trình tải tệp tin lên đám mây Cloudinary." },
      { status: 500 }
    );
  }
}
