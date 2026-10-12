import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// GET /api/gifs?q=… — tìm GIF qua GIPHY (khoá GIPHY_API_KEY nằm ở máy chủ, không lộ ra trình duyệt).
// Chưa có khoá → { enabled: false } (bảng GIF dùng bộ GIF có sẵn). Chỉ người đã đăng nhập.
// Chỉ trả URL media*.giphy.com — khớp danh sách nguồn ảnh cho phép khi gửi tin (app/api/messages).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as { id?: string } | undefined)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, results: [] });

  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 50);
  const base = q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending";
  const url = `${base}?api_key=${encodeURIComponent(key)}&limit=24&rating=pg-13${q ? `&q=${encodeURIComponent(q)}&lang=vi` : ""}`;
  try {
    const r = await fetch(url, { next: { revalidate: q ? 3600 : 900 } });
    if (!r.ok) return NextResponse.json({ enabled: true, results: [] });
    const d = (await r.json()) as { data?: { images?: Record<string, { url?: string }> }[] };
    const ok = (u?: string) => !!u && /^https:\/\/media\d*\.giphy\.com\//.test(u);
    const results = (d.data ?? [])
      .map((g) => ({ url: g.images?.fixed_width?.url?.split("?")[0], preview: g.images?.fixed_width_downsampled?.url?.split("?")[0] || g.images?.fixed_width?.url?.split("?")[0] }))
      .filter((g) => ok(g.url) && ok(g.preview)) as { url: string; preview: string }[];
    return NextResponse.json({ enabled: true, results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ enabled: true, results: [] });
  }
}
