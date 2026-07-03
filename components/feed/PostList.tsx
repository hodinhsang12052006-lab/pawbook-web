"use client";

import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export interface PostType {
  id: string;
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role: string;
    bio?: string | null;
  };
  likes?: number;
  commentsCount?: number;
  hasLiked?: boolean;
}

interface PostListProps {
  posts?: PostType[];
  onLikePost?: (id: string) => void;
  refreshTrigger?: number;
  authorId?: string;
}

export default function PostList({ posts: propPosts, onLikePost, refreshTrigger = 0, authorId }: PostListProps) {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likesState, setLikesState] = useState<Record<string, { count: number; active: boolean }>>({});

  // Comments state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");

  const isSelfManaged = !propPosts;

  useEffect(() => {
    if (!isSelfManaged) return;

    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/posts");
        if (!res.ok) {
          throw new Error("Không thể tải danh sách bài viết.");
        }
        let data = await res.json();

        if (authorId) {
          data = data.filter((post: PostType) => post.author?.id === authorId);
        }

        setPosts(data);

        // Initialize likes state locally for demo purposes
        const initialLikes: Record<string, { count: number; active: boolean }> = {};
        data.forEach((post: any) => {
          initialLikes[post.id] = {
            count: Math.floor(Math.random() * 50) + 10,
            active: Math.random() > 0.7,
          };
        });
        setLikesState(initialLikes);
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [refreshTrigger, isSelfManaged, authorId]);

  const handleLike = (postId: string) => {
    if (onLikePost) {
      onLikePost(postId);
      return;
    }

    setLikesState((prev) => {
      const current = prev[postId] || { count: 0, active: false };
      return {
        ...prev,
        [postId]: {
          count: current.active ? current.count - 1 : current.count + 1,
          active: !current.active,
        },
      };
    });
  };

  const toggleComments = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    setNewCommentText("");

    try {
      setLoadingComments(true);
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setPostComments((prev) => ({ ...prev, [postId]: data }));
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newCommentText }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể gửi bình luận.");
      } else {
        setPostComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data],
        }));
        setNewCommentText("");
        toast.success("Đã đăng bình luận!");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString; // Fallback to raw string if it's mock date text like "2 ngày trước"
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;

      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const activePosts = isSelfManaged ? posts : propPosts;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/10">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-xs text-slate-400">Đang tải bảng tin...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!activePosts || activePosts.length === 0) {
    return (
      <div className="text-center py-12 border border-slate-850 rounded-2xl bg-slate-900/10">
        <p className="text-xs text-slate-500">Chưa có bài đăng nào trên hệ thống.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activePosts.map((post) => {
        // Resolve likes count
        const displayLikes = isSelfManaged
          ? (likesState[post.id] || { count: 0 }).count
          : (post.likes || 0);

        const hasLiked = isSelfManaged
          ? (likesState[post.id] || { active: false }).active
          : !!post.hasLiked;

        const commentsCount = isSelfManaged
          ? (postComments[post.id] || []).length || Math.floor(displayLikes / 3)
          : (post.commentsCount || 0);

        const authorAvatar = post.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name || "P")}&background=2563eb&color=ffffff&bold=true`;
        return (
          <article
            key={post.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-md transition-all duration-300 hover:border-slate-700/60"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
                  <img
                    src={authorAvatar}
                    alt={post.author?.name || "Author"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{post.author?.name || "Thành viên PawBook"}</h3>
                    {post.author?.role && (
                      <span className="inline-flex items-center rounded-md bg-slate-800 px-1.5 py-0.5 text-3xs font-medium text-slate-400 border border-slate-750">
                        {post.author.role}
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-slate-450 leading-relaxed">{post.author?.bio || "Thành viên mới gia nhập"}</p>
                  <p className="mt-1 text-3xs text-slate-500">{formatTime(post.createdAt)}</p>
                </div>
              </div>
              <button className="rounded-full p-1 text-slate-500 hover:bg-slate-850 hover:text-slate-355 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-4">
              <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{post.content}</p>
              {post.mediaUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40">
                  {post.mediaType === "video" ? (
                    <video
                      src={post.mediaUrl}
                      controls
                      className="max-h-[350px] w-full object-cover"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt="Attached media"
                      className="max-h-[350px] w-full object-cover"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-850/60 pt-3">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  hasLiked
                    ? "text-rose-500 hover:text-rose-450"
                    : "text-slate-400 hover:text-rose-400"
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                <span>{displayLikes}</span>
              </button>

              <button
                onClick={() => toggleComments(post.id)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  activeCommentsPostId === post.id ? "text-blue-400" : "text-slate-400 hover:text-blue-400"
                }`}
              >
                <MessageCircle className="h-4.5 w-4.5" />
                <span>{commentsCount}</span>
              </button>

              <button className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-green-400 transition-colors">
                <Share2 className="h-4.5 w-4.5" />
                <span>Chia sẻ</span>
              </button>

              <button className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-yellow-400 transition-colors ml-auto">
                <Bookmark className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Comments Drawer */}
            {activeCommentsPostId === post.id && (
              <div className="mt-4 border-t border-slate-850/60 pt-3 space-y-3">
                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {(postComments[post.id] || []).length === 0 ? (
                        <p className="text-3xs text-slate-500 text-center py-3">Chưa có bình luận nào. Hãy để lại ý kiến của bạn!</p>
                      ) : (
                        (postComments[post.id] || []).map((comment) => {
                          const cAvatar = comment.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.name || "C")}&background=2563eb&color=ffffff&bold=true`;
                          return (
                            <div
                              key={comment.id}
                              className="flex gap-2 text-xs items-start bg-slate-950/20 p-2.5 rounded-xl border border-slate-900"
                            >
                              <div className="h-6 w-6 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
                                <img
                                  src={cAvatar}
                                  alt={comment.author?.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-200">{comment.author?.name}</span>
                                  {comment.author?.role && (
                                    <span className="inline-flex items-center rounded-md bg-slate-850 px-1 py-0.2 text-4xs font-medium text-slate-450">
                                      {comment.author.role}
                                    </span>
                                  )}
                                  <span className="text-4xs text-slate-500 ml-auto">{formatTime(comment.createdAt)}</span>
                                </div>
                                <p className="text-slate-300 leading-relaxed break-words">{comment.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* New comment form */}
                    <form
                      onSubmit={(e) => handleAddComment(e, post.id)}
                      className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-900"
                    >
                      <input
                        type="text"
                        placeholder="Viết bình luận dạo hoặc chia sẻ cảm nghĩ..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={!newCommentText.trim()}
                        className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-2xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-all"
                      >
                        Gửi
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
