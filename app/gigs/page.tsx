"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import { Sparkles, DollarSign, Calendar, MessageSquare, Plus, Loader2, BadgeCheck, Star, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface EmployerType {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  isVerified: boolean;
  trustScore: number;
}

interface GigType {
  id: string;
  title: string;
  description: string;
  budget: number;
  employerId: string;
  employer: EmployerType;
  status: string;
  isBoosted?: boolean;
  createdAt: string;
}

interface BidType {
  id: string;
  bidAmount: number;
  message: string;
  status: string;
  createdAt: string;
  freelancer: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role: string;
    isVerified: boolean;
    trustScore: number;
  };
}

export default function GigsPage() {
  const [gigs, setGigs] = useState<GigType[]>([]);
  const [activeGig, setActiveGig] = useState<GigType | null>(null);
  const [bids, setBids] = useState<BidType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Modal State for new Gig
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [creatingGig, setCreatingGig] = useState(false);

  // Form State for new Bid
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);

  // Load User Session
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error("Failed to load user session in GigsPage:", err);
      }
    }
    loadSession();
  }, []);

  // Fetch Gigs from API
  const loadGigs = async (selectFirst = true) => {
    try {
      setLoading(true);
      const res = await fetch("/api/gigs");
      if (res.ok) {
        const data = await res.json();
        setGigs(data);
        if (data.length > 0 && selectFirst) {
          setActiveGig(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải danh sách dự án đấu thầu.");
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async (type: string, id: string) => {
    try {
      const res = await fetch("/api/boost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        if (sessionUser) {
          setSessionUser((prev: any) => ({ ...prev, pawCoin: prev.pawCoin - 500 }));
        }
        await loadGigs(false);
        setActiveGig((prev: any) => prev ? { ...prev, isBoosted: true } : null);
      } else {
        toast.error(data.error || "Không thể đẩy top dự án.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  useEffect(() => {
    loadGigs();
  }, []);

  // Fetch Bids when active Gig changes
  useEffect(() => {
    if (!activeGig) return;
    const gigId = activeGig.id;

    async function loadBids() {
      try {
        setLoadingBids(true);
        const res = await fetch(`/api/gigs/${gigId}/bids`);
        if (res.ok) {
          const data = await res.json();
          setBids(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBids(false);
      }
    }

    loadBids();
    setBidAmount("");
    setBidMessage("");
  }, [activeGig]);

  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim() || !newBudget) return;

    setCreatingGig(true);
    try {
      const res = await fetch("/api/gigs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          budget: newBudget,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Đăng thầu việc thời vụ thành công!");
        setShowModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewBudget("");
        // Reload list and select the newly created gig
        const reloadRes = await fetch("/api/gigs");
        if (reloadRes.ok) {
          const updatedGigs = await reloadRes.json();
          setGigs(updatedGigs);
          const createdItem = updatedGigs.find((g: any) => g.id === data.id);
          if (createdItem) {
            setActiveGig(createdItem);
          }
        }
      } else {
        toast.error(data.error || "Không thể đăng thầu công việc.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    } finally {
      setCreatingGig(false);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGig || !bidAmount || !bidMessage.trim()) return;

    setSubmittingBid(true);
    try {
      const res = await fetch(`/api/gigs/${activeGig.id}/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bidAmount,
          message: bidMessage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Nộp thầu thành công!");
        setBids((prev) => [data, ...prev]);
        setBidAmount("");
        setBidMessage("");
      } else {
        toast.error(data.error || "Gửi thầu thất bại.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    } finally {
      setSubmittingBid(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        
        {/* Page title and dynamic add button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Chợ Đấu Thầu Việc Làm Thời Vụ
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Nơi kết nối nhanh chóng các dự án Freelancer, MMO, Spa và Kế toán dịch vụ.
            </p>
          </div>

          {sessionUser && (sessionUser.role === "EMPLOYER" || sessionUser.role === "ADMIN") && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>Đăng việc thầu mới</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400">Đang tải danh sách đấu thầu...</p>
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-slate-800 bg-slate-900/10">
            <p className="text-xs text-slate-500">Chưa có công việc thời vụ nào đang mở đấu thầu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-210px)] h-auto min-h-[500px]">
            
            {/* Left Column: Gigs List (5 cols) */}
            <div className="lg:col-span-5 border border-slate-800 rounded-2xl bg-slate-900/10 backdrop-blur p-4 flex flex-col lg:h-full h-[350px] overflow-hidden">
              <span className="block text-4xs font-bold uppercase text-slate-500 tracking-wider mb-3">Danh sách Gigs mở thầu</span>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {gigs.map((gig) => {
                  const isActive = activeGig?.id === gig.id;
                  return (
                    <div
                      key={gig.id}
                      onClick={() => setActiveGig(gig)}
                      className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${
                        isActive
                          ? "bg-blue-600/15 border-blue-500/30 text-white"
                          : gig.isBoosted
                            ? "border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 hover:bg-amber-550/10 shadow-lg shadow-amber-500/5"
                            : "bg-slate-950/20 border-slate-850 hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {gig.isBoosted && (
                          <span className="inline-flex items-center rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                            TÀI TRỢ
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-slate-200 line-clamp-1 flex-1">{gig.title}</h3>
                      </div>
                      <p className="text-3xs text-slate-450 line-clamp-2 mt-1 leading-relaxed">{gig.description}</p>
                      
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-850/40">
                        <span className="text-3xs text-emerald-450 font-bold">
                          {gig.budget.toLocaleString("vi-VN")} đ
                        </span>
                        <span className="text-4xs text-slate-500">
                          {new Date(gig.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Gig Details & Bids (7 cols) */}
            <div className="lg:col-span-7 border border-slate-800 rounded-2xl bg-slate-900/10 backdrop-blur p-6 flex flex-col lg:h-full lg:overflow-y-auto h-auto overflow-y-visible space-y-6">
              {activeGig ? (
                <>
                  {/* Gig Header detail */}
                  <div className="border-b border-slate-850 pb-5 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeGig.isBoosted && (
                          <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-4xs font-bold text-amber-400 border border-amber-500/20">
                            TÀI TRỢ
                          </span>
                        )}
                        <h2 className="text-sm sm:text-base font-bold text-slate-100">{activeGig.title}</h2>
                      </div>
                      <span className="flex-shrink-0 inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-3xs font-semibold text-emerald-400 border border-emerald-500/20">
                        Ngân sách: {activeGig.budget.toLocaleString("vi-VN")} đ
                      </span>
                    </div>

                    {sessionUser && sessionUser.id === activeGig.employerId && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleBoost("gig", activeGig.id)}
                          disabled={activeGig.isBoosted}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-xl border transition-all ${
                            activeGig.isBoosted
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-default"
                              : "bg-gradient-to-r from-amber-600 to-yellow-600 border-amber-500 hover:from-amber-550 hover:to-yellow-550 text-white shadow-md shadow-amber-500/10"
                          }`}
                        >
                          🚀 {activeGig.isBoosted ? "Tin đã được Đẩy Top" : "Đẩy Top bài đăng (500 Coin)"}
                        </button>
                      </div>
                    )}

                    <p className="text-xs sm:text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{activeGig.description}</p>
                    
                    {/* Employer details */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-850/40">
                      <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-800">
                        <img
                          src={activeGig.employer.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeGig.employer.name)}&background=2563eb&color=ffffff&bold=true`}
                          alt={activeGig.employer.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="text-3xs">
                        <p className="font-bold text-slate-200 flex items-center gap-1">
                          <span>{activeGig.employer.name}</span>
                          {activeGig.employer.isVerified && (
                            <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10" />
                          )}
                          <span className="flex items-center gap-0.5 text-amber-450 ml-1.5 font-normal">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            {activeGig.employer.trustScore?.toFixed(1) || "5.0"}
                          </span>
                        </p>
                        <p className="text-slate-500 mt-0.5">Nhà tuyển dụng • Đăng thầu ngày {new Date(activeGig.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bidding Form (only for USER candidates) */}
                  {sessionUser && sessionUser.role === "USER" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-250 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Gửi báo giá thầu dự án này
                      </h4>
                      <form onSubmit={handlePlaceBid} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-4xs font-semibold text-slate-450 mb-1">Giá thầu đề xuất (VNĐ)</label>
                            <input
                              type="number"
                              required
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              placeholder="Ví dụ: 1200000"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-4xs font-semibold text-slate-450 mb-1">Lời nhắn / Năng lực thực hiện</label>
                          <textarea
                            required
                            value={bidMessage}
                            onChange={(e) => setBidMessage(e.target.value)}
                            placeholder="Mô tả kỹ năng, số năm kinh nghiệm, hoặc hướng triển khai để thuyết phục chủ thầu..."
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingBid}
                          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 text-2xs font-bold text-white transition-all"
                        >
                          {submittingBid ? "Đang nộp báo giá..." : "Nộp chào thầu ngay"}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Bids List Header */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-200">
                      Báo giá thầu đã nộp ({bids.length})
                    </h3>

                    {loadingBids ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      </div>
                    ) : bids.length === 0 ? (
                      <p className="text-3xs text-slate-500 text-center py-4">Chưa có ai gửi báo giá. Hãy là người đầu tiên chào thầu!</p>
                    ) : (
                      <div className="space-y-2.5">
                        {bids.map((bid) => {
                          const freelancerAvatar = bid.freelancer.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.freelancer.name)}&background=2563eb&color=ffffff&bold=true`;
                          return (
                            <div key={bid.id} className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl space-y-2.5">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full overflow-hidden border border-slate-800">
                                    <img src={freelancerAvatar} alt={bid.freelancer.name} loading="lazy" className="h-full w-full object-cover" />
                                  </div>
                                  <div className="text-4xs">
                                    <p className="font-bold text-slate-200 flex items-center gap-1">
                                      <span>{bid.freelancer.name}</span>
                                      {bid.freelancer.isVerified && (
                                        <BadgeCheck className="h-3 w-3 text-blue-500 fill-blue-500/10" />
                                      )}
                                      <span className="flex items-center gap-0.5 text-amber-450 ml-1 font-normal">
                                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                        {bid.freelancer.trustScore?.toFixed(1) || "5.0"}
                                      </span>
                                    </p>
                                    <p className="text-slate-500 mt-0.5">{bid.freelancer.role}</p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-3xs font-bold text-emerald-450">
                                    Chào thầu: {bid.bidAmount.toLocaleString("vi-VN")} đ
                                  </span>
                                  <p className="text-4xs text-slate-500 mt-0.5">
                                    {new Date(bid.createdAt).toLocaleDateString("vi-VN")}
                                  </p>
                                </div>
                              </div>
                              <p className="text-3xs text-slate-300 leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-900/60">
                                {bid.message}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 space-y-2">
                  <DollarSign className="h-8 w-8 text-slate-650" />
                  <p className="text-xs text-slate-400">Chọn một tin tuyển dụng đấu thầu ở cột trái để xem chi tiết.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* MODAL FOR NEW GIG */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-100">Đăng Việc Thầu Thời Vụ</h3>
              <p className="text-4xs text-slate-450 mt-1">Thiết lập bài đăng dự án thời vụ hoặc dịch vụ cần thuê khoán gói.</p>
            </div>

            <form onSubmit={handleCreateGig} className="space-y-4">
              <div>
                <label className="block text-4xs font-semibold text-slate-355">Tiêu đề dự án</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Cần thiết kế Logo tiệm Spa cao cấp"
                  className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-semibold text-slate-355">Mô tả công việc</label>
                <textarea
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Mô tả kỹ yêu cầu, phạm vi công việc cần thực hiện..."
                  rows={4}
                  className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-semibold text-slate-355">Ngân sách (VNĐ)</label>
                <input
                  type="number"
                  required
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="Ví dụ: 1500000"
                  className="w-full mt-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none"
                />
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
                  disabled={creatingGig}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2 px-4 text-xs font-semibold text-white transition-all"
                >
                  {creatingGig ? "Đang xử lý..." : "Đăng thầu ngay"}
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
