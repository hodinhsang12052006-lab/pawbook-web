import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Market, PostType } from "@prisma/client";

const PAGE_SIZE = 12;
const VALID_POST_TYPES = ["GENERAL", "SHOWCASE", "JOB"];

function mapPost(post: any, viewerId: string | null) {
  return {
    id: post.id,
    content: post.content,
    postType: post.postType,
    mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
    market: post.market,
    state: post.state,
    city: post.city,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    likeCount: post._count?.likes ?? 0,
    commentCount: post._count?.comments ?? 0,
    likedByMe: viewerId ? (post.likes?.length ?? 0) > 0 : false,
  };
}

// GET /api/posts?market=&state=&city=&authorId=&postType=&cursor= — newsfeed
// trang chủ, phân trang kiểu cursor giống /api/messages (mượt cho vuốt vô
// hạn trên mobile, không lệch trang khi có bài mới chen vào giữa lúc cuộn).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id ?? null;

    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const authorId = searchParams.get("authorId");
    const postType = searchParams.get("postType");
    const cursor = searchParams.get("cursor");

    const where: any = {};
    if (market === "US" || market === "AU") where.market = market as Market;
    if (state) where.state = state;
    if (city) where.city = { contains: city };
    if (authorId) where.authorId = authorId;
    if (postType && VALID_POST_TYPES.includes(postType)) where.postType = postType as PostType;

    const posts = await prisma.post.findMany({
      where,
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true, city: true, state: true } },
        _count: { select: { likes: true, comments: true } },
        ...(viewerId ? { likes: { where: { userId: viewerId }, select: { id: true } } } : {}),
      },
    });

    const nextCursor = posts.length === PAGE_SIZE ? posts[posts.length - 1].id : null;

    return NextResponse.json({
      posts: posts.map((p) => mapPost(p, viewerId)),
      nextCursor,
    });
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: "Không thể tải bảng tin." }, { status: 500 });
  }
}

// POST /api/posts — đăng bài mới lên newsfeed (mọi role đã đăng nhập).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để đăng bài." }, { status: 401 });
    }

    const body = await req.json();
    const { content, postType, mediaUrls } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Nội dung bài đăng không được để trống." }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "Nội dung bài đăng quá dài (tối đa 2000 ký tự)." }, { status: 400 });
    }
    const safePostType: PostType = VALID_POST_TYPES.includes(postType) ? postType : "GENERAL";
    const safeMediaUrls = Array.isArray(mediaUrls) ? mediaUrls.filter((u) => typeof u === "string") : [];

    const author = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { market: true, state: true, city: true },
    });

    const post = await prisma.post.create({
      data: {
        authorId: session.user.id,
        content: content.trim(),
        postType: safePostType,
        mediaUrls: JSON.stringify(safeMediaUrls),
        market: author?.market ?? null,
        state: author?.state ?? null,
        city: author?.city ?? null,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true, city: true, state: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    return NextResponse.json(mapPost(post, session.user.id), { status: 201 });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "Không thể đăng bài. Vui lòng thử lại." }, { status: 500 });
  }
}
