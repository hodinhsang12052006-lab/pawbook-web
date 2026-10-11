import { NextResponse } from "next/server";
import { publishHotTopicPost } from "@/lib/hotTopics";
import { publishNewsPosts } from "@/lib/newsPosts";

// Cron TỐI (01:00 UTC ≈ chiều/tối bên Mỹ, trưa bên Úc): 1 "chủ đề nóng" (thảo luận + thăm dò) + 1 tin ngành.
// Cron sáng (/api/cron/designs, 13:00 UTC): bài kiến thức + "4 mẫu nail hôm nay" + tin ngành thứ 2.
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const deadline = Date.now() + 50_000;
  const fail = (e: unknown) => ({ posted: false, reason: String((e as Error).message).slice(0, 120) });
  const topic = await publishHotTopicPost().catch(fail);
  const news = await publishNewsPosts(new Date(), { max: 1, deadline }).catch(fail);
  return NextResponse.json({ topic, news });
}
