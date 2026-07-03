import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Extract signature hash
    const vnp_SecureHash = searchParams.get("vnp_SecureHash");
    if (!vnp_SecureHash) {
      return NextResponse.redirect(new URL("/pricing/result?status=error&message=MissingSignature", req.url));
    }

    // Build params map to verify signature hash
    const vnp_Params: any = {};
    searchParams.forEach((value, key) => {
      if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
        vnp_Params[key] = value;
      }
    });

    const secretKey = process.env.VNP_HASHSECRET || "GET8K5AZE2Q4E5A8R89Q8Q2W8Q1Q1E21";

    // Sort ascending by key
    const sortedKeys = Object.keys(vnp_Params).sort();
    const signData: string[] = [];
    sortedKeys.forEach((key) => {
      const val = vnp_Params[key];
      if (val !== null && val !== undefined && val !== "") {
        signData.push(`${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`);
      }
    });

    const signString = signData.join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signString, "utf-8")).digest("hex");

    // Signature verification check
    if (signed !== vnp_SecureHash) {
      console.error("VNPay return secure hash mismatch! Computed:", signed, "Received:", vnp_SecureHash);
      return NextResponse.redirect(new URL("/pricing/result?status=error&message=InvalidSignature", req.url));
    }

    const vnp_ResponseCode = searchParams.get("vnp_ResponseCode");
    const vnp_Amount = searchParams.get("vnp_Amount"); // in cents
    const vnp_TxnRef = searchParams.get("vnp_TxnRef");

    if (vnp_ResponseCode !== "00") {
      console.warn("VNPay payment response code indicates failure:", vnp_ResponseCode);
      return NextResponse.redirect(new URL(`/pricing/result?status=error&message=Code_${vnp_ResponseCode}`, req.url));
    }

    // Session validation
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.redirect(new URL("/pricing/result?status=error&message=Unauthorized", req.url));
    }

    const userId = (session.user as any).id;
    const amount = vnp_Amount ? parseFloat(vnp_Amount) / 100 : 0;

    // Calculate PawCoins to add based on package payments
    let pawCoinsAdded = 0;
    let isVipPackage = false;

    if (amount >= 500000) {
      pawCoinsAdded = 1200;
      isVipPackage = true;
    } else if (amount >= 50000) {
      pawCoinsAdded = 100;
    } else {
      // General proportional fallback topup rate
      pawCoinsAdded = Math.round(amount / 500);
    }

    if (pawCoinsAdded <= 0) {
      return NextResponse.redirect(new URL("/pricing/result?status=error&message=ZeroAmount", req.url));
    }

    // Update wallet balance and write transactions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          pawCoin: { increment: pawCoinsAdded },
          ...(isVipPackage ? { isVerified: true, trustScore: 5.0 } : {}),
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: pawCoinsAdded,
          type: "INCOME",
          description: `Nạp tiền VNPay thành công: ${isVipPackage ? "Gói Tuyển Dụng VIP" : "Gói PawCoin Cơ Bản"} (+${pawCoinsAdded} PawCoins)`,
          amountVND: amount,
          pawCoinAmount: pawCoinsAdded,
          status: "SUCCESS",
          provider: "VNPAY",
        },
      }),
    ]);

    return NextResponse.redirect(new URL("/pricing/result?status=success", req.url));
  } catch (err: any) {
    console.error("VNPay callback error:", err);
    return NextResponse.redirect(new URL("/pricing/result?status=error&message=SystemError", req.url));
  }
}
