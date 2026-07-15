"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import { X, Heart, Sparkles, User, Briefcase, DollarSign, MapPin, Star, MessageSquare, RefreshCw, Loader2, Map as MapIcon, Layers, Info, ArrowLeft, Radar } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// Reuses the same map used on /explore and /services — SSR must stay
// disabled, Leaflet touches `window` at import time.
const RadarMap = dynamic(() => import("@/components/map/RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-slate-800 bg-[#0b1220] text-xs text-slate-400">
      Đang tải bản đồ...
    </div>
  ),
});

interface SwipeCard {
  id: string;
  name: string;
  title: string;
  experience: string;
  salary: string;
  location: string;
  distance: string;
  avatarUrl: string;
  bio: string;
  skills: string[];
  fomoTags: string[];
  latitude?: number;
  longitude?: number;
  isRealUser?: boolean; // candidates topic: a real, matchable DB user
  isRealJob?: boolean;  // jobs topic: a real, applicable DB job
}

const MIN_BEFORE_LOAD_MORE = 3;

export default function CandidatesSwipePage() {
  const [activeTopic, setActiveTopic] = useState<"candidates" | "jobs" | "travel">("candidates");
  const [viewMode, setViewMode] = useState<"swipe" | "map">("swipe");
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [matchedCard, setMatchedCard] = useState<SwipeCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);
  const [submittingCv, setSubmittingCv] = useState(false);
  const [desiredPosition, setDesiredPosition] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [keySkills, setKeySkills] = useState("");
  const [allowMatching, setAllowMatching] = useState(true);

  // Session/role — needed to know whether the viewer can act as an employer
  // (job-selector + real match persistence) vs. a plain candidate.
  const [sessionUser, setSessionUser] = useState<{ id: string; role: string; cvUrl?: string | null } | null>(null);
  const [myJobs, setMyJobs] = useState<{ id: string; title: string }[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const session = await res.json();
        if (!session?.user?.id) return;
        const profileRes = await fetch(`/api/profile?id=${session.user.id}`);
        const profile = profileRes.ok ? await profileRes.json() : {};
        setSessionUser({
          id: session.user.id,
          role: (session.user as any).role || profile.role || "USER",
          cvUrl: profile.cvUrl || profile.cv_url || null,
        });
      } catch (err) {
        console.error("Failed to load session for candidates page:", err);
      }
    }
    loadSession();
  }, []);

  // Employers need one of their own jobs selected before a candidate-match
  // can be persisted as a real Application (a match has to be "for" a job).
  useEffect(() => {
    if (!sessionUser || sessionUser.role !== "EMPLOYER") return;
    fetch("/api/jobs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const jobs = Array.isArray(data) ? data : data.jobs || [];
        const mine = jobs.filter((j: any) => j.employerId === sessionUser.id).map((j: any) => ({ id: j.id, title: j.title }));
        setMyJobs(mine);
        if (mine.length > 0) setSelectedJobId(mine[0].id);
      })
      .catch((err) => console.error("Failed to load employer's jobs:", err));
  }, [sessionUser]);

  const handleUploadCv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desiredPosition.trim() || !expectedSalary.trim() || !keySkills.trim()) {
      toast.error("Vui lòng điền đầy đủ các trường thông tin!");
      return;
    }
    setSubmittingCv(true);
    setTimeout(() => {
      setSubmittingCv(false);
      setIsCvModalOpen(false);
      setDesiredPosition("");
      setExpectedSalary("");
      setKeySkills("");
      toast.success("🎉 Hồ sơ của bạn đã lọt top tìm kiếm!");
    }, 1000);
  };

  const loadSwipeData = useCallback(async (topic: typeof activeTopic, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const res = await fetch(`/api/swipe?topic=${topic}`);
      if (res.ok) {
        const data: SwipeCard[] = await res.json();
        if (append) {
          setCards((prev) => {
            const seen = new Set(prev.map((c) => c.id));
            return [...prev, ...data.filter((c) => !seen.has(c.id))];
          });
        } else {
          setCards(data);
          setCurrentIndex(0);
          setMatchedCard(null);
        }
      }
    } catch (err) {
      console.error("Failed to load BitPaw Swipe data:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load cards dynamically based on chosen topic
  useEffect(() => {
    loadSwipeData(activeTopic, false);
  }, [activeTopic, loadSwipeData]);

  // "Chống rỗng": once the deck is running low, transparently top up in the
  // background (server auto-seeds real filler rows if it's genuinely short —
  // see /api/swipe) instead of ever showing a dead "no more cards" state
  // while the user is mid-session.
  useEffect(() => {
    if (loading || loadingMore) return;
    if (cards.length - currentIndex <= MIN_BEFORE_LOAD_MORE) {
      loadSwipeData(activeTopic, true);
    }
  }, [currentIndex, cards.length, loading, loadingMore, activeTopic, loadSwipeData]);

  const activeCard = cards[currentIndex];

  // Preload the next 5 avatars so flipping through the deck doesn't visibly
  // pop/flash images in — the browser's HTTP cache does the rest.
  useEffect(() => {
    const upcoming = cards.slice(currentIndex + 1, currentIndex + 6);
    upcoming.forEach((c) => {
      if (!c?.avatarUrl) return;
      const img = new window.Image();
      img.src = c.avatarUrl;
    });
  }, [cards, currentIndex]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  const persistMatch = useCallback(async (card: SwipeCard) => {
    try {
      if (activeTopic === "jobs" && card.isRealJob) {
        if (!sessionUser) return;
        const cvUrl = sessionUser.cvUrl;
        if (!cvUrl) {
          toast("Cập nhật CV trong hồ sơ để lưu đơn ứng tuyển thật vào hệ thống HR nhé!", { icon: "📄" });
          return;
        }
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: card.id, cvUrl }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.error) toast.error(err.error);
        }
      } else if (activeTopic === "candidates" && card.isRealUser) {
        if (!sessionUser || sessionUser.role !== "EMPLOYER") return;
        if (!selectedJobId) {
          toast("Đăng tin tuyển dụng trước để lưu match vào HR Dashboard!", { icon: "💼" });
          return;
        }
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: selectedJobId, applicantId: card.id }),
        });
        if (res.ok) {
          toast.success("Đã lưu vào HR Dashboard — xem tại /hr-dashboard", { icon: "📋" });
        } else {
          const err = await res.json().catch(() => ({}));
          if (err.error) toast.error(err.error);
        }
      }
    } catch (err) {
      console.error("Failed to persist match:", err);
    }
  }, [activeTopic, sessionUser, selectedJobId]);

  const handleSwipe = (direction: "left" | "right") => {
    if (!activeCard) return;
    setSwipeDirection(direction);

    setTimeout(() => {
      if (direction === "right") {
        setMatchedCard(activeCard);
        persistMatch(activeCard);
      }
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
    }, 500);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setMatchedCard(null);
    setSwipeDirection(null);
    toast.success("🔄 Đã làm mới danh sách quẹt thẻ!");
  };

  const mapPoints = cards
    .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
    .map((c) => ({
      id: c.id,
      title: c.title,
      companyName: c.name,
      salary: c.salary,
      niche: "OTHERS",
      latitude: c.latitude!,
      longitude: c.longitude!,
      address: c.location,
      type: activeTopic === "candidates" ? ("CANDIDATE" as const) : ("JOB" as const),
    }));

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar />
      <Toaster position="top-center" />

      <main className="flex-1 w-full h-[calc(100vh-64px)] flex items-center justify-center p-4 relative bg-radial-gradient overflow-y-auto">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

        <div className={`w-full flex flex-col items-center ${viewMode === "map" ? "max-w-3xl h-full py-4" : "max-w-sm"}`}>
          <div className="text-center mb-4 flex items-center gap-1.5 justify-center">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h1 className="text-base font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              BitPaw Swipe
            </h1>
          </div>

          {/* Topic Selector Tabs */}
          <div className="flex w-full max-w-sm mb-3 bg-slate-900/60 border border-slate-800 rounded-xl p-1 backdrop-blur-sm z-20">
            {(["candidates", "jobs", "travel"] as const).map((t) => {
              const label = t === "candidates" ? "Tuyển dụng" : t === "jobs" ? "Tìm việc làm" : "Khám phá du lịch";
              const emoji = t === "candidates" ? "👤" : t === "jobs" ? "💼" : "✈️";
              return (
                <button
                  key={t}
                  onClick={() => setActiveTopic(t)}
                  className={`flex-1 text-center py-2 text-3xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    activeTopic === t
                      ? "bg-gradient-to-r from-blue-600 to-indigo-650 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-205"
                  }`}
                >
                  <span className="mr-1">{emoji}</span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Swipe / Map Mode toggle */}
          <div className="flex items-center gap-1 mb-2 bg-slate-900/60 border border-slate-800 rounded-xl p-1 z-20">
            <button
              onClick={() => setViewMode("swipe")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-3xs font-extrabold transition-all cursor-pointer ${viewMode === "swipe" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <Layers className="h-3.5 w-3.5" /> Swipe Mode
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-3xs font-extrabold transition-all cursor-pointer ${viewMode === "map" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              <MapIcon className="h-3.5 w-3.5" /> Map Mode
            </button>
          </div>

          {/* Employer job-selector — only meaningful when matching real candidates */}
          {activeTopic === "candidates" && sessionUser?.role === "EMPLOYER" && (
            <div className="w-full max-w-sm mb-3 z-20">
              {myJobs.length > 0 ? (
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-3xs text-slate-200 focus:outline-none focus:border-blue-600"
                >
                  {myJobs.map((j) => (
                    <option key={j.id} value={j.id}>Match cho vị trí: {j.title}</option>
                  ))}
                </select>
              ) : (
                <p className="text-4xs text-amber-400 text-center bg-amber-500/10 border border-amber-500/20 rounded-xl py-2 px-3">
                  Đăng tin tuyển dụng trước để match được lưu vào HR Dashboard.
                </p>
              )}
            </div>
          )}

          {loadingMore && (
            <div className="flex items-center gap-1.5 text-4xs text-blue-400 font-bold mb-2 animate-pulse z-20">
              <Radar className="h-3.5 w-3.5 animate-spin" />
              📡 Radar đang quét khu vực của bạn...
            </div>
          )}

          {viewMode === "map" ? (
            <div className="w-full flex-1 min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl z-10">
              <RadarMap jobs={mapPoints as any} />
            </div>
          ) : (
            <>
              {/* Cards Stack Area */}
              <div className="relative w-full h-[460px] flex items-center justify-center" style={{ perspective: "1500px" }}>
                {loading ? (
                  <div className="w-full h-full rounded-3xl border border-slate-850 bg-slate-900/50 shadow-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 backdrop-blur-md">
                    <Radar className="h-8 w-8 text-blue-500 animate-spin" />
                    <p className="text-4xs text-slate-450">📡 Radar đang quét khu vực của bạn...</p>
                  </div>
                ) : activeCard ? (
                  <div
                    className={`absolute w-full h-full transition-all duration-500 ease-out select-none ${
                      swipeDirection === "left"
                        ? "transform -translate-x-[150%] rotate-[-20deg] opacity-0"
                        : swipeDirection === "right"
                        ? "transform translate-x-[150%] rotate-[20deg] opacity-0"
                        : "scale-100 opacity-100"
                    }`}
                  >
                    {/* 3D flip container */}
                    <div
                      className="relative w-full h-full transition-transform duration-500"
                      style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                    >
                      {/* FRONT FACE */}
                      <div
                        className="absolute inset-0 rounded-3xl border border-slate-805 bg-slate-900 shadow-2xl p-5 flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10 pointer-events-none" />
                        <div className="absolute inset-0 w-full h-full bg-slate-950">
                          <img src={activeCard.avatarUrl} alt={activeCard.name} className="w-full h-full object-cover" />
                        </div>

                        <div className="relative z-20 flex justify-between items-center">
                          <span className="bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-full text-4xs font-bold text-slate-300 flex items-center gap-1 backdrop-blur-md">
                            <MapPin className="h-3 w-3 text-red-500" />
                            Cách {activeCard.distance} ({activeCard.location.split(",")[0]})
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsFlipped(true)}
                            title="Xem chi tiết CV/Kinh nghiệm"
                            className="bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 hover:text-blue-400 px-2 py-1 rounded-full text-4xs font-bold text-slate-300 flex items-center gap-1 backdrop-blur-md cursor-pointer transition-colors"
                          >
                            <Info className="h-3 w-3" /> Chi tiết
                          </button>
                        </div>

                        <div className="relative z-20 space-y-2 text-left">
                          {activeCard.fomoTags && activeCard.fomoTags.length > 0 && (
                            <div className="relative z-20 flex flex-wrap gap-1 mb-1 bg-transparent">
                              {activeCard.fomoTags.map((tag, idx) => (
                                <span key={idx} className="bg-gradient-to-r from-red-650/40 to-orange-600/40 border border-red-500/50 text-red-400 text-[8.5px] font-extrabold uppercase px-2 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse tracking-wide">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div>
                            <h2 className="text-lg font-black text-slate-100 leading-tight">{activeCard.name}</h2>
                            <p className="text-3xs font-extrabold text-blue-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {activeCard.title}
                            </p>
                          </div>

                          <p className="text-4xs text-slate-350 leading-relaxed line-clamp-2">{activeCard.bio}</p>

                          <div className="flex flex-wrap gap-1 pt-1">
                            {activeCard.skills.slice(0, 4).map((skill) => (
                              <span key={skill} className="text-[9px] bg-slate-950/90 border border-slate-800 text-slate-400 px-2 py-0.5 rounded">#{skill}</span>
                            ))}
                          </div>

                          <div className="flex justify-between items-center pt-2.5 border-t border-slate-800/80 mt-1">
                            <span className="text-[10px] text-slate-500 font-bold">{activeCard.experience}</span>
                            <span className="text-xs font-black text-emerald-400 flex items-center gap-0.5">
                              <DollarSign className="h-3.5 w-3.5" />
                              {activeCard.salary}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* BACK FACE — full detail, freeing the front from being crammed with text */}
                      <div
                        className="absolute inset-0 rounded-3xl border border-slate-805 bg-slate-900 shadow-2xl p-5 flex flex-col overflow-y-auto custom-scrollbar"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <img src={activeCard.avatarUrl} alt={activeCard.name} className="h-9 w-9 rounded-full object-cover border border-slate-800" />
                            <div>
                              <h3 className="text-xs font-black text-slate-100">{activeCard.name}</h3>
                              <p className="text-4xs text-blue-400 font-bold">{activeCard.title}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsFlipped(false)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer flex items-center gap-1 text-4xs font-bold"
                          >
                            <ArrowLeft className="h-3 w-3" /> Quay lại
                          </button>
                        </div>

                        <div className="space-y-3 text-left flex-1">
                          <div>
                            <p className="text-4xs font-black text-slate-500 uppercase tracking-wider mb-1">Giới thiệu</p>
                            <p className="text-3xs text-slate-300 leading-relaxed">{activeCard.bio}</p>
                          </div>
                          <div>
                            <p className="text-4xs font-black text-slate-500 uppercase tracking-wider mb-1">Kinh nghiệm</p>
                            <p className="text-3xs text-slate-300">{activeCard.experience}</p>
                          </div>
                          <div>
                            <p className="text-4xs font-black text-slate-500 uppercase tracking-wider mb-1">Toàn bộ kỹ năng</p>
                            <div className="flex flex-wrap gap-1">
                              {activeCard.skills.map((skill) => (
                                <span key={skill} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">#{skill}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                            <span className="text-4xs text-slate-500 font-bold flex items-center gap-1"><MapPin className="h-3 w-3" />{activeCard.location}</span>
                            <span className="text-xs font-black text-emerald-400 flex items-center gap-0.5">
                              <DollarSign className="h-3.5 w-3.5" />{activeCard.salary}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-3xl border border-slate-850 bg-slate-900/50 shadow-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 backdrop-blur-md animate-fadeIn">
                    <div className="h-16 w-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <User className="h-8 w-8 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Đã hết thẻ gợi ý!</h3>
                      <p className="text-4xs text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
                        Hãy quay lại sau hoặc nhấn nút bên dưới để bắt đầu lại từ thẻ đầu tiên.
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

              {!loading && activeCard && (
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
                    title={activeTopic === "candidates" ? "Match ứng viên" : activeTopic === "jobs" ? "Ứng tuyển ngay" : "Lưu địa điểm"}
                  >
                    <Heart className="h-6 w-6 stroke-[3px] fill-current" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MATCH CONGRATULATIONS POPUP MODAL */}
      {matchedCard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-5 animate-scaleIn">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMatchedCard(null)} className="p-1 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-white cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 animate-bounce">
                {activeTopic === "candidates" ? "🎉 MATCH THÀNH CÔNG!" : activeTopic === "jobs" ? "🎉 LƯU VIỆC LÀM!" : "🎉 LƯU ĐỊA ĐIỂM!"}
              </div>
              <p className="text-4xs text-slate-400">
                {activeTopic === "candidates"
                  ? "Bạn và ứng viên đã có sự quan tâm lẫn nhau."
                  : activeTopic === "jobs"
                  ? "Bạn đã bày tỏ sự quan tâm đến vị trí tuyển dụng này."
                  : "Bạn đã thêm địa điểm du lịch này vào danh sách yêu thích."}
              </p>
            </div>

            <div className="flex justify-center items-center gap-4 py-2">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-indigo-500 shadow-xl bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80" alt="Employer" className="h-full w-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[8px] font-black text-white px-1.5 py-0.2 rounded-full uppercase">Tôi</span>
              </div>

              <div className="h-8 w-8 text-rose-500 flex items-center justify-center text-2xl font-black">❤️</div>

              <div className="relative animate-pulse">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-emerald-500 shadow-xl">
                  <img src={matchedCard.avatarUrl} alt={matchedCard.name} className="h-full w-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-[8px] font-black text-white px-1.5 py-0.2 rounded-full uppercase">
                  {activeTopic === "candidates" ? "Ứng viên" : activeTopic === "jobs" ? "Công việc" : "Điểm đến"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-200">
                {activeTopic === "candidates"
                  ? `Đã mở khóa kết nối với ${matchedCard.name}!`
                  : activeTopic === "jobs"
                  ? `Đã lưu vị trí ${matchedCard.name} tại ${matchedCard.title}!`
                  : `Đã lưu khách sạn/địa điểm ${matchedCard.name}!`}
              </h4>
              <p className="text-4xs text-slate-550">
                {activeTopic === "candidates"
                  ? "Giờ đây bạn có thể liên hệ trực tiếp để phỏng vấn, hoặc theo dõi trong HR Dashboard."
                  : activeTopic === "jobs"
                  ? "Bạn có thể nhắn tin trực tiếp cho nhà tuyển dụng để nộp hồ sơ."
                  : "Bạn có thể nhắn tin trực tiếp để hỏi đặt phòng/tour nghỉ dưỡng."}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href="/messages"
                onClick={() => setMatchedCard(null)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 text-xs font-black text-white shadow-lg transition-all text-center select-none cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                {activeTopic === "candidates" ? "Nhắn tin phỏng vấn ngay" : activeTopic === "jobs" ? "Nhắn tin ứng tuyển ngay" : "Liên hệ tư vấn / Đặt phòng"}
              </a>
              {activeTopic === "candidates" && (
                <a
                  href="/hr-dashboard"
                  onClick={() => setMatchedCard(null)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 py-2.5 text-3xs font-bold text-slate-300 hover:text-white transition-all text-center select-none cursor-pointer"
                >
                  Xem HR Dashboard
                </a>
              )}
              <button
                type="button"
                onClick={() => setMatchedCard(null)}
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 font-bold text-3xs border border-slate-850 cursor-pointer"
              >
                {activeTopic === "candidates" ? "Tiếp tục quẹt CV" : activeTopic === "jobs" ? "Tiếp tục tìm việc" : "Tiếp tục khám phá"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>

      {activeTopic === "candidates" && viewMode === "swipe" && (
        <button
          type="button"
          onClick={() => setIsCvModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-xs px-4.5 py-3 rounded-full shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-pink-400/20"
        >
          <span>🚀</span>
          <span>Đăng hồ sơ của bạn lên sàn</span>
        </button>
      )}

      {isCvModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUploadCv} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-scaleIn text-slate-100 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-200 flex items-center gap-2">
                <span>🚀</span>
                Bật chế độ tìm việc & Đưa CV lên sàn
              </h3>
              <button type="button" onClick={() => setIsCvModalOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">VỊ TRÍ MONG MUỐN</label>
                <input type="text" placeholder="Ví dụ: Thợ sửa khóa, Kỹ thuật viên Spa..." value={desiredPosition} onChange={(e) => setDesiredPosition(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" required />
              </div>

              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">MỨC LƯƠNG YÊU CẦU</label>
                <input type="text" placeholder="Ví dụ: 15,000,000đ - 22,000,000đ..." value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" required />
              </div>

              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">KỸ NĂNG NỔI BẬT</label>
                <input type="text" placeholder="Ví dụ: Smartkey, ReactJS, Massage body..." value={keySkills} onChange={(e) => setKeySkills(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" required />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850/60 mt-1">
                <div>
                  <h5 className="text-[10px] font-bold text-slate-200">Cho phép nhà tuyển dụng nhìn thấy và quẹt CV của tôi</h5>
                  <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Hồ sơ của bạn sẽ hiển thị trong danh sách quẹt thẻ.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={allowMatching} onChange={(e) => setAllowMatching(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white border border-slate-700"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={() => setIsCvModalOpen(false)} className="rounded-xl px-4 py-2.5 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-colors">
                Hủy bỏ
              </button>
              <button type="submit" disabled={submittingCv} className="rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 px-4 py-2.5 text-3xs font-black text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-pink-500/20">
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
