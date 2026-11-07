import { NextResponse } from "next/server";

// Android App Links: https://www.bitpawos.com/.well-known/assetlinks.json
// Cho phép app com.bitpawos.app mở thẳng các link www.bitpawos.com khai trong
// android/app/src/main/AndroidManifest.xml (intent-filter autoVerify).
//
// sha256_cert_fingerprints phải có chứng chỉ của KHOÁ KÝ APP mà máy người dùng
// cài: bản tải từ Google Play được ký bằng "App signing key" của Play (Play
// Console > Test and release > App integrity), KHÔNG phải upload key.
//   - PLAY_SIGNING_KEY_SHA256: App signing key của Play (vân tay CÔNG KHAI, chép từ Play Console 11/2026) → App
//     Links xác minh được cho bản cài từ Google Play.
//   - UPLOAD_KEY_SHA256 (CN=PawNail, chứng chỉ công khai trong AAB 28/10/2026): bản cài tay / thử nội bộ ký bằng
//     upload key.
//   - ANDROID_APP_LINK_SHA256 trên Vercel (tuỳ chọn, nhiều giá trị cách nhau dấu phẩy): thêm khoá khác (VD Play
//     xoay khoá ký) mà không cần sửa code.
const PACKAGE_NAME = "com.bitpawos.app";
const PLAY_SIGNING_KEY_SHA256 = "08:01:AD:2F:78:0E:7C:E9:2F:0F:A3:28:38:54:13:E9:8F:F4:AF:6D:83:83:5D:D0:C3:25:C0:F7:0C:74:2D:64";
const UPLOAD_KEY_SHA256 = "D9:4B:99:5D:ED:47:43:63:9B:CD:DA:46:C3:3C:78:3F:DE:A9:13:E6:C1:74:87:C3:30:7B:99:91:BB:BF:4E:33";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const fromEnv = (process.env.ANDROID_APP_LINK_SHA256 || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FINGERPRINT.test(s));
  const fingerprints = [...new Set([...fromEnv, PLAY_SIGNING_KEY_SHA256, UPLOAD_KEY_SHA256])];
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
