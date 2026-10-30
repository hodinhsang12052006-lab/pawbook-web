import { NextResponse } from "next/server";

// iOS Universal Links: https://www.bitpawos.com/.well-known/apple-app-site-association
// Khớp entitlement com.apple.developer.associated-domains = applinks:www.bitpawos.com
// (ios/App/App/App.entitlements). appID = <Team ID>.<bundle id>; Team ID lấy từ
// APPLE_TEAM_ID (hoặc APNS_TEAM_ID đã dùng cho thông báo đẩy) trên Vercel. Chưa
// có Team ID thì trả 404 để Apple không lưu một file sai.
// /api/* và /auth/* luôn mở trong trình duyệt (callback đăng nhập, API).
const BUNDLE_ID = "com.bitpawos.app";

export function GET() {
  const teamId = (process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID || "").trim();
  if (!/^[A-Z0-9]{10}$/.test(teamId)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${BUNDLE_ID}`],
            components: [
              { "/": "/api/*", exclude: true },
              { "/": "/auth/*", exclude: true },
              { "/": "/*" },
            ],
          },
        ],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
