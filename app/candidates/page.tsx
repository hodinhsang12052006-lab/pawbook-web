"use client";

import React, { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { X, Heart, Sparkles, User, Briefcase, DollarSign, MapPin, Star, MessageSquare, RefreshCw, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Candidate {
  id: string;
  name: string;
  title: string;
  position?: string;
  experience: string;
  salary: string;
  location: string;
  distance: string;
  avatarUrl: string;
  bio: string;
  skills: string[];
  fomoTags: string[];
}

// MOCK_CANDIDATES removed, loading dynamically from public/data/fomo_cvs.json instead

export default function CandidatesSwipePage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [matchedCandidate, setMatchedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [submittingCv, setSubmittingCv] = useState(false);
  const [desiredPosition, setDesiredPosition] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [keySkills, setKeySkills] = useState("");
  const [allowMatching, setAllowMatching] = useState(true);

  const handleUploadCv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desiredPosition.trim() || !expectedSalary.trim() || !keySkills.trim()) {
      toast.error("Vui lòng điền đầy đủ các trường thông tin!");
      return;
    }
    setSubmittingCv(true);
    setTimeout(() => {
      setSubmittingCv(false);
      setShowUploadModal(false);
      // Reset form
      setDesiredPosition("");
      setExpectedSalary("");
      setKeySkills("");
      toast.success("🎉 Hồ sơ của bạn đã lọt top tìm kiếm!");
    }, 1000);
  };

  React.useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await fetch("/data/fomo_cvs.json");
        if (res.ok) {
          const data = await res.json();
          setCandidates(data);
        }
      } catch (err) {
        console.error("Failed to load FOMO CVs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCandidates();
  }, []);

  const activeCandidate = candidates[currentIndex];

  const handleSwipe = (direction: "left" | "right") => {
    if (!activeCandidate) return;
    setSwipeDirection(direction);

    // After animation, move to next card
    setTimeout(() => {
      if (direction === "right") {
        setMatchedCandidate(activeCandidate);
      }
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
    }, 500);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setMatchedCandidate(null);
    setSwipeDirection(null);
    toast.success("🔄 Đã làm mới danh sách ứng viên!");
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Global Navbar */}
      <Navbar />
      <Toaster position="top-center" />

      {/* Main Container */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] flex items-center justify-center p-4 relative bg-radial-gradient">
        {/* Neon blur background highlights */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-sm flex flex-col items-center">
          
          {/* Tinder Swiper Header */}
          <div className="text-center mb-5 flex items-center gap-1.5 justify-center">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h1 className="text-base font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              Tinder Tuyển Dụng
            </h1>
          </div>

          {/* Cards Stack Area */}
          <div className="relative w-full h-[460px] flex items-center justify-center">
            {activeCandidate ? (
              <div
                className={`absolute w-full h-full rounded-3xl border border-slate-805 bg-slate-900 shadow-2xl p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 ease-out select-none cursor-grab active:cursor-grabbing ${
                  swipeDirection === "left"
                    ? "transform -translate-x-[150%] rotate-[-20deg] opacity-0"
                    : swipeDirection === "right"
                    ? "transform translate-x-[150%] rotate-[20deg] opacity-0"
                    : "scale-100 opacity-100"
                }`}
              >
                {/* Background Shadow Gradient inside card */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10 pointer-events-none" />

                {/* Candidate Photo */}
                <div className="absolute inset-0 w-full h-full">
                  <img
                    src={activeCandidate.avatarUrl}
                    alt={activeCandidate.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Top Badge: Distance & Rating */}
                <div className="relative z-20 flex justify-between items-center">
                  <span className="bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-full text-4xs font-bold text-slate-300 flex items-center gap-1 backdrop-blur-md">
                    <MapPin className="h-3 w-3 text-red-500" />
                    Cách {activeCandidate.distance} ({activeCandidate.location})
                  </span>
                  <span className="bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full text-4xs font-bold text-amber-400 flex items-center gap-1 backdrop-blur-md">
                    <Star className="h-3 w-3 fill-current text-amber-500" />
                    5.0
                  </span>
                </div>

                {/* Bottom Information Card Detail */}
                <div className="relative z-20 space-y-2 text-left">
                  {/* FOMO Badges at the top of card content */}
                  {activeCandidate.fomoTags && activeCandidate.fomoTags.length > 0 && (
                    <div className="relative z-20 flex flex-wrap gap-1 mb-1 bg-transparent">
                      {activeCandidate.fomoTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-gradient-to-r from-red-650/40 to-orange-600/40 border border-red-500/50 text-red-400 text-[8.5px] font-extrabold uppercase px-2 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse tracking-wide"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div>
                    <h2 className="text-lg font-black text-slate-100 leading-tight">
                      {activeCandidate.name}
                    </h2>
                    <p className="text-3xs font-extrabold text-blue-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {activeCandidate.title}
                    </p>
                  </div>

                  <p className="text-4xs text-slate-350 leading-relaxed line-clamp-3">
                    {activeCandidate.bio}
                  </p>

                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {activeCandidate.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[9px] bg-slate-950/90 border border-slate-800 text-slate-400 px-2 py-0.5 rounded"
                      >
                        #{skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-800/80 mt-1">
                    <span className="text-[10px] text-slate-500 font-bold">{activeCandidate.experience}</span>
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-0.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      {activeCandidate.salary}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* End of candidates list card */
              <div className="w-full h-full rounded-3xl border border-slate-850 bg-slate-900/50 shadow-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 backdrop-blur-md animate-fadeIn">
                <div className="h-16 w-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Đã hết hồ sơ ứng viên!</h3>
                  <p className="text-4xs text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
                    Hãy quay lại sau hoặc làm mới danh sách ứng viên để tiếp tục quẹt tìm thợ phù hợp.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-xl text-3xs shadow-md transition-all cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Làm mới danh sách
                </button>
              </div>
            )}
          </div>

          {/* Swipe Buttons Controls */}
          {activeCandidate && (
            <div className="flex gap-6 mt-6 items-center z-20">
              <button
                type="button"
                onClick={() => handleSwipe("left")}
                className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 hover:border-red-500/20 text-red-500 flex items-center justify-center shadow-lg hover:shadow-red-500/10 active:scale-90 hover:scale-110 transition-all duration-300 cursor-pointer"
                title="Bỏ qua"
              >
                <X className="h-6 w-6 stroke-[3px]" />
              </button>

              <button
                type="button"
                onClick={() => handleSwipe("right")}
                className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl hover:shadow-emerald-500/20 active:scale-90 hover:scale-110 transition-all duration-300 cursor-pointer animate-pulse"
                title="Match và Phỏng vấn"
              >
                <Heart className="h-6 w-6 stroke-[3px] fill-current" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* MATCH CONGRATULATIONS POPUP MODAL */}
      {matchedCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-5 animate-scaleIn">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMatchedCandidate(null)}
                className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-3xl animate-bounce">🎉 MATCH THÀNH CÔNG!</div>
              <p className="text-4xs text-slate-400">Bạn và ứng viên đã có sự quan tâm lẫn nhau.</p>
            </div>

            {/* Avatars comparison */}
            <div className="flex justify-center items-center gap-4 py-2">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-indigo-500 shadow-xl bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80" alt="Employer" className="h-full w-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[8px] font-black text-white px-1.5 py-0.2 rounded-full uppercase">Me</span>
              </div>

              <div className="h-8 w-8 text-rose-500 flex items-center justify-center text-2xl font-black">❤️</div>

              <div className="relative animate-pulse">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-emerald-500 shadow-xl">
                  <img src={matchedCandidate.avatarUrl} alt={matchedCandidate.name} className="h-full w-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-[8px] font-black text-white px-1.5 py-0.2 rounded-full uppercase">Thợ</span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-200">Đã mở khóa cuộc trò chuyện với {matchedCandidate.name}!</h4>
              <p className="text-4xs text-slate-500">Giờ đây bạn có thể liên hệ phỏng vấn thử tay nghề.</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href="/messages"
                onClick={() => setMatchedCandidate(null)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 text-xs font-black text-white shadow-lg transition-all text-center select-none cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" /> Nhắn tin phỏng vấn ngay
              </a>
              <button
                type="button"
                onClick={() => setMatchedCandidate(null)}
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 font-bold text-3xs border border-slate-850 cursor-pointer"
              >
                Tiếp tục quẹt CV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled animation keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
      {/* Floating Action Button for Uploading CV */}
      <button
        type="button"
        onClick={() => setShowUploadModal(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-xs px-4.5 py-3 rounded-full shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-pink-400/20"
      >
        <span>🚀</span>
        <span>Đăng hồ sơ của bạn lên sàn</span>
      </button>

      {/* UPLOAD CV MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleUploadCv}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-scaleIn text-slate-100 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-200 flex items-center gap-2">
                <span>🚀</span>
                Bật chế độ tìm việc & Đưa CV lên sàn
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">VỊ TRÍ MONG MUỐN</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thợ sửa khóa, Kỹ thuật viên Spa..."
                  value={desiredPosition}
                  onChange={(e) => setDesiredPosition(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">MỨC LƯƠNG YÊU CẦU</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 15,000,000đ - 22,000,000đ..."
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">KỸ NĂNG NỔI BẬT</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Smartkey, ReactJS, Massage body..."
                  value={keySkills}
                  onChange={(e) => setKeySkills(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850/60 mt-1">
                <div>
                  <h5 className="text-[10px] font-bold text-slate-200">Cho phép nhà tuyển dụng nhìn thấy và quẹt CV của tôi</h5>
                  <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Hồ sơ của bạn sẽ hiển thị trong danh sách quẹt thẻ.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMatching}
                    onChange={(e) => setAllowMatching(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white border border-slate-700"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                }}
                className="rounded-xl px-4 py-2.5 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submittingCv}
                className="rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 px-4 py-2.5 text-3xs font-black text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-pink-500/20"
              >
                {submittingCv && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Lưu & Đưa lên sàn</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
