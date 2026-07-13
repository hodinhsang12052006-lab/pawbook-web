"use client";

import React, { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import PostForm from "@/components/feed/PostForm";
import PostList from "@/components/feed/PostList";
import JobBoard, { JobType } from "@/components/jobs/JobBoard";
import { Sparkles, ArrowUpRight, Zap, Target, Users } from "lucide-react";
import AiSuggest from "@/components/jobs/AiSuggest";

interface HomeContentProps {
  initialUser: any;
  initialJobs: JobType[];
}

export default function HomeContent({ initialUser, initialJobs }: HomeContentProps) {
  const [activeTab, setActiveTab] = useState("feed");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser] = useState<any>(initialUser);
  const [jobs] = useState<JobType[]>(initialJobs);

  const handlePostAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

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
                      <h3 className="text-sm font-bold text-slate-200 mb-4">🚀 Job MMO / Web3 Tuyển Dụng</h3>
                      <div className="space-y-3">
                        {[
                          {
                            id: "mmo-job-1",
                            title: "Cày Airdrop/Retroactive hệ ZkSync",
                            companyName: "Airdrop Hunters Hub",
                            location: "Remote / Tự do",
                            salary: "10M - 15M"
                          },
                          {
                            id: "mmo-job-2",
                            title: "Quản lý Cộng đồng (CM) Group Crypto Telegram",
                            companyName: "Crypto Global Community",
                            location: "Kênh Discord/Tele",
                            salary: "500$"
                          },
                          {
                            id: "mmo-job-3",
                            title: "Code Tool Auto Checkout/Bypass Cloudflare",
                            companyName: "BitPaw Tech Labs",
                            location: "Remote",
                            salary: "20M - 35M"
                          },
                          {
                            id: "mmo-job-4",
                            title: "Tuyển 5 anh em chạy Node Validator dự án mới",
                            companyName: "Alpha Node Team",
                            location: "Đội nhóm MMO",
                            salary: "Thỏa thuận"
                          },
                          {
                            id: "mmo-job-5",
                            title: "KOC/KOL Affiliate Marketing mảng Tài chính",
                            companyName: "FinNetwork Agency",
                            location: "TikTok/X",
                            salary: "Hoa hồng"
                          }
                        ].map((job) => (
                          <div
                            key={job.id}
                            onClick={() => setActiveTab("jobs")}
                            className="group flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer border border-transparent hover:border-slate-700"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-200 line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                                {job.title}
                              </h4>
                              <p className="text-4xs text-slate-400 mt-1 truncate font-semibold uppercase tracking-wider">
                                {job.companyName} • {job.location}
                              </p>
                            </div>
                            <div className="flex-shrink-0 pt-0.5">
                              <span className="inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-450 text-[10px] font-extrabold rounded-md whitespace-nowrap">
                                {job.salary}
                              </span>
                            </div>
                          </div>
                        ))}
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
                  Khu vực tổng hợp và chia sẻ các công cụ tự động hóa SEO, Buff tương tác, cào dữ liệu, quản lý chiến dịch quảng cáo và các tool nuôi nick được khuyên dùng nhất bởi cộng đồng MMO.
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
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-655">
        <p>© 2026 PawBook Platform. Build with passion for IT & MMO communities.</p>
      </footer>
    </div>
  );
}
