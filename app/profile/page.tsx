"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import CVManager from "@/components/profile/CVManager";
import PostList, { PostType } from "@/components/feed/PostList";
import { ArrowLeft, Edit3, MapPin, Link2, Calendar, Briefcase, Award, Eye, ThumbsUp, Sparkles, ShieldCheck, BadgeCheck, Star } from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>({
    name: "Nguyễn Văn A",
    role: "EMPLOYER",
    bio: "Senior Fullstack Developer | Blockchain & MMO Automation Architect. Đam mê xây dựng các hệ thống tự động hoá và tối ưu hóa trải nghiệm người dùng.",
    skills: ["React / Next.js", "TypeScript", "Node.js", "Prisma / Postgres", "Docker & DevOps", "Automation (Puppeteer/Python)", "Growth Hacking"],
    location: "Hà Nội, Việt Nam",
    website: "https://github.com/nguyenvana",
    joinDate: "Tháng 6, 2026",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
    pawCoin: 150,
    reputation: 10,
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile((prev: any) => ({
            ...prev,
            ...data,
            skills: data.skills
              ? data.skills.split(",").map((s: string) => s.trim())
              : prev.skills,
          }));
        }
      } catch (err) {
        console.error("Failed to load user profile details:", err);
      }
    }
    loadUserProfile();
  }, []);

  const [walletHistory, setWalletHistory] = useState<any[]>([]);

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

  // User's own posts
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
              src={profile.coverUrl}
              alt="Cover background"
              className="h-full w-full object-cover opacity-80"
            />
            <button className="absolute right-4 bottom-4 flex items-center gap-2 rounded-xl bg-slate-950/80 backdrop-blur px-3 py-1.5 text-2xs font-semibold text-slate-200 border border-slate-850 hover:bg-slate-900 transition-all">
              <Edit3 className="h-3.5 w-3.5" />
              Thay đổi ảnh bìa
            </button>
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
                onClick={() => alert("Chức năng cập nhật thông tin cá nhân đang được phát triển!")}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-4 py-2 text-2xs font-semibold text-slate-200 transition-all"
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
                <p className="text-sm text-blue-400 mt-1 font-medium">Senior Fullstack Developer</p>
                
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
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                {profile.bio}
              </p>

              {/* Extra details (Location, website, Calendar join date) */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-slate-850/60 text-xs text-slate-450">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {profile.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-slate-500" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-blue-400 hover:underline transition-colors"
                  >
                    github.com/nguyenvana
                  </a>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Đã gia nhập {profile.joinDate}
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
                {profile.skills.map((skill: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-xl bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300 border border-indigo-500/15 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
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
                  <span className="text-3xs text-slate-500 mt-1 block">Bài đăng đã chia sẻ</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-850 text-center">
                  <span className="block text-2xl font-bold text-indigo-500">1,248</span>
                  <span className="text-3xs text-slate-500 mt-1 block">Lượt ghé thăm Profile</span>
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
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 divide-y divide-slate-850/40">
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

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650 mt-12">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
      <Toaster />
    </div>
  );
}
