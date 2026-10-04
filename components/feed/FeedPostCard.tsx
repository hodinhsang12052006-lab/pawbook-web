"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Send, MapPin, Play, ArrowRight, Loader2, MoreHorizontal, Trash2, Flag } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { timeAgo, renderContentWithHashtags, roleBadgeLabel } from "@/lib/feedFormat";
import { trackPostView } from "@/lib/viewTracker";
import Avatar from "@/components/ui/Avatar";
import { playSound } from "@/lib/sounds";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

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
  recentLikers?: { id: string; name: string; avatarUrl: string | null }[];
  isHot?: boolean;
  views?: number;
}

// 1234 → "1,2K" (lượt xem thật).
const compactCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}K` : String(n);

interface CommentType {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; role: string };
}

const PRESS = "active:scale-95 transition-transform duration-100";

// Hàm (không phải hằng) để nhãn đổi theo VI/EN.
const POST_TYPE_BADGE = (): Record<string, { label: string; classes: string }> => ({
  SHOWCASE: { label: tr("✨ Khoe tay nghề", "✨ Showcase"), classes: "bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-300" },
  JOB: { label: tr("🔥 Tuyển thợ", "🔥 Hiring"), classes: "bg-red-500/10 border-red-500/25 text-red-300" },
  GENERAL: { label: "", classes: "" },
});

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

const REPORT_REASONS = () => [tr("Lừa đảo / spam", "Scam / spam"), tr("Nội dung phản cảm", "Offensive content"), tr("Thông tin tuyển dụng sai sự thật", "False job information"), tr("Quấy rối", "Harassment")];

// Dưới ngưỡng này thì ẩn "lượt xem" — số quá nhỏ nhìn vắng, phản tác dụng.
const MIN_VIEWS_SHOWN = 5;

export default function FeedPostCard({ post, onDeleted }: { post: FeedPost; onDeleted?: (postId: string) => void }) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const { user: currentUser } = useSessionUser();

  // Ghi nhận lượt xem thật khi bài hiện trên màn hình đủ lâu.
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => trackPostView(articleRef.current, post.id), [post.id]);

  const [liked, setLiked] = useState(post.likedByMe);
  const [likers, setLikers] = useState(post.recentLikers ?? []);
  // Hiệu ứng thả tim: tim nhỏ bay lên quanh nút + tim lớn giữa ảnh khi
  // double-tap. Chỉ phản hồi tương tác THẬT của người dùng.
  const [burstKey, setBurstKey] = useState(0);
  const [bigHeartKey, setBigHeartKey] = useState(0);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  const isOwnPost = currentUser?.id === post.author.id;
  const canDelete = isOwnPost || currentUser?.role === "ADMIN";
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(tr("Xóa bài viết này? Hành động không thể hoàn tác.", "Delete this post? This can't be undone."))) return;
    setMenuBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Không thể xóa bài viết.", "Couldn't delete the post."));
      toast.success(tr("Đã xóa bài viết.", "Post deleted."));
      onDeleted?.(post.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Không thể xóa bài viết.", "Couldn't delete the post."));
    } finally {
      setMenuBusy(false);
      setMenuOpen(false);
    }
  };

  // Báo cáo bài viết → dùng chung bảng UserReport (gắn mã bài vào lý do để
  // admin truy được đúng bài trong /admin/reports).
  const handleReport = async (reason: string) => {
    if (!currentUser) {
      toast.error(tr("Vui lòng đăng nhập để báo cáo.", "Please sign in to report."));
      return;
    }
    setMenuBusy(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: post.author.id, reason: `[Bài viết ${post.id}] ${reason}` }),
      });
      if (!res.ok) throw new Error();
      toast.success(tr("Đã gửi báo cáo. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.", "Report sent. Thanks for keeping the community safe."));
    } catch {
      toast.error(tr("Không gửi được báo cáo, vui lòng thử lại.", "Couldn't send the report, please try again."));
    } finally {
      setMenuBusy(false);
      setMenuOpen(false);
      setReportOpen(false);
    }
  };
  const badge = POST_TYPE_BADGE()[post.postType];

  const handleToggleLike = async () => {
    if (!currentUser) {
      toast.error(tr("Vui lòng đăng nhập để thả tim.", "Please sign in to like."));
      return;
    }
    if (likeBusy) return;
    // Optimistic — nhảy số ngay lập tức, đúng cảm giác "chuẩn Social".
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    if (nextLiked) {
      playSound("like");
      setBurstKey((k) => k + 1);
      setLikers((prev) => [{ id: currentUser.id, name: tr("Bạn", "You"), avatarUrl: currentUser.avatarUrl ?? null }, ...prev.filter((l) => l.id !== currentUser.id)].slice(0, 3));
    } else {
      setLikers((prev) => prev.filter((l) => l.id !== currentUser.id));
    }
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
      toast.error(tr("Không thể thả tim. Vui lòng thử lại.", "Couldn't like the post. Please try again."));
    } finally {
      setLikeBusy(false);
    }
  };

  // Double-tap vào ảnh để thả tim (kiểu Instagram) — chỉ thả, không bỏ tim.
  const handleDoubleTapMedia = () => {
    setBigHeartKey((k) => k + 1);
    if (!liked) handleToggleLike();
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
      toast.error(tr("Vui lòng đăng nhập để bình luận.", "Please sign in to comment."));
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
        toast.error(data.error || tr("Không thể gửi bình luận.", "Couldn't post the comment."));
        return;
      }
      setComments((prev) => [...(prev || []), data]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch {
      toast.error(tr("Lỗi mạng. Vui lòng thử lại.", "Network error. Please try again."));
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <article ref={articleRef} className="glass-card rounded-2xl overflow-hidden animate-fadeIn">
      {/* HEADER */}
      <div className="flex items-start gap-3 p-4">
        <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
          <Avatar src={post.author.avatarUrl} name={post.author.name} seed={post.author.id} className="h-11 w-11 ring-1 ring-white/10" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${post.author.id}`} className="text-sm font-bold text-slate-100 hover:text-pink-400 transition-colors truncate">
              {post.author.name}
            </Link>
            {isVerifiedRole(post.author.role) && <VerifiedBadge className="-ml-1 h-4 w-4" />}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${isVerifiedRole(post.author.role) ? "bg-sky-500/15 text-sky-300" : "bg-slate-800/80 text-slate-300"}`}>
              {isVerifiedRole(post.author.role) ? tr("Chính thức", "Official") : roleBadgeLabel(post.author.role)}
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
            {post.isHot && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-1.5 py-px text-[10px] font-bold text-orange-300">
                {tr("🔥 Đang hot", "🔥 Trending")}
              </span>
            )}
          </div>
        </div>
        {badge?.label && (
          <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.classes}`}>
            {badge.label}
          </span>
        )}
        {currentUser && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => { setMenuOpen((o) => !o); setReportOpen(false); }}
              aria-label={tr("Tùy chọn bài viết", "Post options")}
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-colors"
            >
              {menuBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </button>
            {menuOpen && (
              <>
                <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => { setMenuOpen(false); setReportOpen(false); }} />
                <div role="menu" className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 p-1 shadow-2xl shadow-black/50 backdrop-blur-md animate-scaleUp">
                  {canDelete && (
                    <button role="menuitem" type="button" onClick={handleDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />{tr(" Xóa bài viết", " Delete post")}
                    </button>
                  )}
                  {!isOwnPost && !reportOpen && (
                    <button role="menuitem" type="button" onClick={() => setReportOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/5">
                      <Flag className="h-4 w-4 text-amber-400" />{tr(" Báo cáo bài viết", " Report post")}
                    </button>
                  )}
                  {reportOpen && (
                    <div className="space-y-0.5">
                      <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{tr("Lý do báo cáo", "Reason for reporting")}</p>
                      {REPORT_REASONS().map((reason) => (
                        <button key={reason} role="menuitem" type="button" onClick={() => handleReport(reason)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/5">
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
        // 1 ảnh: full khung 4:3 · 2 ảnh: lưới 2 cột cân đối · ≥3 ảnh: vuốt
        // ngang. Trước đây mọi trường hợp đều là carousel 85%/60%, nên bài 1
        // ảnh bị lệch trái và bài 2 ảnh trông như ảnh thứ 2 bị cắt mất.
        <div className="relative" onDoubleClick={handleDoubleTapMedia}>
        <div
          className={
            post.mediaUrls.length === 1
              ? "px-4 pb-3"
              : post.mediaUrls.length === 2
              ? "grid grid-cols-2 gap-1.5 px-4 pb-3"
              : "flex gap-1.5 overflow-x-auto snap-x snap-mandatory px-4 pb-3 custom-scrollbar"
          }
        >
          {post.mediaUrls.map((url, idx) => (
            <div
              key={idx}
              className={`skeleton relative overflow-hidden rounded-2xl border border-slate-800 ${
                post.mediaUrls.length === 1
                  ? "w-full aspect-[4/3]"
                  : post.mediaUrls.length === 2
                  ? "aspect-[4/5]"
                  : "flex-shrink-0 snap-center w-[78%] sm:w-[46%] aspect-square"
              }`}
            >
              {isVideo(url) ? (
                <>
                  <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <Play className="absolute inset-0 m-auto h-10 w-10 text-white drop-shadow-lg" />
                </>
              ) : (
                // next/image thay vì <img> thô — ảnh feed là nội dung tốn băng
                // thông lưu lượng nhất trên trang chủ (cuộn qua hàng chục bài
                // mỗi phiên); fill+sizes cho phép Next.js tự sinh srcset đúng
                // độ phân giải hiển thị thay vì luôn tải nguyên bản 800-900px.
                <Image
                  src={url}
                  alt=""
                  fill
                  loading="lazy"
                  sizes={post.mediaUrls.length === 1 ? "(max-width: 640px) 100vw, 640px" : "(max-width: 640px) 80vw, 320px"}
                  className="object-cover"
                />
              )}
              {post.mediaUrls.length > 2 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                  {idx + 1}/{post.mediaUrls.length}
                </span>
              )}
            </div>
          ))}
        </div>
          {bigHeartKey > 0 && (
            <Heart
              key={bigHeartKey}
              aria-hidden
              className="heart-big pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 fill-pink-500 text-pink-500 drop-shadow-[0_6px_24px_rgba(236,72,153,0.6)]"
            />
          )}
        </div>
      )}

      {/* NGƯỜI THẬT ĐÃ THÍCH + LƯỢT XEM THẬT — bằng chứng xã hội từ dữ liệu thật */}
      {((likeCount > 0 && likers.length > 0) || (post.views ?? 0) >= MIN_VIEWS_SHOWN) && (
        <div className="flex items-center gap-2 px-4 pb-2 text-[11px] text-slate-400">
          {likeCount > 0 && likers.length > 0 && (<>
          <div className="flex -space-x-2">
            {likers.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <Avatar key={l.id} src={l.avatarUrl} name={l.name} seed={l.id} alt="" className="h-5 w-5 ring-2 ring-slate-900" />
            ))}
          </div>
          <span className="truncate">
            <span className="font-semibold text-slate-200">{likers.map((l) => l.name).slice(0, 2).join(", ")}</span>
            {likeCount > Math.min(2, likers.length) ? tr(` và ${likeCount - Math.min(2, likers.length)} người khác`, ` and ${likeCount - Math.min(2, likers.length)} others`) : ""}{tr(" đã thích", " liked this")}
          </span>
          </>)}
          {(post.views ?? 0) >= MIN_VIEWS_SHOWN && (
            <span className="ml-auto flex-shrink-0 text-slate-500" title={tr("Lượt xem thật (mỗi người tính 1 lần/ngày)", "Real views (each person counted once a day)")}>
              👁 {compactCount(post.views!)}{tr(" lượt xem", " views")}
            </span>
          )}
        </div>
      )}

      {/* FOOTER TƯƠNG TÁC */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-slate-850">
        <button
          type="button"
          onClick={handleToggleLike}
          aria-label={liked ? tr("Bỏ thích", "Unlike") : tr("Thích", "Like")}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${PRESS} ${
            liked ? "text-pink-400" : "text-slate-400 hover:text-pink-300"
          }`}
        >
          <span className="relative inline-flex">
            <Heart key={`h-${burstKey}`} className={`h-4.5 w-4.5 ${liked ? "fill-pink-500 text-pink-500" : ""} ${burstKey > 0 && liked ? "heart-pop" : ""}`} />
            {burstKey > 0 && liked && (
              <span key={`b-${burstKey}`} aria-hidden className="pointer-events-none absolute inset-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="heart-float absolute left-1/2 top-0 text-[10px]" style={{ ["--dx" as string]: `${(i - 2) * 9}px`, animationDelay: `${i * 40}ms` }}>
                    {i % 2 ? "💖" : "❤️"}
                  </span>
                ))}
              </span>
            )}
          </span>
          {likeCount > 0 && <span key={`c-${likeCount}`} className="count-bump">{likeCount}</span>}
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          aria-label={tr("Bình luận", "Comment")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-blue-300 transition-colors ${PRESS}`}
        >
          <MessageCircle className="h-4.5 w-4.5" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        {!isOwnPost && (
          <button
            type="button"
            onClick={() => router.push(`/messages?to=${post.author.id}`)}
            aria-label={tr("Nhắn tin cho tác giả", "Message the author")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-emerald-300 transition-colors ${PRESS}`}
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        )}

        <Link
          href={`/profile/${post.author.id}`}
          className={`ml-auto flex items-center gap-1 rounded-xl border border-pink-500/30 bg-pink-500/5 px-3 py-2 text-[11px] font-bold text-pink-300 hover:bg-pink-500/15 transition-colors ${PRESS}`}
        >
          {post.author.role === "OWNER" ? tr("Xem Tiệm", "View salon") : tr("Xem Tay Nghề", "View work")}
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
                  <Avatar src={c.author.avatarUrl} name={c.author.name} seed={c.author.id} className="h-7 w-7 ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-900/60 border border-slate-850 px-3 py-2">
                    <p className="flex items-center gap-1 text-xs font-bold text-slate-200">{c.author.name}{isVerifiedRole(c.author.role) && <VerifiedBadge className="h-3.5 w-3.5" />}</p>
                    <p className="text-xs text-slate-300 leading-relaxed break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-2">{tr("Chưa có bình luận nào — hãy là người đầu tiên!", "No comments yet — be the first!")}</p>
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
                placeholder={tr("Viết bình luận...", "Write a comment...")}
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
