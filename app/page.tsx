"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import PostForm from "@/components/feed/PostForm";
import PostList from "@/components/feed/PostList";
import JobBoard, { JobType } from "@/components/jobs/JobBoard";
import { Sparkles, ArrowUpRight, Zap, Target, Users, Key } from "lucide-react";
import AiSuggest from "@/components/jobs/AiSuggest";

export default function Home() {
  const [activeTab, setActiveTab] = useState("feed");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user?.id) {
            const userRes = await fetch(`/api/profile?id=${session.user.id}`);
            if (userRes.ok) {
              const userData = await userRes.json();
              setCurrentUser(userData);
              return;
            }
          }
          setCurrentUser(session?.user || null);
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    }
    loadUser();
  }, []);

  const handlePostAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  /*
  // State for jobs, pre-populated with realistic mock data
  const [jobs, setJobs] = useState<JobType[]>([
    {
      id: "job-1",
      title: "Senior Next.js Developer (Remote - MMO Projects)",
      companyName: "PawBook Solutions",
      description: "Chúng tôi tìm kiếm Senior Next.js Developer làm việc remote. Yêu cầu thành thạo App Router, Tailwind CSS, tối ưu SEO, và có tư duy làm sản phẩm nhanh gọn để triển khai các landing page MMO & Product-Led Growth.",
      salary: "$2,000 - $3,500",
      location: "Hà Nội / Remote",
      tags: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Remote"],
      createdAt: "Hôm nay",
    },
    {
      id: "job-2",
      title: "Chuyên Viên Automation Script (Python / Puppeteer)",
      companyName: "BitPaw Network",
      description: "Phát triển và bảo trì hệ thống bot tự động tương tác mạng xã hội, cào dữ liệu, quản lý hàng ngàn VPS/Proxy phục vụ cho chiến dịch Marketing toàn cầu. Có kinh nghiệm bypass Cloudflare là lợi thế.",
      salary: "25M - 45M VND",
      location: "Hồ Chí Minh / Hybrid",
      tags: ["Python", "Node.js", "Puppeteer", "Docker", "Proxy"],
      createdAt: "Hôm qua",
    },
    {
      id: "job-3",
      title: "Growth Hacker Marketing (Crypto/MMO Niche)",
      companyName: "Fomo Labs Agency",
      description: "Thực thi các chiến dịch kéo traffic bẩn, traffic sạch cho landing page dự án, setup phễu chuyển đổi, chạy quảng cáo Facebook/Google/TikTok ngách BlackHat/GreyHat. Yêu cầu có kinh nghiệm thực chiến.",
      salary: "15M - 30M VND + % Hoa hồng",
      location: "Đà Nẵng / Onsite",
      tags: ["Growth Hacking", "Facebook Ads", "SEO", "Crypto", "Affiliate"],
      createdAt: "3 ngày trước",
    },
  ]);
  */

  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          throw new Error("Không thể tải danh sách việc làm.");
        }
        const data = await res.json();
        setJobs(data);
      } catch (err: any) {
        console.error("Lỗi khi tải jobs:", err);
        setError(err.message || "Không thể kết nối API.");
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Global Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left Sidebar */}
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />

          {/* Central content area depending on the active tab */}
          <div className="flex-1 space-y-6">
            {activeTab === "feed" && (
              <div className="space-y-6">
                {/* AI Matching recommendations */}
                <AiSuggest />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Social Feed + PostForm */}
                  <div className="lg:col-span-2 space-y-6">
                    <PostForm onAddPost={handlePostAdded} currentUser={currentUser} />
                    <PostList refreshTrigger={refreshTrigger} />
                  </div>

                  {/* Job Board mini widget */}
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
                      <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Xu hướng MMO hot nhất
                      </h3>
                      <ul className="space-y-3 text-xs">
                        <li className="flex justify-between items-center py-2 border-b border-slate-850">
                          <span className="text-slate-400">#BuildInPublic</span>
                          <span className="text-blue-400 font-semibold flex items-center">
                            +245% <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </li>
                        <li className="flex justify-between items-center py-2 border-b border-slate-850">
                          <span className="text-slate-400">#AIAutomation</span>
                          <span className="text-blue-400 font-semibold flex items-center">
                            +180% <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </li>
                        <li className="flex justify-between items-center py-2 border-b border-slate-850">
                          <span className="text-slate-400">#NextjsAppRouter</span>
                          <span className="text-blue-400 font-semibold flex items-center">
                            +95% <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </li>
                        <li className="flex justify-between items-center py-2">
                          <span className="text-slate-400">#CryptoAffiliate</span>
                          <span className="text-blue-400 font-semibold flex items-center">
                            +120% <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Quick Jobs list preview */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 backdrop-blur-md">
                      <h3 className="text-sm font-bold text-slate-200 mb-4">Việc làm mới ứng tuyển nhanh</h3>
                      <div className="space-y-3">
                        {/*
                        {jobs.slice(0, 2).map((job) => (
                          <div key={job.id} className="group cursor-pointer">
                            <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                              {job.title}
                            </p>
                            <div className="flex items-center justify-between text-3xs text-slate-400 mt-1">
                              <span>{job.companyName}</span>
                              <span className="text-emerald-400 font-semibold">{job.salary}</span>
                            </div>
                          </div>
                        ))}
                        */}

                        {loading ? (
                          <div className="space-y-3 animate-pulse">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div key={n} className="space-y-2">
                                <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                                <div className="flex justify-between">
                                  <div className="h-2 bg-slate-850 rounded w-1/3"></div>
                                  <div className="h-2 bg-slate-850 rounded w-1/4"></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : error ? (
                          <p className="text-xs text-rose-450">Lỗi tải danh sách việc làm.</p>
                        ) : jobs.length === 0 ? (
                          <p className="text-xs text-slate-500">Chưa có việc làm nào.</p>
                        ) : (
                          jobs.slice(0, 6).map((job) => (
                            <div key={job.id} className="group cursor-pointer">
                              <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                                {job.title}
                              </p>
                              <div className="flex items-center justify-between text-3xs text-slate-400 mt-1">
                                <span>{job.companyName}</span>
                                <span className="text-emerald-400 font-semibold">{job.salary}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <button
                        onClick={() => setActiveTab("jobs")}
                        className="w-full mt-4 rounded-xl border border-slate-800 bg-slate-950/40 py-2 text-center text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                      >
                        Xem tất cả việc làm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "jobs" && (
              <div className="space-y-6">
                <JobBoard jobs={jobs} />
              </div>
            )}

            {activeTab === "tools" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-8 backdrop-blur-md text-center max-w-2xl mx-auto my-8">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-blue-500 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">Marketing Tools Hub</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Khu vực tổng hợp và chia sẻ các công cụ tự động hóa SEO, Buff tương tác, cào dữ liệu, quảng quản lý chiến dịch quảng cáo và các tool nuôi nick được khuyên dùng nhất bởi cộng đồng MMO.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-left">
                  <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 hover:border-blue-500/30 transition-all cursor-pointer">
                    <span className="flex items-center gap-2 font-semibold text-slate-200 text-sm">
                      <Target className="h-4 w-4 text-indigo-400" />
                      SEO Rank Checker
                    </span>
                    <p className="text-2xs text-slate-500 mt-1">Theo dõi thứ hạng từ khóa trên Google tự động theo thời gian thực.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 hover:border-blue-500/30 transition-all cursor-pointer">
                    <span className="flex items-center gap-2 font-semibold text-slate-200 text-sm">
                      <Users className="h-4 w-4 text-purple-400" />
                      Social Lead Finder
                    </span>
                    <p className="text-2xs text-slate-500 mt-1">Quét nhóm, thu thập thông tin khách hàng tiềm năng trên các mạng xã hội.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hr" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-8 backdrop-blur-md text-center max-w-2xl mx-auto my-8 space-y-6">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Users className="h-6 w-6 text-indigo-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-100 flex items-center gap-2 justify-center">
                    <span>🔥</span> BitPaw Swipe
                  </h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Trải nghiệm tính năng tuyển dụng cực kỳ độc đáo theo phong cách BitPaw Swipe. Xem thông tin hồ sơ ứng viên nhanh chóng, quẹt trái để bỏ qua, quẹt phải để liên hệ phỏng vấn trực tiếp!
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href="/candidates"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs px-6 py-3 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Bắt đầu quẹt tìm kiếm đối tác ngay <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-650">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
    </div>
  );
}
