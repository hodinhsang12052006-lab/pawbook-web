import { NextRequest, NextResponse } from "next/server";
import { getRadarEstimate, Market, SkillKey } from "@/lib/nailRadarData";

const VALID_MARKETS: Market[] = ["US", "AU"];
const VALID_SKILLS: SkillKey[] = ["BOT", "DIP", "TAY_NUOC"];

// GET /api/tools/radar?market=US&state=CA&skill=BOT — không yêu cầu đăng
// nhập, đây là công cụ tham khảo công khai (giống tinh thần "công cụ độc
// quyền" nhưng vẫn nên để ai cũng xem được để giữ chân người dùng mới).
export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get("market") as Market | null;
  const state = req.nextUrl.searchParams.get("state");
  const skill = req.nextUrl.searchParams.get("skill") as SkillKey | null;

  if (!market || !VALID_MARKETS.includes(market)) {
    return NextResponse.json({ error: "Thiếu hoặc sai tham số market (US/AU)." }, { status: 400 });
  }
  if (!state) {
    return NextResponse.json({ error: "Thiếu tham số state." }, { status: 400 });
  }
  if (!skill || !VALID_SKILLS.includes(skill)) {
    return NextResponse.json({ error: "Thiếu hoặc sai tham số skill (BOT/DIP/TAY_NUOC)." }, { status: 400 });
  }

  const result = getRadarEstimate(market, state, skill);
  if (!result) {
    return NextResponse.json({ error: `Chưa có dữ liệu tham khảo cho bang "${state}".` }, { status: 404 });
  }

  return NextResponse.json(result);
}
