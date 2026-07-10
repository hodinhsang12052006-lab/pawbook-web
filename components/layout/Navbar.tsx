"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Upload, Bell, MessageSquare, Menu, Check, Trash2, ShieldAlert, Coins, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";

interface NotificationType {
  id: string;
  title?: string | null;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export default function Navbar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [searchResults, setSearchResults] = useState<{
    users: any[];
    jobs: any[];
    services: any[];
  } | null>(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Auto poll notifications every 30 seconds for live match updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        setLoadingSession(true);
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user?.id) {
            const userRes = await fetch(`/api/profile?id=${session.user.id}`);
            if (userRes.ok) {
              const userData = await userRes.json();
              setSessionUser(userData);
              return;
            }
          }
          setSessionUser(session?.user || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSession(false);
      }
    }
    loadSession();

    window.addEventListener("profile-updated", loadSession);
    return () => window.removeEventListener("profile-updated", loadSession);
  }, []);

  useEffect(() => {
    if (!sessionUser?.id) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `user-${sessionUser.id}`;
    const channel = pusher.subscribe(channelName);

    // Listen to new-booking
    channel.bind("new-booking", (data: any) => {
      toast.success(`🔔 Bạn có một yêu cầu đặt dịch vụ mới!`);
      fetchNotifications();
    });

    // Listen to booking-updated
    channel.bind("booking-updated", (data: any) => {
      toast.success(`✅ Đơn hàng của bạn đã được nhận!`);
      fetchNotifications();
    });

    return () => {
      channel.unbind("new-booking");
      channel.unbind("booking-updated");
      pusher.unsubscribe(channelName);
    };
  }, [sessionUser]);

  // Global search suggestions debounce effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowSearchSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowSearchSuggestions(true);
        }
      } catch (err) {
        console.error("Failed to query global search:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
  };

  const handleUploadCV = () => {
    router.push("/profile");
  };

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        if (link) {
          router.push(link);
          setShowDropdown(false);
        }
      }
    } catch (err) {
      console.error("Error reading notification:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAll: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        toast.success("Đã đánh dấu đọc tất cả thông báo.");
      }
    } catch (err) {
      console.error("Error reading all notifications:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const userAvatar = sessionUser?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo & Brand */}
        <div
          onClick={() => router.push("/")}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/10 p-0.5 shadow-lg shadow-blue-500/10">
            <img
              src="/cho1.jpg"
              alt="PawBook Logo"
              className="h-full w-full object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100&auto=format&fit=crop&q=80";
              }}
            />
          </div>
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-xl font-bold tracking-wider text-transparent">
            PawBook
          </span>
        </div>

        {/* Center: Search Bar with Suggestions */}
        <div ref={searchContainerRef} className="hidden max-w-md flex-1 px-4 md:block lg:max-w-lg relative">
          <form
            onSubmit={handleSearch}
            className="w-full"
          >
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <input
                type="search"
                placeholder="Tìm kiếm bài viết, việc làm, ứng viên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-full border border-slate-800 bg-slate-900/60 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all duration-200"
              />
            </div>
          </form>

          {showSearchSuggestions && searchResults && (
            <div className="absolute top-12 left-4 right-4 bg-[#090e1c]/95 border border-slate-800 rounded-2xl p-4 shadow-2xl z-[999] backdrop-blur-md space-y-3 max-h-96 overflow-y-auto custom-scrollbar animate-fadeIn">
              
              {/* 1. Users Suggestion Section */}
              {searchResults.users.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
                    <span>👥 Người dùng</span>
                  </p>
                  <div className="space-y-1">
                    {searchResults.users.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          router.push(`/profile/${u.id}`);
                          setSearchQuery("");
                          setShowSearchSuggestions(false);
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-slate-900/60 transition-colors animate-fadeIn"
                      >
                        <img
                          src={u.avatarUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100&auto=format&fit=crop&q=80"}
                          alt={u.name}
                          className="h-7 w-7 rounded-full object-cover border border-slate-800"
                        />
                        <div className="min-w-0 flex-1 text-[11px]">
                          <p className="font-bold text-slate-200 truncate">{u.name}</p>
                          <p className="text-slate-500 truncate text-[10px]">{u.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Jobs Suggestion Section */}
              {searchResults.jobs.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-850/50 pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
                    <span>💼 Tin tuyển dụng</span>
                  </p>
                  <div className="space-y-1">
                    {searchResults.jobs.map((j) => (
                      <div
                        key={j.id}
                        onClick={() => {
                          router.push(`/jobs/${j.id}`);
                          setSearchQuery("");
                          setShowSearchSuggestions(false);
                        }}
                        className="p-2 rounded-xl cursor-pointer hover:bg-slate-900/60 transition-colors text-[11px] animate-fadeIn"
                      >
                        <p className="font-bold text-slate-200 truncate">{j.title}</p>
                        <p className="text-slate-500 truncate text-[10px]">{j.companyName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Services Suggestion Section */}
              {searchResults.services.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-850/50 pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
                    <span>🏪 Dịch vụ</span>
                  </p>
                  <div className="space-y-1">
                    {searchResults.services.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          router.push(`/services/${s.id}`);
                          setSearchQuery("");
                          setShowSearchSuggestions(false);
                        }}
                        className="p-2 rounded-xl cursor-pointer hover:bg-slate-900/60 transition-colors text-[11px] flex justify-between items-center animate-fadeIn"
                      >
                        <p className="font-bold text-slate-200 truncate pr-2">{s.name}</p>
                        {s.priceRange && <span className="text-emerald-400 font-bold text-[10px] flex-shrink-0">{s.priceRange}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.users.length === 0 && searchResults.jobs.length === 0 && searchResults.services.length === 0 && (
                <p className="text-center py-4 text-slate-500 text-[10px] italic">Không tìm thấy kết quả phù hợp.</p>
              )}

            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4">
          {loadingSession ? (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-800 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-slate-800"></div>
              <div className="h-3 w-16 bg-slate-800 rounded hidden md:block"></div>
            </div>
          ) : sessionUser ? (
            <>
              <button
                onClick={() => router.push("/jobs/create")}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-650 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-550 transition-all duration-200 cursor-pointer"
                title="Đăng tin tuyển dụng"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Đăng tin</span>
              </button>

              <button
                onClick={handleUploadCV}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-650 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-550 transition-all duration-200 cursor-pointer"
                title="Tải lên hồ sơ CV"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:inline">Upload CV</span>
              </button>

              <div className="flex items-center gap-1 sm:gap-2 border-l border-slate-850 pl-2 sm:pl-4 relative">
                {/* Bell trigger */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="relative rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                </button>

                {/* Notification Dropdown list */}
                {showDropdown && (
                  <div className="absolute right-0 top-11 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl z-50 backdrop-blur-md animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
                      <h4 className="text-xs font-bold text-slate-200">Thông báo ({unreadCount})</h4>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-4xs font-semibold text-blue-400 hover:underline"
                        >
                          Đọc tất cả
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-850/40">
                      {notifications.length === 0 ? (
                        <p className="text-center py-6 text-3xs text-slate-500">Chưa có thông báo nào.</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif.id, notif.link)}
                            className={`pt-2 flex flex-col gap-1 cursor-pointer transition-colors ${
                              notif.isRead ? "opacity-60" : "hover:bg-slate-900/40"
                            }`}
                          >
                            {notif.title && (
                              <p className="text-[10px] font-bold text-slate-250 flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-blue-500 inline-block"></span>
                                {notif.title}
                              </p>
                            )}
                            <p className="text-3xs leading-relaxed text-slate-350">{notif.message}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-4xs text-slate-550">{formatTime(notif.createdAt)}</span>
                              {!notif.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Wallet Quick Access */}
                <button
                  onClick={() => router.push("/wallet")}
                  className="rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
                  title="Ví PawCoin"
                >
                  <Coins className="h-4.5 w-4.5 text-amber-500 fill-amber-500/10" />
                </button>

                <button 
                  onClick={() => router.push("/messages")}
                  className="rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
                  title="Messenger"
                >
                  <MessageSquare className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 border-l border-slate-850 pl-2 sm:pl-4">
                <div
                  onClick={() => router.push("/profile")}
                  className="h-8 w-8 overflow-hidden rounded-full border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <img
                    src={userAvatar}
                    alt={sessionUser.name || "User Avatar"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span 
                  onClick={() => router.push("/profile")}
                  className="hidden lg:inline text-xs font-semibold text-slate-200 cursor-pointer hover:text-white transition-colors"
                >
                  {sessionUser.name}
                </span>
                <button
                  onClick={() => router.push("/profile")}
                  className="hidden xl:inline-flex items-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition-all cursor-pointer"
                >
                  Trang cá nhân
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/auth/login")}
                className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                Đăng nhập
              </button>
              <button
                onClick={() => router.push("/auth/register")}
                className="rounded-full bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer"
              >
                Đăng ký
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
