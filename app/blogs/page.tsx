"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Sparkles, ThumbsUp, Plus, Loader2, ArrowUpRight, BadgeCheck, Star, X, BookOpen, Briefcase, Store } from "lucide-react";
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
  } | null;
  createdAt: string;
}

export default function BlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<BlogPostType[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Modal creation states
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkedJobId, setLinkedJobId] = useState("");
  const [linkedServiceId, setLinkedServiceId] = useState("");
  const [creating, setCreating] = useState(false);

  // Load Session User
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

  // Fetch blogs, jobs, and services
  const loadData = async () => {
    try {
      setLoading(true);
      
      const blogsRes = await fetch("/api/blogs");
      if (blogsRes.ok) {
        const blogsData = await blogsRes.json();
        setBlogs(blogsData);
      }

      const jobsRes = await fetch("/api/jobs");
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }

      const servicesRes = await fetch("/api/services");
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData);
      }

    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi tải danh sách bài viết.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpvote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/blogs/${id}/upvote`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Bình chọn thành công! Tác giả được tặng +5 PawCoin.");
        setBlogs((prev) =>
          prev.map((b) => (b.id === id ? { ...b, upvotes: data.upvotes } : b))
        );
      } else {
        toast.error(data.error || "Bình chọn thất bại.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  const handleCreateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          linkedJobId: linkedJobId || undefined,
          linkedServiceId: linkedServiceId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Đăng bài viết chia sẻ thành công!");
        setShowModal(false);
        setTitle("");
        setContent("");
        setLinkedJobId("");
        setLinkedServiceId("");
        
        // Prepend to local feed
        setBlogs((prev) => [data, ...prev]);
      } else {
        toast.error(data.error || "Không thể đăng bài viết.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Left Column: Sidebar (Dashboard Tabs) */}
          <div className="w-full md:w-64 flex-shrink-0">
            <Sidebar activeTab="blogs" />
          </div>

          {/* Right Column: Newsfeed list */}
          <div className="flex-1 space-y-6">
            
            {/* Header section with Write Blog Trigger */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                  Diễn đàn & Chia sẻ kinh nghiệm
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Đăng bài chia sẻ kiến thức, mẹo MMO/IT và tìm kiếm phễu khách hàng tiềm năng.
                </p>
              </div>

              {sessionUser && (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>Viết bài chia sẻ</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-xs text-slate-400">Đang tải diễn đàn bài viết...</p>
              </div>
            ) : blogs.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-slate-800 bg-slate-900/10">
                <p className="text-xs text-slate-500">Chưa có bài viết nào trên hệ thống diễn đàn.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {blogs.map((blog) => {
                  const authorAvatar = blog.author.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.author.name)}&background=2563eb&color=ffffff&bold=true`;
                  return (
                    <article
                      key={blog.id}
                      onClick={() => router.push(`/blogs/${blog.id}`)}
                      className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-md hover:border-slate-700/60 transition-all duration-200 cursor-pointer flex flex-col gap-4"
                    >
                      {/* Author header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
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
                            <span className="inline-block mt-0.5 rounded bg-slate-850 px-1 py-0.2 text-[9px] font-medium text-slate-400 border border-slate-800">
                              {blog.author.role}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleUpvote(blog.id, e)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-850 px-3 py-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <ThumbsUp className="h-4 w-4" />
                          <span>{blog.upvotes}</span>
                        </button>
                      </div>

                      {/* Content Summary */}
                      <div className="space-y-1">
                        <h2 className="text-sm sm:text-base font-bold text-slate-100 hover:underline">{blog.title}</h2>
                        <p className="text-xs text-slate-350 leading-relaxed line-clamp-3">{blog.content}</p>
                      </div>

                      {/* Linked CTA Card Preview */}
                      {(blog.linkedJob || blog.linkedService) && (
                        <div className="mt-1 p-3.5 rounded-xl border border-slate-850 bg-slate-950/40 flex items-center justify-between gap-3 text-3xs">
                          <div className="flex items-center gap-2">
                            {blog.linkedJob ? (
                              <>
                                <Briefcase className="h-4 w-4 text-blue-450" />
                                <div>
                                  <p className="font-bold text-slate-200">Liên kết việc làm: {blog.linkedJob.title}</p>
                                  <p className="text-slate-500 mt-0.5">{blog.linkedJob.companyName} • {blog.linkedJob.salary}</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <Store className="h-4 w-4 text-emerald-450" />
                                <div>
                                  <p className="font-bold text-slate-200">Liên kết dịch vụ: {blog.linkedService?.name}</p>
                                  <p className="text-slate-500 mt-0.5">Phân loại: {blog.linkedService?.category}</p>
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className="text-blue-400 flex items-center gap-0.5 font-semibold">
                            <span>Chi tiết CTA</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      )}

                    </article>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* CREATE BLOG DIALOG MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-100">Viết Bài Chia Sẻ / Blog Mới</h3>
              <p className="text-4xs text-slate-450 mt-1">Đăng bài viết hướng dẫn, chia sẻ ngách MMO, IT hoặc Spa địa phương.</p>
            </div>

            <form onSubmit={handleCreateBlog} className="space-y-4">
              <div>
                <label className="block text-4xs font-semibold text-slate-355">Tiêu đề bài viết</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Lộ trình cày thầu MMO bằng Python Automation từ số 0"
                  className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-semibold text-slate-355">Nội dung chi tiết</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Viết nội dung chia sẻ kinh nghiệm tại đây..."
                  rows={6}
                  className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none"
                />
              </div>

              {/* Funnel Linkings dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-semibold text-slate-355">Gắn phễu tới việc làm (CTA)</label>
                  <select
                    value={linkedJobId}
                    onChange={(e) => {
                      setLinkedJobId(e.target.value);
                      if (e.target.value) setLinkedServiceId(""); // Mutually exclusive
                    }}
                    className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-2 py-2 text-xs text-slate-250 focus:outline-none"
                  >
                    <option value="">Không gắn link</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.companyName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-4xs font-semibold text-slate-355">Gắn phễu tới dịch vụ (CTA)</label>
                  <select
                    value={linkedServiceId}
                    onChange={(e) => {
                      setLinkedServiceId(e.target.value);
                      if (e.target.value) setLinkedJobId(""); // Mutually exclusive
                    }}
                    className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-2 py-2 text-xs text-slate-250 focus:outline-none"
                  >
                    <option value="">Không gắn link</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({srv.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 py-2 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2 px-4 text-xs font-semibold text-white transition-all"
                >
                  {creating ? "Đang xử lý..." : "Đăng bài ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
