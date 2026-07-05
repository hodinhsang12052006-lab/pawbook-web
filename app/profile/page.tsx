"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import CVManager from "@/components/profile/CVManager";
import PostList, { PostType } from "@/components/feed/PostList";
import { 
  ArrowLeft, Edit3, MapPin, Link2, Calendar, Briefcase, 
  Award, Sparkles, ShieldCheck, BadgeCheck, Star, Mail, 
  Phone, FileText, X, Save, Loader2, DollarSign, Clock, Flame
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
  is_premium?: boolean;
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    phone: "",
    address: "",
    cover_image: "",
    cv_url: "",
    skills: "",
    avatarUrl: "",
  });

  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<"bookings" | "posts">("bookings");
  const [bookings, setBookings] = useState<{ received: any[]; sent: any[] }>({ received: [], sent: [] });
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      const res = await fetch("/api/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Failed to load bookings:", err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTargetUserId, setReviewTargetUserId] = useState<string | null>(null);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTargetUserId || !reviewComment.trim() || reviewSubmitting) return;

    setReviewSubmitting(true);
    const toastId = toast.loading("Đang gửi đánh giá dịch vụ...");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: reviewTargetUserId,
          jobId: reviewJobId || undefined,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Gửi đánh giá thành công! Cảm ơn ý kiến của bạn. ⭐", { id: toastId });
        setIsReviewModalOpen(false);
        setReviewComment("");
        setReviewRating(5);
      } else {
        toast.error(data.error || "Gửi đánh giá thất bại.", { id: toastId });
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.", { id: toastId });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: "ACCEPTED" | "REJECTED" | "COMPLETED") => {
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status }),
      });

      if (res.ok) {
        toast.success(`Đã cập nhật trạng thái thành công!`);
        fetchBookings();
      } else {
        const data = await res.json();
        toast.error(data.error || "Cập nhật trạng thái thất bại.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

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
          avatarUrl: data.avatarUrl || "",
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
    fetchBookings();
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

  // Cloudinary File Upload handler
  const handleCloudinaryUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "avatar" | "cover" | "cv") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type constraints
    const allowedTypes = field === "cv" ? ["application/pdf"] : ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(field === "cv" ? "Vui lòng chọn tệp tin định dạng PDF." : "Vui lòng tải lên ảnh có định dạng JPG, PNG hoặc WEBP.");
      return;
    }

    setUploading(field);
    const toastId = toast.loading(`Đang tải tệp tin ${field === "cv" ? "CV" : "ảnh"} lên Cloudinary...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        toast.success("Tải lên đám mây Cloudinary thành công! ☁️", { id: toastId });
        
        // Update both editForm and locally displayed profile state
        if (field === "avatar") {
          setEditForm((prev) => ({ ...prev, avatarUrl: data.url }));
          setProfile((prev: any) => ({ ...prev, avatarUrl: data.url }));
        } else if (field === "cover") {
          setEditForm((prev) => ({ ...prev, cover_image: data.url }));
          setProfile((prev: any) => ({ ...prev, cover_image: data.url }));
        } else if (field === "cv") {
          setEditForm((prev) => ({ ...prev, cv_url: data.url }));
          setProfile((prev: any) => ({ ...prev, cv_url: data.url }));
        }
      } else {
        toast.error(data.error || "Tải tệp tin lên thất bại.", { id: toastId });
      }
    } catch (err) {
      toast.error("Lỗi mạng khi tải tệp tin lên.", { id: toastId });
    } finally {
      setUploading(null);
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

  // Job Boosting Action Handler
  const handleBoostJob = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmBoost = confirm(
      "Bạn có chắc chắn muốn dùng 50 PawCoins để đẩy tin tuyển dụng này lên Top trong 7 ngày không?"
    );
    if (!confirmBoost) return;

    try {
      const res = await fetch("/api/jobs/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Đẩy Top tin tuyển dụng thành công! 🔥");
        loadUserProfile();
        const txRes = await fetch("/api/wallet/history");
        if (txRes.ok) {
          const txData = await txRes.json();
          setWalletHistory(txData);
        }
      } else {
        toast.error(data.error || "Không thể đẩy Top bài viết.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối khi đẩy Top bài đăng.");
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
                      <span className="flex items-center gap-1">
                        <BadgeCheck className="h-5 w-5 text-blue-500 fill-blue-500/20" />
                        <span className="text-blue-400 text-sm" title="Tài khoản đã xác minh">💎</span>
                      </span>
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
                    <div
                      key={job.id}
                      className="block rounded-xl border border-slate-850 bg-slate-950/40 p-3 hover:border-blue-500/35 transition-all text-xs relative"
                    >
                      <Link href={`/jobs/${job.id}`} className="group">
                        <h4 className="font-bold text-slate-200 group-hover:text-blue-450 transition-colors truncate pr-20">
                          {job.title}
                        </h4>
                        <div className="flex justify-between items-center mt-2 text-3xs font-semibold text-slate-500">
                          <span className="text-emerald-555 font-bold">{job.salary}</span>
                          <span className="uppercase">{job.niche}</span>
                        </div>
                      </Link>

                      <div className="absolute right-3 top-3.5">
                        {job.is_premium ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-550/20 px-1.5 py-0.5 text-[9px] font-bold">
                            ⭐ Đang trên Top
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleBoostJob(job.id, e)}
                            className="inline-flex items-center gap-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/35 px-2 py-1 text-[9px] font-extrabold transition-all cursor-pointer"
                          >
                            🔥 Đẩy Top
                          </button>
                        )}
                      </div>
                    </div>
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

          {/* Right Area: Tabs controls (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tab switch header */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-2 flex gap-2">
              <button
                onClick={() => setActiveRightTab("bookings")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeRightTab === "bookings"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📅 Yêu cầu & Đơn hàng
              </button>
              <button
                onClick={() => setActiveRightTab("posts")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeRightTab === "posts"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📝 Bài viết của bạn
              </button>
            </div>

            {activeRightTab === "bookings" ? (
              <div className="space-y-6">
                {/* 1. Received Bookings (As Provider / Owner) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-850">
                    <span className="text-blue-400">📥</span> Yêu Cầu Nhận Được (Chủ bài đăng)
                  </h3>

                  {bookingsLoading ? (
                    <div className="flex items-center justify-center py-6 text-3xs text-slate-500 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span>Đang tải danh sách yêu cầu...</span>
                    </div>
                  ) : bookings.received.length === 0 ? (
                    <p className="text-center py-6 text-3xs text-slate-500 italic">Chưa nhận được yêu cầu nào.</p>
                  ) : (
                    <div className="space-y-4 divide-y divide-slate-850/50">
                      {bookings.received.map((req: any, idx: number) => (
                        <div key={req.id} className={`${idx > 0 ? "pt-4" : ""} space-y-3 text-xs`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={req.sender.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"}
                                alt={req.sender.name}
                                className="h-9 w-9 rounded-full object-cover border border-slate-850"
                              />
                              <div>
                                <h4 className="font-bold text-slate-200">{req.sender.name}</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Vai trò: {req.sender.role} • ĐT:{" "}
                                  <a href={`tel:${req.sender.phone}`} className="text-emerald-450 hover:underline">
                                    {req.sender.phone || "Chưa cập nhật"}
                                  </a>
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-extrabold border ${
                                req.status === "PENDING"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : req.status === "ACCEPTED"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : req.status === "REJECTED"
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-450"
                                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              }`}
                            >
                              {req.status === "PENDING" && "CHỜ DUYỆT"}
                              {req.status === "ACCEPTED" && "ĐÃ NHẬN"}
                              {req.status === "REJECTED" && "ĐÃ TỪ CHỐI"}
                              {req.status === "COMPLETED" && "HOÀN THÀNH"}
                            </span>
                          </div>

                          <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-2">
                            <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                              Đối với bài đăng:{" "}
                              <span className="text-blue-400">
                                {req.job?.title || req.service?.name}
                              </span>
                            </p>
                            <p className="text-slate-300 italic text-2xs leading-relaxed">
                              "{req.message || "Không có lời nhắn kèm theo."}"
                            </p>
                          </div>

                          {/* Control buttons for Provider */}
                          {req.status === "PENDING" && (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleUpdateBookingStatus(req.id, "REJECTED")}
                                className="px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold transition-all cursor-pointer"
                              >
                                ❌ Từ chối
                              </button>
                              <button
                                onClick={() => handleUpdateBookingStatus(req.id, "ACCEPTED")}
                                className="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all cursor-pointer"
                              >
                                ✅ Nhận đơn
                              </button>
                            </div>
                          )}

                          {req.status === "ACCEPTED" && (
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleUpdateBookingStatus(req.id, "COMPLETED")}
                                className="px-3 py-1.5 rounded-lg border border-blue-500/25 bg-blue-550/15 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold transition-all cursor-pointer"
                              >
                                🏁 Đánh dấu hoàn thành
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Sent Bookings (As Client / Candidate) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-850">
                    <span className="text-emerald-400">📤</span> Yêu Cầu Đã Gửi (Khách hàng)
                  </h3>

                  {bookingsLoading ? (
                    <div className="flex items-center justify-center py-6 text-3xs text-slate-550 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span>Đang tải danh sách yêu cầu...</span>
                    </div>
                  ) : bookings.sent.length === 0 ? (
                    <p className="text-center py-6 text-3xs text-slate-500 italic">Chưa gửi yêu cầu nào.</p>
                  ) : (
                    <div className="space-y-4 divide-y divide-slate-850/50">
                      {bookings.sent.map((req: any, idx: number) => (
                        <div key={req.id} className={`${idx > 0 ? "pt-4" : ""} space-y-3 text-xs`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={req.receiver.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"}
                                alt={req.receiver.name}
                                className="h-9 w-9 rounded-full object-cover border border-slate-850"
                              />
                              <div>
                                <h4 className="font-bold text-slate-200">Gửi đến: {req.receiver.name}</h4>
                                <p className="text-[10px] text-slate-550 mt-0.5">
                                  Vai trò: {req.receiver.role} • ĐT:{" "}
                                  <a href={`tel:${req.receiver.phone}`} className="text-emerald-450 hover:underline">
                                    {req.receiver.phone || "Chưa cập nhật"}
                                  </a>
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-extrabold border ${
                                req.status === "PENDING"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : req.status === "ACCEPTED"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : req.status === "REJECTED"
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-450"
                                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              }`}
                            >
                              {req.status === "PENDING" && "CHỜ PHẢN HỒI"}
                              {req.status === "ACCEPTED" && "ĐÃ NHẬN ĐƠN"}
                              {req.status === "REJECTED" && "BỊ TỪ CHỐI"}
                              {req.status === "COMPLETED" && "HOÀN THÀNH"}
                            </span>
                          </div>

                          <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-2">
                            <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                              Đối với bài đăng:{" "}
                              <span className="text-blue-400">
                                {req.job?.title || req.service?.name}
                              </span>
                            </p>
                            <p className="text-slate-355 text-2xs">
                              Lời nhắn: "{req.message || "Không có lời nhắn."}"
                            </p>
                          </div>

                          {req.status === "ACCEPTED" && (
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleUpdateBookingStatus(req.id, "COMPLETED")}
                                className="px-3 py-1.5 rounded-lg border border-blue-500/25 bg-blue-550/15 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold transition-all cursor-pointer"
                              >
                                🏁 Đánh dấu hoàn thành
                              </button>
                            </div>
                          )}

                          {req.status === "COMPLETED" && (
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => {
                                  setReviewTargetUserId(req.receiver.id);
                                  setReviewJobId(req.jobId || null);
                                  setIsReviewModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-450 hover:text-yellow-350 text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-yellow-550/5"
                              >
                                <span>⭐️ Đánh giá dịch vụ</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-100">Bài viết của bạn</h2>
                  <span className="text-xs text-slate-400 font-medium">Sắp xếp: Mới nhất</span>
                </div>
                <PostList posts={myPosts} onLikePost={handleLikePost} />
              </div>
            )}
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

              {/* Avatar file upload */}
              <div>
                <label className="block font-bold text-slate-350 mb-1.5 flex items-center justify-between">
                  <span>Ảnh đại diện (Avatar)</span>
                  {uploading === "avatar" && (
                    <span className="text-[10px] text-blue-450 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Đang tải lên...
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  {editForm.avatarUrl && (
                    <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex-shrink-0">
                      <img src={editForm.avatarUrl} alt="Preview Avatar" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleCloudinaryUpload(e, "avatar")}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600/10 file:text-blue-405 hover:file:bg-blue-600/25 file:cursor-pointer"
                  />
                </div>
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
                  <label className="block font-bold text-slate-350 mb-1.5 flex items-center justify-between">
                    <span>Ảnh bìa (Cover Image)</span>
                    {uploading === "cover" && (
                      <span className="text-[10px] text-blue-450 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang tải...
                      </span>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleCloudinaryUpload(e, "cover")}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600/10 file:text-blue-405 hover:file:bg-blue-600/25 file:cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-350 mb-1.5 flex items-center justify-between">
                    <span>Hồ sơ năng lực (CV PDF)</span>
                    {uploading === "cv" && (
                      <span className="text-[10px] text-blue-450 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang tải...
                      </span>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleCloudinaryUpload(e, "cv")}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600/10 file:text-blue-405 hover:file:bg-blue-600/25 file:cursor-pointer"
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

      {/* Review Modal Dialog */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#090e1c] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>⭐ Đánh giá dịch vụ & Đối tác</span>
              </h2>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              {/* Rating stars */}
              <div>
                <label className="block font-bold text-slate-350 mb-2">Chấm điểm chất lượng</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`h-7 w-7 ${
                          star <= reviewRating
                            ? "fill-yellow-500 text-yellow-500"
                            : "text-slate-700"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review content */}
              <div>
                <label className="block font-bold text-slate-350 mb-1.5">Lời nhận xét / Đánh giá chi tiết</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Hãy chia sẻ trải nghiệm dịch vụ của bạn (Ví dụ: Thợ nhiệt tình, đúng giờ, xe sạch sẽ...)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-250 placeholder-slate-650 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Submit action */}
              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-2xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-2xs font-semibold text-white hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
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
