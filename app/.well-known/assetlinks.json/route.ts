import { NextResponse } from "next/server";

// Android App Links: https://www.bitpawos.com/.well-known/assetlinks.json
// Cho phép app com.bitpawos.app mở thẳng các link www.bitpawos.com khai trong
// android/app/src/main/AndroidManifest.xml (intent-filter autoVerify).
//
// sha256_cert_fingerprints phải có chứng chỉ của KHOÁ KÝ APP mà máy người dùng
// cài: bản tải từ Google Play được ký bằng "App signing key" của Play (Play
// Console > Test and release > App integrity), KHÔNG phải upload key. Đặt
// ANDROID_APP_LINK_SHA256 trên Vercel = SHA-256 đó (nhiều giá trị cách nhau dấu phẩy).
// Upload key bên dưới (CN=PawNail, chứng chỉ công khai trong AAB 28/10/2026) chỉ
// dùng cho bản cài tay / thử nội bộ ký bằng khoá đó.
const PACKAGE_NAME = "com.bitpawos.app";
const UPLOAD_KEY_SHA256 = "D9:4B:99:5D:ED:47:43:63:9B:CD:DA:46:C3:3C:78:3F:DE:A9:13:E6:C1:74:87:C3:30:7B:99:91:BB:BF:4E:33";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const fromEnv = (process.env.ANDROID_APP_LINK_SHA256 || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FINGERPRINT.test(s));
  const fingerprints = [...new Set([...fromEnv, UPLOAD_KEY_SHA256])];
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
