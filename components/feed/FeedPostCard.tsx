"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Send, MapPin, Play, ArrowRight, Loader2 } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { timeAgo, renderContentWithHashtags, roleBadgeLabel } from "@/lib/feedFormat";

export interface FeedPost {
  id: string;
  content: string;
  postType: "GENERAL" | "SHOWCASE" | "JOB";
  mediaUrls: string[];
  market: string | null;
  state: string | null;
  city: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; role: string; city: string | null; state: string | null };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

interface CommentType {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; role: string };
}

const AVATAR_FALLBACK = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=ffffff&bold=true&format=png`;

const PRESS = "active:scale-95 transition-transform duration-100";

const POST_TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  SHOWCASE: { label: "✨ Khoe tay nghề", classes: "bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-300" },
  JOB: { label: "🔥 Tuyển thợ", classes: "bg-red-500/10 border-red-500/25 text-red-300" },
  GENERAL: { label: "", classes: "" },
};

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export default function FeedPostCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  const { user: currentUser } = useSessionUser();

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  const isOwnPost = currentUser?.id === post.author.id;
  const badge = POST_TYPE_BADGE[post.postType];

  const handleToggleLike = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để thả tim.");
      return;
    }
    if (likeBusy) return;
    // Optimistic — nhảy số ngay lập tức, đúng cảm giác "chuẩn Social".
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      // Hoàn tác nếu lỗi mạng — không để số like sai lệch với server.
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
      toast.error("Không thể thả tim. Vui lòng thử lại.");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/comments`);
        if (res.ok) setComments(await res.json());
        else setComments([]);
      } catch {
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleSendComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để bình luận.");
      return;
    }
    setSendingComment(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể gửi bình luận.");
        return;
      }
      setComments((prev) => [...(prev || []), data]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch {
      toast.error("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden animate-fadeIn">
      {/* HEADER */}
      <div className="flex items-start gap-3 p-4">
        <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
          <img
            src={post.author.avatarUrl || AVATAR_FALLBACK(post.author.name)}
            alt={post.author.name}
            loading="lazy"
            className="h-11 w-11 rounded-full object-cover border border-slate-800"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${post.author.id}`} className="text-sm font-bold text-slate-100 hover:text-pink-400 transition-colors truncate">
              {post.author.name}
            </Link>
            <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold text-slate-300 flex-shrink-0">
              {roleBadgeLabel(post.author.role)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
            {(post.city || post.state) && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {[post.city, post.state].filter(Boolean).join(", ")}
              </span>
            )}
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {badge?.label && (
          <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.classes}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* NỘI DUNG */}
      {post.content && (
        <p className="px-4 pb-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
          {renderContentWithHashtags(post.content)}
        </p>
      )}

      {/* MEDIA CAROUSEL — vuốt ngang 1 ngón tay, scroll-snap gốc trình duyệt,
          không cần thư viện carousel nặng nề. */}
      {post.mediaUrls.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory px-4 pb-3 custom-scrollbar">
          {post.mediaUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative flex-shrink-0 snap-center w-[85%] sm:w-[60%] aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-950"
            >
              {isVideo(url) ? (
                <>
                  <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <Play className="absolute inset-0 m-auto h-10 w-10 text-white drop-shadow-lg" />
                </>
              ) : (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
              {post.mediaUrls.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                  {idx + 1}/{post.mediaUrls.length}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FOOTER TƯƠNG TÁC */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-slate-850">
        <button
          type="button"
          onClick={handleToggleLike}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${PRESS} ${
            liked ? "text-pink-400" : "text-slate-400 hover:text-pink-300"
          }`}
        >
          <Heart className={`h-4.5 w-4.5 ${liked ? "fill-pink-500 text-pink-500" : ""}`} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-blue-300 transition-colors ${PRESS}`}
        >
          <MessageCircle className="h-4.5 w-4.5" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        {!isOwnPost && (
          <button
            type="button"
            onClick={() => router.push(`/messages?to=${post.author.id}`)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-emerald-300 transition-colors ${PRESS}`}
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        )}

        <Link
          href={`/profile/${post.author.id}`}
          className={`ml-auto flex items-center gap-1 rounded-xl border border-pink-500/30 bg-pink-500/5 px-3 py-2 text-[11px] font-bold text-pink-300 hover:bg-pink-500/15 transition-colors ${PRESS}`}
        >
          {post.author.role === "OWNER" ? "Xem Tiệm" : "Xem Tay Nghề"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* BÌNH LUẬN */}
      {showComments && (
        <div className="border-t border-slate-850 bg-slate-950/40 p-4 space-y-3 animate-fadeIn">
          {loadingComments ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 text-pink-500 animate-spin" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <img
                    src={c.author.avatarUrl || AVATAR_FALLBACK(c.author.name)}
                    alt={c.author.name}
                    loading="lazy"
                    className="h-7 w-7 rounded-full object-cover border border-slate-800 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-900/60 border border-slate-850 px-3 py-2">
                    <p className="text-xs font-bold text-slate-200">{c.author.name}</p>
                    <p className="text-xs text-slate-300 leading-relaxed break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-2">Chưa có bình luận nào — hãy là người đầu tiên!</p>
          )}

          {currentUser && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
                placeholder="Viết bình luận..."
                disabled={sendingComment}
                className="flex-1 min-h-[40px] rounded-full border border-slate-800 bg-slate-900 px-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handleSendComment}
                disabled={!commentText.trim() || sendingComment}
                className={`flex-shrink-0 h-10 w-10 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center disabled:opacity-40 transition-all ${PRESS}`}
              >
                {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
