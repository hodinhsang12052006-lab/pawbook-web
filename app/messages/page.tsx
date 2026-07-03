"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import { Send, User, Search, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

interface UserType {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  bio?: string | null;
}

interface MessageType {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: UserType;
  receiver: UserType;
}

function MessengerContent() {
  const searchParams = useSearchParams();
  const searchUserId = searchParams.get("userId");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePartner, setActivePartner] = useState<UserType | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session & current user ID
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          setCurrentUser(session.user);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    }
    loadSession();
  }, []);

  // Fetch messages and users list from DB
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch("/api/messages");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách cuộc trò chuyện. Hãy đăng nhập trước.");
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setSystemUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto poll messages every 4 seconds for real-time simulation
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Auto select active partner from search query parameter (?userId=XXXX)
  useEffect(() => {
    if (systemUsers.length > 0 && searchUserId && !activePartner) {
      const partner = systemUsers.find((u) => u.id === searchUserId);
      if (partner) {
        setActivePartner(partner);
      }
    }
  }, [systemUsers, searchUserId, activePartner]);

  // Scroll to chat log bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activePartner]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartner || !messageText.trim() || sending) return;

    setSending(true);
    const content = messageText.trim();
    setMessageText("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverId: activePartner.id,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gửi tin nhắn thất bại.");
      } else {
        // Optimistic local state update
        setMessages((prev) => [...prev, data]);
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    } finally {
      setSending(false);
    }
  };

  // Group chat partners by unique active logs
  const getChatPartners = () => {
    if (!currentUser) return [];

    const partnersMap = new Map<string, UserType>();

    // Add users we have messages with
    messages.forEach((msg) => {
      const partner = msg.senderId === currentUser.id ? msg.receiver : msg.sender;
      if (partner && partner.id !== currentUser.id) {
        partnersMap.set(partner.id, partner);
      }
    });

    // If query ?userId=XXXX is not in active chats, add them to list
    if (searchUserId && !partnersMap.has(searchUserId)) {
      const targetUser = systemUsers.find((u) => u.id === searchUserId);
      if (targetUser) {
        partnersMap.set(targetUser.id, targetUser);
      }
    }

    const partners = Array.from(partnersMap.values());

    // Filter by search bar query
    return partners.filter((p) =>
      p.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  };

  // Fetch messages belonging strictly to the selected chat conversation
  const getConversationMessages = () => {
    if (!activePartner || !currentUser) return [];
    return messages.filter(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === activePartner.id) ||
        (msg.senderId === activePartner.id && msg.receiverId === currentUser.id)
    );
  };

  const chatPartners = getChatPartners();
  const activeConversation = getConversationMessages();

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang khởi tạo khung chat...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 space-y-4">
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-slate-800 bg-slate-900/10 backdrop-blur-md overflow-hidden h-[calc(100vh-140px)] min-h-[500px]">
          
          {/* Left Column: Conversations Sidebar (4 cols) */}
          <div className="md:col-span-4 border-r border-slate-850 flex flex-col h-full bg-slate-950/20">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-850 space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-blue-500" />
                Trò chuyện trực tiếp
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm liên hệ..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Partners List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatPartners.length === 0 ? (
                <div className="text-center py-12 text-3xs text-slate-500">
                  Chưa có cuộc hội thoại nào. Nhấn Chat ở Job hoặc Cửa hàng để bắt đầu.
                </div>
              ) : (
                chatPartners.map((partner) => {
                  const isActive = activePartner?.id === partner.id;
                  const partnerAvatar = partner.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name)}&background=2563eb&color=ffffff&bold=true`;
                  return (
                    <div
                      key={partner.id}
                      onClick={() => setActivePartner(partner)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-blue-600/15 border border-blue-500/25 text-white"
                          : "hover:bg-slate-900/40 border border-transparent"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                        <img src={partnerAvatar} alt={partner.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-250 truncate">{partner.name}</p>
                        <p className="text-3xs text-slate-500 truncate leading-relaxed">
                          {partner.role} • {partner.bio || "Không có bio"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat window (8 cols) */}
          <div className="md:col-span-8 flex flex-col h-full bg-slate-950/10">
            {activePartner ? (
              <>
                {/* Active Partner Header */}
                <div className="p-4 border-b border-slate-850 bg-slate-950/30 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                    <img
                      src={activePartner.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.name)}&background=2563eb&color=ffffff&bold=true`}
                      alt={activePartner.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{activePartner.name}</h3>
                    <span className="inline-flex items-center rounded bg-slate-800 px-1 py-0.2 text-4xs font-medium text-slate-400">
                      {activePartner.role}
                    </span>
                  </div>
                </div>

                {/* Chat Message Logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeConversation.length === 0 ? (
                    <div className="text-center py-12 text-3xs text-slate-550">
                      Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn chào mừng phía dưới!
                    </div>
                  ) : (
                    activeConversation.map((msg) => {
                      const isSelf = msg.senderId === currentUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2`}
                        >
                          {!isSelf && (
                            <div className="h-6 w-6 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                              <img
                                src={activePartner.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.name)}&background=2563eb&color=ffffff&bold=true`}
                                alt={activePartner.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2 text-xs leading-relaxed max-w-[70%] break-words ${
                              isSelf
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-slate-900 border border-slate-850 text-slate-200 rounded-bl-none"
                            }`}
                          >
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Send Message Form */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-slate-850 bg-slate-950/20 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                    placeholder="Viết tin nhắn phản hồi, chốt deal..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 transition-all duration-200"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <MessageSquare className="h-10 w-10 text-slate-650" />
                <div>
                  <p className="text-xs font-bold text-slate-300">Chọn cuộc trò chuyện</p>
                  <p className="text-3xs text-slate-500 mt-1 max-w-[280px]">
                    Hãy chọn một liên hệ từ danh sách bên trái hoặc truy cập vào một tin tuyển dụng/gian hàng dịch vụ để kết nối trực tiếp.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MessengerPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang khởi tạo khung chat...</p>
        </main>
      </div>
    }>
      <MessengerContent />
    </Suspense>
  );
}
