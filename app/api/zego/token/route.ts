import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { generateToken04 } from "@/lib/zegoServerAssistant";

// POST /api/zego/token — sinh Kit Token cho ZegoCloud PHÍA SERVER.
//
// Trước đây VideoCallRoom.tsx tự sinh token ngay trong trình duyệt bằng
// `ZegoUIKitPrebuilt.generateKitTokenForTest()` với APP_ID + SERVER_SECRET
// đọc từ biến môi trường NEXT_PUBLIC_* — nghĩa là cả 2 giá trị đó bị Next.js
// nhúng thẳng vào bundle JS công khai, ai mở DevTools/xem source cũng lấy
// được. Có App ID + ServerSecret, BẤT KỲ AI (không cần tài khoản, không cần
// đăng nhập) đều tự mint được token hợp lệ cho MỌI roomId/userId họ muốn —
// tức là nghe lén hoặc giả danh trong bất kỳ cuộc gọi nào đang diễn ra, biến
// nhãn "CUỘC GỌI VIDEO E2EE" trên UI thành vô nghĩa. Route này thay thế cách
// làm đó: secret không bao giờ rời khỏi server, và token chỉ được cấp cho
// đúng người dùng đang đăng nhập, đúng roomId họ có quyền tham gia.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const roomId = typeof body?.roomId === "string" ? body.roomId : "";
    const userName = typeof body?.userName === "string" && body.userName.trim() ? body.userName.trim() : "User";

    // roomId luôn có dạng "call-<idA>-<idB>" (2 id sắp xếp alphabet, xem
    // CallManager.tsx) — chỉ cấp token nếu userId hiện tại là 1 trong 2 bên,
    // để không ai xin được token vào phòng của người khác chỉ bằng cách biết
    // roomId (roomId có thể đoán được vì id 2 phía lộ công khai qua
    // /profile/<id>, /api/jobs, /api/technicians).
    if (!roomId.startsWith("call-")) {
      return NextResponse.json({ error: "roomId không hợp lệ." }, { status: 400 });
    }
    const participantIds = roomId.slice("call-".length).split("-");
    if (
      participantIds.length !== 2 ||
      participantIds[0] === participantIds[1] ||
      !participantIds.includes(userId)
    ) {
      return NextResponse.json({ error: "Bạn không có quyền tham gia phòng gọi này." }, { status: 403 });
    }
    const otherId = participantIds.find((id: string) => id !== userId)!;

    const blockExists = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedUserId: otherId },
          { blockerId: otherId, blockedUserId: userId },
        ],
      },
    });
    if (blockExists) {
      return NextResponse.json({ error: "Không thể gọi — một trong hai người đã chặn." }, { status: 403 });
    }

    const appId = Number(process.env.ZEGO_APP_ID || process.env.NEXT_PUBLIC_ZEGO_APP_ID);
    const secret = process.env.ZEGO_SERVER_SECRET || "";
    if (!appId || !secret) {
      console.error("ZEGO_APP_ID / ZEGO_SERVER_SECRET chưa cấu hình trên server.");
      return NextResponse.json({ error: "Dịch vụ gọi video chưa được cấu hình." }, { status: 503 });
    }

    // 1 giờ là đủ cho 1 phiên gọi; token chỉ dùng để join phòng, không phải
    // phiên đăng nhập dài hạn.
    const token04 = generateToken04(appId, userId, secret, 3600, "");

    // ZegoUIKitPrebuilt.create() KHÔNG nhận thẳng chuỗi Token04 — SDK parse
    // theo format "<token04>#<base64 JSON metadata>" (xem
    // generateKitTokenForProduction trong chính SDK đã cài). Ghép sẵn ở đây
    // để client chỉ cần gọi create(kitToken) như cũ, không cần biết chi tiết
    // định dạng này.
    const metadata = Buffer.from(
      JSON.stringify({
        userID: userId,
        roomID: roomId,
        userName: encodeURIComponent(userName || ""),
        appID: appId,
      })
    ).toString("base64");
    const kitToken = `${token04}#${metadata}`;

    return NextResponse.json({ token: kitToken, userId, userName });
  } catch (err) {
    console.error("POST /api/zego/token error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tạo token cuộc gọi." }, { status: 500 });
  }
}
