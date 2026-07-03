"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import CVManager from "@/components/profile/CVManager";
import PostList, { PostType } from "@/components/feed/PostList";
import { 
  ArrowLeft, Edit3, MapPin, Link2, Calendar, Briefcase, 
  Award, Sparkles, ShieldCheck, BadgeCheck, Star, Mail, 
  Phone, FileText, X, Save, Loader2, DollarSign, Clock 
} from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface JobType {
  id: string;
  title: string;
  companyName: string;
  salary: string;
  niche: string;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>({
    name: "Nguyễn Văn A",
    role: "EMPLOYER",
    bio: "Senior Fullstack Developer | Blockchain & MMO Automation Architect. Đam mê xây dựng các hệ thống tự động hoá và tối ưu hóa trải nghiệm người dùng.",
    skills: "React / Next.js, TypeScript, Node.js, Prisma, Docker, Automation, Growth Hacking",
    location: "Hà Nội, Việt Nam",
    website: "https://github.com/nguyenvana",
    joinDate: "Tháng 6, 2026",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    cover_image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
    phone: "",
    address: "",
    cv_url: "",
    pawCoin: 150,
    reputation: 10,
    trustScore: 5.0,
    isVerified: false,
    jobs: [],
  });

  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    phone: "",
    address: "",
    cover_image: "",
    cv_url: "",
    skills: "",
  });

  const [walletHistory, setWalletHistory] = useState<any[]>([]);

  // Load user profile details on mount
  async function loadUserProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile((prev: any) => ({
          ...prev,
          ...data,
        }));
        setEditForm({
          name: data.name || "",
          bio: data.bio || "",
          phone: data.phone || "",
          address: data.address || "",
          cover_image: data.cover_image || "",
          cv_url: data.cv_url || "",
          skills: data.skills || "",
        });
      }
    } catch (err) {
      console.error("Lỗi tải profile:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Load wallet transaction logs
  useEffect(() => {
    async function loadWalletHistory() {
      try {
        const res = await fetch("/api/wallet/history");
        if (res.ok) {
          const data = await res.json();
          setWalletHistory(data);
        }
      } catch (err) {
        console.error("Failed to load wallet transaction logs in ProfilePage:", err);
      }
    }
    loadWalletHistory();
  }, []);

  // User's own posts (Static mockup feed data)
  const [myPosts, setMyPosts] = useState<PostType[]>([
    {
      id: "post-1",
      content: "Hôm nay chính thức khởi động dự án 'PawBook' - mạng xã hội dành cho dân dev & MMO. Anh em nào muốn join team chia sẻ kinh nghiệm fomo, build tool automation hoặc tìm job freelance xịn thì chuẩn bị tinh thần nhé! 🚀🚀 #pawbook #mmo #startup",
      mediaUrl: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80",
      mediaType: "image",
      createdAt: "2 ngày trước",
      author: {
        id: "user-1",
        name: "Nguyễn Văn A",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
        role: "Employer",
        bio: "Senior Fullstack Developer | PawBook Builder",
      },
      likes: 142,
      commentsCount: 38,
      hasLiked: true,
    },
    {
      id: "post-2",
      content: "Sau bao ngày cày cuốc thì UI/UX của PawBook cũng đã hoàn thiện cơ bản. Next.js App Router mượt mà, cấu hình Tailwind v4 cực sướng. Anh em cho mình xin ý kiến đóng góp về tính năng đăng tuyển dụng IT và kết nối MMO nhé! 💻🔥",
      createdAt: "5 ngày trước",
      author: {
        id: "user-1",
        name: "Nguyễn Văn A",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
        role: "Employer",
        bio: "Senior Fullstack Developer | PawBook Builder",
      },
      likes: 95,
      commentsCount: 14,
      hasLiked: false,
    }
  ]);

  const handleLikePost = (postId: string) => {
    setMyPosts(
      myPosts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            likes: post.hasLiked ? (post.likes || 0) - 1 : (post.likes || 0) + 1,
            hasLiked: !post.hasLiked,
          };
        }
        return post;
      })
    );
  };

  // AI CV parsing file handler
  const handleCvUploadAndParse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Vui lòng tải lên tệp tin định dạng PDF.");
      return;
    }

    const toastId = toast.loading("AI đang phân tích tệp tin CV và bóc tách kỹ năng...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cv-parser", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        if (data.skills) {
          toast.success("AI đã bóc tách kỹ năng thành công! ✨", { id: toastId });
          const existingSkills = editForm.skills
            ? editForm.skills.split(/[,\s]+/).map(s => s.trim())
            : [];
          const newSkills = data.skills
            .split(/[,\s]+/)
            .map((s: string) => s.trim());
          
          const combined = Array.from(new Set([...existingSkills, ...newSkills]))
            .filter(s => s.length > 0)
            .join(", ");
          
          setEditForm(prev => ({
            ...prev,
            skills: combined
          }));
        } else {
          toast.error("Không phát hiện từ khóa kỹ năng phù hợp nào trong CV.", { id: toastId });
        }
      } else {
        toast.error(data.error || "Lỗi bóc tách CV.", { id: toastId });
      }
    } catch (err) {
      toast.error("Lỗi kết nối quét CV.", { id: toastId });
    }
  };

  // Submit profile changes PUT request
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Cập nhật thông tin hồ sơ thành công! ✨");
        setProfile((prev: any) => ({
          ...prev,
          ...data.user,
        }));
        setIsEditModalOpen(false);
      } else {
        toast.error(data.error || "Cập nhật thất bại.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối lưu hồ sơ.");
    }
  };

  // Split skill keywords helper
  const skillsArray: string[] = profile.skills
    ? (typeof profile.skills === "string" ? profile.skills.split(/[,\s]+/) : profile.skills).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    : [];

  const defaultCover = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Global Navbar */}
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Bảng tin</span>
          </Link>
        </div>

        {/* Profile Card Header Section */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 overflow-hidden backdrop-blur-md">
          {/* Cover Photo */}
          <div className="relative h-48 sm:h-64 w-full bg-slate-900">
            <img
              src={profile.cover_image || defaultCover}
              alt="Cover background"
              className="h-full w-full object-cover opacity-80"
            />
          </div>

          {/* Profile Details Container */}
          <div className="relative px-6 pb-6">
            {/* Avatar positioning (half offset top) */}
            <div className="absolute top-0 left-6 -translate-y-1/2">
              <div className="relative h-24 w-24 sm:h-32 sm:w-32 overflow-hidden rounded-2xl border-4 border-slate-950 bg-slate-900 shadow-2xl">
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Top row actions (edit profile button aligned right) */}
            <div className="flex justify-end pt-4 h-12 sm:h-16">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-2 text-2xs font-semibold text-slate-200 transition-all cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Chỉnh sửa trang cá nhân
              </button>
            </div>

            {/* User Main Metadata */}
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-1.5">
                    <span>{profile.name}</span>
                    {profile.isVerified && (
                      <BadgeCheck className="h-5 w-5 text-blue-500 fill-blue-500/20" />
                    )}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                    {profile.role}
                  </span>
                </div>
                <p className="text-sm text-blue-400 mt-1 font-medium">Hồ sơ thành viên PawBook</p>
                
                {/* Gamification stats */}
                <div className="flex flex-wrap gap-2.5 mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-2xs font-semibold text-amber-400 border border-amber-500/20">
                    <Sparkles className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                    <span id="user-pawcoin-balance">{profile.pawCoin || 0} PawCoins</span>
                  </span>

                  {/* Daily Reward Claim Button */}
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/wallet/daily-reward", { method: "POST" });
                        const data = await res.json();
                        if (res.ok) {
                          toast.success(data.message);
                          setProfile((prev: any) => ({ ...prev, pawCoin: data.newBalance }));
                          const txRes = await fetch("/api/wallet/history");
                          if (txRes.ok) {
                            const txData = await txRes.json();
                            setWalletHistory(txData);
                          }
                        } else {
                          toast.error(data.error || "Điểm danh thất bại.");
                        }
                      } catch (err) {
                        toast.error("Lỗi kết nối mạng.");
                      }
                    }}
                    id="btn-daily-reward"
                    className="inline-flex items-center gap-1 px-3 py-0.5 text-2xs font-bold rounded-full bg-gradient-to-r from-amber-600 to-yellow-600 border border-amber-500 hover:from-amber-550 hover:to-yellow-550 text-white shadow-md shadow-amber-500/10 cursor-pointer"
                  >
                    🎁 Điểm danh nhận quà (+20)
                  </button>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-2xs font-semibold text-purple-400 border border-purple-500/20">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                    <span>Uy tín: {profile.reputation || 0} XP</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-semibold text-emerald-400 border border-emerald-500/20">
                    <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    <span>Tín nhiệm: {profile.trustScore?.toFixed(1) || "5.0"} / 5.0</span>
                  </span>
                </div>
              </div>

              {/* Bio description */}
              <p className="text-xs sm:text-sm text-slate-350 leading-relaxed max-w-3xl whitespace-pre-line">
                {profile.bio || "Thành viên này chưa điền tiểu sử giới thiệu."}
              </p>

              {/* Extra details (Location, website, Calendar join date, phone & address) */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-slate-850/60 text-xs text-slate-450">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {profile.address || profile.location || "Chưa cập nhật địa chỉ"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-slate-500" />
                  {profile.phone || "Chưa cập nhật SĐT"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-slate-500" />
                  <a
                    href={profile.website || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-blue-400 hover:underline transition-colors"
                  >
                    {profile.website ? profile.website.replace("https://", "") : "github.com/nguyenvana"}
                  </a>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Đã gia nhập {profile.joinDate || "Tháng 6, 2026"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Grid content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Left Area: CV Manager & Skills Info (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-6">
            {/* CV Manager Component */}
            <CVManager />

            {/* Skills Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-indigo-400" />
                Kỹ Năng & Lĩnh Vực
              </h3>
              <div className="flex flex-wrap gap-2">
                {skillsArray.length === 0 ? (
                  <span className="text-3xs text-slate-500 italic">Chưa nhập thông tin kỹ năng.</span>
                ) : (
                  skillsArray.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 border border-indigo-500/15 font-medium"
                    >
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Dịch vụ & Tin tuyển dụng storefront card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-400" />
                <span>Việc làm/Dịch vụ đã đăng ({profile.jobs?.length || 0})</span>
              </h3>
              {(profile.jobs || []).length === 0 ? (
                <p className="text-3xs text-slate-500 italic">Chưa có bài đăng nào.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {profile.jobs.map((job: JobType) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block group rounded-xl border border-slate-850 bg-slate-950/40 p-3 hover:border-blue-500/35 transition-all text-xs"
                    >
                      <h4 className="font-bold text-slate-200 group-hover:text-blue-450 transition-colors truncate">
                        {job.title}
                      </h4>
                      <div className="flex justify-between items-center mt-2 text-3xs font-semibold text-slate-500">
                        <span className="text-emerald-550 font-bold">{job.salary}</span>
                        <span className="uppercase">{job.niche}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Stats Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Briefcase className="h-5 w-5 text-purple-400" />
                Thống kê hoạt động
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-850 text-center">
                  <span className="block text-2xl font-bold text-blue-500">34</span>
                  <span className="text-3xs text-slate-500 mt-1 block">Bài đã đăng</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-850 text-center">
                  <span className="block text-2xl font-bold text-indigo-500">1,248</span>
                  <span className="text-3xs text-slate-500 mt-1 block">Lượt xem Profile</span>
                </div>
              </div>
            </div>

            {/* Wallet History Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500/10" />
                Lịch sử ví PawCoin
              </h3>
              
              {walletHistory.length === 0 ? (
                <p className="text-center py-6 text-3xs text-slate-500">Chưa có giao dịch ví nào được thực hiện.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 divide-y divide-slate-850/40 text-xs">
                  {walletHistory.map((tx: any) => (
                    <div key={tx.id} className="pt-2 flex items-center justify-between text-3xs">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-200">{tx.description}</p>
                        <span className="text-slate-550 text-4xs">{new Date(tx.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                      <span className={`font-bold text-2xs ${tx.type === "INCOME" ? "text-emerald-450" : "text-rose-455"}`}>
                        {tx.type === "INCOME" ? "+" : ""}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Area: User's posts list (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">Bài viết của bạn</h2>
              <span className="text-xs text-slate-400 font-medium">Sắp xếp: Mới nhất</span>
            </div>

            <PostList posts={myPosts} onLikePost={handleLikePost} />
          </div>
        </div>
      </main>

      {/* Edit Profile Modal Dialog Overlay */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#090e1c] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="h-4.5 w-4.5 text-blue-500" />
                <span>Chỉnh sửa thông tin cá nhân</span>
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-bold text-slate-350 mb-1.5">Tên hiển thị</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block font-bold text-slate-350 mb-1.5">Giới thiệu tiểu sử</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Viết một đoạn ngắn giới thiệu bản thân hoặc cơ sở kinh doanh..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Phone & Address row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-350 mb-1.5">Số điện thoại</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Ví dụ: 0987654321"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-350 mb-1.5">Địa chỉ</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Cover image & CV link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-350 mb-1.5">URL Ảnh bìa (Cover Image)</label>
                  <input
                    type="text"
                    value={editForm.cover_image}
                    onChange={(e) => setEditForm({ ...editForm, cover_image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-350 mb-1.5">URL Tệp tin CV (PDF)</label>
                  <input
                    type="text"
                    value={editForm.cv_url}
                    onChange={(e) => setEditForm({ ...editForm, cv_url: e.target.value })}
                    placeholder="https://pawbook.vn/cv/..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-350">Kỹ năng (cách nhau bằng dấu phẩy)</label>
                  <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 font-bold text-[10px] hover:bg-emerald-500/20 transition-all cursor-pointer">
                    <FileText className="h-3.5 w-3.5" />
                    Quét kỹ năng bằng AI từ CV (PDF)
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleCvUploadAndParse}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="nextjs, react, massage, sua-xe-may"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Submit action */}
              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-2xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-2xs font-semibold text-white hover:bg-blue-500 transition-all cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
      <Toaster />
    </div>
  );
}
