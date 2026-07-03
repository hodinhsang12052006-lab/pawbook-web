import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import moment from "moment";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để thực hiện thanh toán." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount } = body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Số tiền nạp vào tài khoản không hợp lệ." },
        { status: 400 }
      );
    }

    const ipAddr = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const tmnCode = process.env.VNP_TMNCODE || "2QTY7D9L";
    const secretKey = process.env.VNP_HASHSECRET || "GET8K5AZE2Q4E5A8R89Q8Q2W8Q1Q1E21";
    const vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl = process.env.VNP_RETURNURL || "http://localhost:3000/api/wallet/vnpay/callback";

    const date = new Date();
    const createDate = moment(date).format("YYYYMMDDHHmmss");
    const orderId = moment(date).format("DDHHmmss");

    const vnp_Params: any = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = "VND";
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = `PawBook Topup ${amount} VND`;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100; // VNPay quantity matches VND * 100
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;

    // Sort parameters ascending
    const sortedKeys = Object.keys(vnp_Params).sort();
    const signData: string[] = [];
    const searchParams = new URLSearchParams();

    sortedKeys.forEach((key) => {
      const val = vnp_Params[key];
      if (val !== null && val !== undefined && val !== "") {
        searchParams.append(key, val.toString());
        signData.push(`${key}=${encodeURIComponent(val.toString()).replace(/%20/g, "+")}`);
      }
    });

    const signString = signData.join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signString, "utf-8")).digest("hex");
    
    const finalUrl = `${vnpUrl}?${searchParams.toString()}&vnp_SecureHash=${signed}`;

    return NextResponse.json({ paymentUrl: finalUrl });
  } catch (err: any) {
    console.error("VNPay Create URL error:", err);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi khởi tạo giao dịch VNPay." },
      { status: 500 }
    );
  }
}
