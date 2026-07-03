"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { ArrowLeft, Sparkles, ThumbsUp, Calendar, Loader2, AlertCircle, BadgeCheck, Star, Briefcase, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

interface AuthorType {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  isVerified: boolean;
  trustScore: number;
}

interface BlogPostType {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author: AuthorType;
  upvotes: number;
  linkedJobId?: string | null;
  linkedJob?: {
    id: string;
    title: string;
    companyName: string;
    salary: string;
  } | null;
  linkedServiceId?: string | null;
  linkedService?: {
    id: string;
    name: string;
    category: string;
    contactInfo: string;
  } | null;
  createdAt: string;
}

export default function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [blogId, setBlogId] = useState<string | null>(null);
  const [blog, setBlog] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve params promise
  useEffect(() => {
    params.then((p) => setBlogId(p.id));
  }, [params]);

  useEffect(() => {
    if (!blogId) return;

    async function fetchBlogDetail() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/blogs");
        if (res.ok) {
          const list = await res.json();
          const found = list.find((b: any) => b.id === blogId);
          if (found) {
            setBlog(found);
          } else {
            setError("Bài viết không tồn tại hoặc đã bị xóa.");
          }
        } else {
          setError("Không thể tải chi tiết bài viết.");
        }
      } catch (err) {
        setError("Lỗi kết nối mạng.");
      } finally {
        setLoading(false);
      }
    }

    fetchBlogDetail();
  }, [blogId]);

  const handleUpvote = async () => {
    if (!blog) return;
    try {
      const res = await fetch(`/api/blogs/${blog.id}/upvote`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Bình chọn thành công! Tác giả được tặng +5 PawCoin.");
        setBlog((prev: any) => (prev ? { ...prev, upvotes: data.upvotes } : null));
      } else {
        toast.error(data.error || "Bình chọn thất bại.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang mở bài viết chia sẻ...</p>
        </main>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-12 space-y-4">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại diễn đàn</span>
          </Link>
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || "Lỗi tải bài viết."}</span>
          </div>
        </main>
      </div>
    );
  }

  const authorAvatar = blog.author.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.author.name)}&background=2563eb&color=ffffff&bold=true`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Back navigation */}
        <Link
          href="/blogs"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại diễn đàn</span>
        </Link>

        {/* Detailed Article layout */}
        <article className="rounded-2xl border border-slate-800 bg-slate-900/15 p-6 sm:p-8 backdrop-blur-md space-y-6">
          
          {/* Article Header details */}
          <div className="border-b border-slate-850 pb-5 space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
              {blog.title}
            </h1>

            {/* Author meta and date */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                  <img src={authorAvatar} alt={blog.author.name} className="h-full w-full object-cover" />
                </div>
                <div className="text-3xs">
                  <p className="font-bold text-slate-200 flex items-center gap-1">
                    <span>{blog.author.name}</span>
                    {blog.author.isVerified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10" />
                    )}
                    <span className="flex items-center gap-0.5 text-amber-450 ml-1 font-normal">
                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      {blog.author.trustScore?.toFixed(1) || "5.0"}
                    </span>
                  </p>
                  <p className="text-slate-500 mt-0.5">Tác giả bài đăng • {blog.author.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-4xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(blog.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>
          </div>

          {/* Article main text content */}
          <div className="text-xs sm:text-sm leading-relaxed text-slate-250 whitespace-pre-wrap">
            {blog.content}
          </div>

          {/* Upvoting feedback actions */}
          <div className="border-t border-slate-850 pt-5 flex items-center justify-between">
            <p className="text-4xs text-slate-500">
              Bài viết hữu ích? Hãy bình chọn để giúp cộng đồng IT & MMO cùng phát triển.
            </p>

            <button
              onClick={handleUpvote}
              className="flex items-center gap-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 transition-all duration-300"
            >
              <ThumbsUp className="h-4.5 w-4.5" />
              <span>Bình chọn ({blog.upvotes})</span>
            </button>
          </div>

          {/* DYNAMIC CONVERSION FUNNEL CTA CARDS */}
          {blog.linkedJob && (
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 p-6 backdrop-blur-md space-y-4 shadow-lg shadow-blue-500/5 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Briefcase className="h-5 w-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-4xs font-bold text-blue-450 uppercase border border-blue-500/20">
                    Cơ hội nghề nghiệp liên kết
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">{blog.linkedJob.title}</h4>
                  <p className="text-3xs text-slate-450 leading-relaxed">
                    Được đăng bởi <span className="font-semibold text-slate-300">{blog.linkedJob.companyName}</span> • Mức lương: <span className="text-emerald-450 font-bold">{blog.linkedJob.salary}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/jobs/${blog.linkedJobId}`)}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 text-2xs transition-all duration-200"
              >
                Nộp đơn ứng tuyển / Xem chi tiết công việc
              </button>
            </div>
          )}

          {blog.linkedService && (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 p-6 backdrop-blur-md space-y-4 shadow-lg shadow-emerald-500/5 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Store className="h-5 w-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-4xs font-bold text-emerald-455 uppercase border border-emerald-500/20">
                    Đặt lịch dịch vụ uy tín
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">{blog.linkedService.name}</h4>
                  <p className="text-3xs text-slate-455 leading-relaxed">
                    Phân loại: <span className="font-semibold text-slate-300">{blog.linkedService.category}</span> • Điện thoại: <span className="text-emerald-400 font-bold">{blog.linkedService.contactInfo}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/services/${blog.linkedServiceId}`)}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 text-2xs transition-all duration-200"
              >
                Đặt lịch dịch vụ / Xem gian hàng ngay
              </button>
            </div>
          )}

        </article>
      </main>

      <Toaster />
    </div>
  );
}
