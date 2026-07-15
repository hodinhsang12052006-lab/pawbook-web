"use client";

import React, { useState, useEffect } from "react";
import { Star, MessageSquare, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";

interface Reviewer {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  comment?: string | null;
  createdAt: string;
  reviewer: Reviewer;
}

interface ReviewSectionProps {
  jobId: string;
  employerId: string;
}

export default function ReviewSection({ jobId, employerId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Load session
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSession();
  }, []);

  // Fetch reviews list
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?jobId=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [jobId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || submitting) return;

    if (!sessionUser) {
      toast.error("Vui lòng đăng nhập để gửi đánh giá.");
      return;
    }

    if (sessionUser.id === employerId) {
      toast.error("Bạn không thể tự đánh giá dịch vụ của chính mình.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Đang gửi đánh giá dịch vụ...");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Cảm ơn bạn đã gửi đánh giá dịch vụ! ⭐", { id: toastId });
        setComment("");
        setRating(5);
        // Refresh list
        fetchReviews();
      } else {
        toast.error(data.error || "Gửi đánh giá thất bại.", { id: toastId });
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-6 backdrop-blur-sm space-y-6">
      <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-blue-500" />
        <span>Đánh giá từ khách hàng ({reviews.length})</span>
      </h3>

      {/* Reviews List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Đang tải đánh giá...</span>
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Chưa có đánh giá nào cho dịch vụ này. Hãy là người đầu tiên đánh giá!</p>
        ) : (
          reviews.map((rev) => {
            const avatar = rev.reviewer.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.reviewer.name)}&background=2563eb&color=ffffff&bold=true`;
            return (
              <div key={rev.id} className="p-4 rounded-xl border border-slate-850 bg-slate-900/20 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-850">
                      <img src={avatar} alt={rev.reviewer.name} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{rev.reviewer.name}</h4>
                      <p className="text-[10px] text-slate-500">{formatDate(rev.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3 w-3 ${s <= rev.rating ? "text-amber-500 fill-amber-500" : "text-slate-700"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-300 pl-1">{rev.comment || rev.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Submit Form */}
      {sessionUser && sessionUser.id !== employerId ? (
        <form onSubmit={handleSubmitReview} className="border-t border-slate-850 pt-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-350">Gửi đánh giá của bạn</h4>
          
          {/* Star selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-slate-400 mr-2">Xếp hạng:</span>
            {[1, 2, 3, 4, 5].map((s) => {
              const active = hoverRating !== null ? s <= hoverRating : s <= rating;
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="transition-transform duration-100 hover:scale-125 cursor-pointer text-slate-700"
                >
                  <Star
                    className={`h-5 w-5 ${active ? "text-amber-500 fill-amber-500" : "text-slate-700"}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Comment box */}
          <div className="flex gap-2">
            <textarea
              rows={2}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nội dung đánh giá chất lượng dịch vụ của nhà cung cấp này..."
              className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={!comment.trim() || submitting}
              className="h-10 w-10 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-all cursor-pointer self-end"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      ) : sessionUser && sessionUser.id === employerId ? (
        <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-850 text-center text-2xs text-slate-500">
          Bạn là nhà tuyển dụng/chủ cung cấp dịch vụ này nên không thể đánh giá.
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-850 text-center text-2xs text-slate-500">
          Vui lòng đăng nhập để gửi đánh giá chất lượng dịch vụ.
        </div>
      )}
    </div>
  );
}
