import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { getViews } from "@/lib/postStats";
import { Market, PostType } from "@prisma/client";

const PAGE_SIZE = 12;
const VALID_POST_TYPES = ["GENERAL", "SHOWCASE", "JOB"];

type Liker = { id: string; name: string; avatarUrl: string | null };

// "Đang hot" tính từ tương tác THẬT trong 48h đầu (bình luận nặng hơn like
// vì tốn công hơn) — không có số ảo.
const HOT_WINDOW_MS = 48 * 60 * 60 * 1000;
const HOT_SCORE = 5;

type PollView = { question: string; options: { label: string; votes: number }[]; total: number; myVote: number | null } | null;

// Bài "Tâm sự ẩn danh": KHÔNG trả id / tên / ảnh / thành phố người đăng — chỉ vai trò + bang.
function anonAuthor(a: { role?: string; state?: string | null } | null) {
  return { id: null, name: a?.role === "OWNER" ? "Chủ tiệm ẩn danh" : "Thợ ẩn danh", avatarUrl: null, role: a?.role ?? "TECHNICIAN", city: null, state: a?.state ?? null, anonymous: true };
}

function mapPost(post: any, viewerId: string | null, likers: Liker[] = [], views = 0, poll: PollView = null) {
  const likeCount = post._count?.likes ?? 0;
  const commentCount = post._count?.comments ?? 0;
  const isRecent = Date.now() - post.createdAt.getTime() < HOT_WINDOW_MS;
  return {
    id: post.id,
    content: post.content,
    postType: post.postType,
    mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
    market: post.market,
    state: post.state,
    city: post.city,
    createdAt: post.createdAt.toISOString(),
    author: post.anonymous ? anonAuthor(post.author) : post.author,
    anonymous: !!post.anonymous,
    poll,
    likeCount,
    commentCount,
    likedByMe: viewerId ? (post.likes?.length ?? 0) > 0 : false,
    // Tối đa 3 người thích gần nhất (người thật) cho dòng "A, B và N người khác".
    recentLikers: likers,
    views,
    isHot: isRecent && likeCount + commentCount * 2 >= HOT_SCORE,
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

    // Chỉ bài đã đăng (tâm sự ẩn danh chờ duyệt thì chưa hiện)
    const where: any = { status: "published" };
    // Bài chung (market / bang trống: bài chính thức, chủ đề nóng, mẫu hôm nay…) hiện ở MỌI bộ lọc
    // Mỹ / Úc / bang — trước đây lọc khu vực là các bài này biến mất khỏi bảng tin.
    const and: any[] = [];
    if (market === "US" || market === "AU") and.push({ OR: [{ market: market as Market }, { market: null }] });
    if (state) and.push({ OR: [{ state }, { state: null }] });
    if (and.length) where.AND = and;
    if (city) where.city = { contains: city };
    // Trang hồ sơ 1 người: KHÔNG kèm bài ẩn danh của họ (kẻo lộ danh tính) — trừ chính chủ xem
    if (authorId) { where.authorId = authorId; if (authorId !== viewerId) where.anonymous = false; }
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

    // 1 query cho cả trang (không N+1): lấy like mới nhất của các bài này rồi
    // gom tối đa 3 người/bài.
    const recentLikes = posts.length
      ? await prisma.postLike.findMany({
          where: { postId: { in: posts.map((p) => p.id) } },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: { postId: true, user: { select: { id: true, name: true, avatarUrl: true } } },
        })
      : [];
    const viewsByPost = await getViews(posts.map((p) => p.id));
    // Thăm dò: đếm phiếu theo lựa chọn + phiếu của người xem (1 query mỗi loại cho cả trang)
    const pollRows = posts.length ? await prisma.postPoll.findMany({ where: { postId: { in: posts.map((p) => p.id) } } }).catch(() => []) : [];
    const pollIds = pollRows.map((p) => p.postId);
    const [tally, mine] = pollIds.length
      ? await Promise.all([
          prisma.postPollVote.groupBy({ by: ["postId", "option"], where: { postId: { in: pollIds } }, _count: { _all: true } }),
          viewerId ? prisma.postPollVote.findMany({ where: { postId: { in: pollIds }, userId: viewerId }, select: { postId: true, option: true } }) : Promise.resolve([]),
        ])
      : [[], []];
    const polls = new Map<string, PollView>();
    for (const p of pollRows) {
      let labels: string[] = [];
      try { labels = JSON.parse(p.options); } catch {}
      const options = labels.map((label, i) => ({ label, votes: tally.find((t) => t.postId === p.postId && t.option === i)?._count._all ?? 0 }));
      polls.set(p.postId, { question: p.question, options, total: options.reduce((a, o) => a + o.votes, 0), myVote: mine.find((m) => m.postId === p.postId)?.option ?? null });
    }
    const likersByPost = new Map<string, Liker[]>();
    for (const like of recentLikes) {
      const list = likersByPost.get(like.postId) ?? [];
      if (list.length < 3) list.push(like.user);
      likersByPost.set(like.postId, list);
    }

    return NextResponse.json({
      posts: posts.map((p) => mapPost(p, viewerId, likersByPost.get(p.id), viewsByPost.get(p.id) ?? 0, polls.get(p.id) ?? null)),
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
    // "Tâm sự ẩn danh": không hiện tên; vào hàng CHỜ DUYỆT (chặn bôi nhọ tên tiệm / người); tối đa 3 bài/ngày.
    const anonymous = body?.anonymous === true;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Nội dung bài đăng không được để trống." }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "Nội dung bài đăng quá dài (tối đa 2000 ký tự)." }, { status: 400 });
    }
    const safePostType: PostType = VALID_POST_TYPES.includes(postType) ? postType : "GENERAL";
    const safeMediaUrls = Array.isArray(mediaUrls)
      ? mediaUrls.filter((u) => typeof u === "string" && /^(https:\/\/|data:image\/)/.test(u))
      : [];
    // Mỗi trang feed kéo 12 bài kèm toàn bộ mediaUrls — giới hạn số ảnh và
    // tổng dung lượng để 1 bài không làm nặng feed của mọi người.
    if (safeMediaUrls.length > 10 || JSON.stringify(safeMediaUrls).length > 8_000_000) {
      return NextResponse.json({ error: "Tối đa 10 ảnh mỗi bài đăng." }, { status: 400 });
    }

    const author = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { market: true, state: true, city: true },
    });
    if (anonymous) {
      const today = await prisma.post.count({ where: { authorId: session.user.id, anonymous: true, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
      if (today >= 3) return NextResponse.json({ error: "Mỗi ngày tối đa 3 tâm sự ẩn danh — mai bạn gửi tiếp nhé." }, { status: 429 });
    }

    const post = await prisma.post.create({
      data: {
        authorId: session.user.id,
        content: content.trim(),
        postType: safePostType,
        mediaUrls: JSON.stringify(safeMediaUrls),
        market: author?.market ?? null,
        state: author?.state ?? null,
        city: anonymous ? null : author?.city ?? null, // ẩn danh: chỉ giữ bang, bỏ thành phố
        ...(anonymous ? { anonymous: true, status: "pending" } : {}),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true, city: true, state: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (anonymous) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      sendPush(admins.map((a) => a.id), { title: "🤫 Tâm sự ẩn danh chờ duyệt", body: content.trim().slice(0, 80), url: "/admin/studio#tam-su", tag: "pn-anon" }).catch(() => {});
    }
    return NextResponse.json({ ...mapPost(post, session.user.id), pending: anonymous }, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "Không thể đăng bài. Vui lòng thử lại." }, { status: 500 });
  }
}
