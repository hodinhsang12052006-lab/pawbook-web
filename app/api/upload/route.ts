import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary keys
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy file để tải lên." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Promise wrapper for Cloudinary upload stream
    const uploadToCloudinary = () => {
      return new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "pawbook",
            resource_type: "auto", // Auto detects image, pdf, docx, video
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
    };

    const result = await uploadToCloudinary();

    return NextResponse.json({ secure_url: result.secure_url });
  } catch (error: any) {
    console.error("Cloudinary upload route error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi upload file lên Cloudinary." },
      { status: 550 }
    );
  }
}
