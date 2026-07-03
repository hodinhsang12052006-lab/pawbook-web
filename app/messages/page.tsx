"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import { Send, User, Search, MessageSquare, Loader2, AlertCircle, Plus, Users, Image, Video, Smile, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";
import dynamicImport from "next/dynamic";

const EmojiPicker = dynamicImport(() => import("emoji-picker-react"), { ssr: false });

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
  type: string; // TEXT, IMAGE, VIDEO
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: UserType;
  receiver: UserType;
  conversationId?: string;
}

interface ConversationType {
  id: string;
  isGroup: boolean;
  name?: string | null;
  createdAt: string;
  participants: UserType[];
  messages: any[];
}

function MessengerContent() {
  const searchParams = useSearchParams();
  const searchUserId = searchParams.get("userId");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeChat, setActiveChat] = useState<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    role: string;
    isGroup: boolean;
  } | null>(null);

  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Group chat creation states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Media & Selector states
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifsList, setGifsList] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch messages and conversations list from DB
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch("/api/messages");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách cuộc trò chuyện. Hãy đăng nhập trước.");
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setConversations(data.conversations || []);
      setSystemUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to real-time messages via Pusher
  useEffect(() => {
    if (!currentUser || !activeChat) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    let activeConversationId = "";
    if (activeChat.isGroup) {
      activeConversationId = activeChat.id;
    } else {
      activeConversationId = messages.find(
        (m) =>
          m.conversationId &&
          ((m.senderId === currentUser.id && m.receiverId === activeChat.id) ||
           (m.senderId === activeChat.id && m.receiverId === currentUser.id))
      )?.conversationId || "";
    }

    if (!activeConversationId) return;

    const channel = pusher.subscribe(activeConversationId);
    
    channel.bind("new-message", (newMessage: MessageType) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      pusher.unsubscribe(activeConversationId);
    };
  }, [activeChat, currentUser, messages]);

  // Auto select active partner from search query parameter (?userId=XXXX)
  useEffect(() => {
    if (systemUsers.length > 0 && searchUserId && !activeChat) {
      const partner = systemUsers.find((u) => u.id === searchUserId);
      if (partner) {
        setActiveChat({
          id: partner.id,
          name: partner.name,
          avatarUrl: partner.avatarUrl,
          role: partner.role,
          isGroup: false,
        });
      }
    }
  }, [systemUsers, searchUserId, activeChat]);

  // Scroll to chat log bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  // GIF Search Debouncer
  useEffect(() => {
    if (!showGifs) return;
    const fetchGifs = async () => {
      try {
        setLoadingGifs(true);
        const query = gifSearch.trim();
        const url = query
          ? `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=12`
          : `https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=12`;
        const res = await fetch(url);
        if (res.ok) {
          const payload = await res.json();
          setGifsList(payload.data || []);
        }
      } catch (err) {
        console.error("Giphy fetch error:", err);
      } finally {
        setLoadingGifs(false);
      }
    };
    
    const delayDebounce = setTimeout(() => {
      fetchGifs();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [gifSearch, showGifs]);

  const handleSendMessage = async (e: React.FormEvent | null, customContent?: string, customType?: string) => {
    if (e) e.preventDefault();
    if (!activeChat || sending) return;

    const content = customContent || messageText.trim();
    const type = customType || "TEXT";

    if (!content) return;
    if (!customContent) setMessageText("");

    setSending(true);
    setShowEmoji(false);
    setShowGifs(false);

    try {
      const bodyPayload: any = {
        content,
        type,
      };

      if (activeChat.isGroup) {
        bodyPayload.conversationId = activeChat.id;
      } else {
        // Check if we already have a conversation, otherwise let API find or create
        const existingConv = messages.find(
          (m) =>
            m.conversationId &&
            ((m.senderId === currentUser?.id && m.receiverId === activeChat.id) ||
             (m.senderId === activeChat.id && m.receiverId === currentUser?.id))
        )?.conversationId;

        if (existingConv) {
          bodyPayload.conversationId = existingConv;
        } else {
          bodyPayload.receiverId = activeChat.id;
        }
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gửi tin nhắn thất bại.");
      } else {
        setMessages((prev) => [...prev, data]);
        // Reload conversations to ensure group/chat lists stay updated
        loadData(true);
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.");
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File quá lớn (tối đa 10MB)");
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      toast.error("Chỉ chấp nhận tệp hình ảnh hoặc video.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Đang gửi tệp...");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gửi tệp thất bại.");
      } else {
        toast.success("Gửi tệp thành công!");
        await handleSendMessage(null, data.url, isVideo ? "VIDEO" : "IMAGE");
      }
    } catch (err) {
      toast.error("Lỗi tải tệp lên.");
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Vui lòng nhập tên nhóm.");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 thành viên.");
      return;
    }

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGroup: true,
          name: groupName.trim(),
          participantIds: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Tạo nhóm thất bại.");
      } else {
        toast.success("Tạo nhóm thành công!");
        setShowGroupModal(false);
        setGroupName("");
        setSelectedUserIds([]);
        await loadData(true);
        setActiveChat({
          id: data.id,
          name: data.name,
          role: "GROUP",
          isGroup: true,
        });
      }
    } catch (err) {
      toast.error("Lỗi kết nối.");
    }
  };

  // Build conversations for sidebar listing
  const getChatConversations = () => {
    if (!currentUser) return [];
    
    const list = [...conversations];

    // If query userId is set but there's no existing conversation with them, add a temp object
    if (searchUserId && !list.some(c => !c.isGroup && c.participants.some(p => p.id === searchUserId))) {
      const targetUser = systemUsers.find(u => u.id === searchUserId);
      if (targetUser) {
        list.unshift({
          id: `temp-${targetUser.id}`,
          isGroup: false,
          name: null,
          createdAt: new Date().toISOString(),
          participants: [currentUser, targetUser],
          messages: [],
        });
      }
    }

    return list.filter((c) => {
      if (c.isGroup) {
        return c.name?.toLowerCase().includes(searchFilter.toLowerCase());
      } else {
        const partner = c.participants.find((p) => p.id !== currentUser.id);
        return partner?.name.toLowerCase().includes(searchFilter.toLowerCase());
      }
    });
  };

  // Get active messages list
  const getConversationMessages = () => {
    if (!activeChat || !currentUser) return [];
    if (activeChat.isGroup) {
      return messages.filter((msg) => msg.conversationId === activeChat.id);
    }
    return messages.filter(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === activeChat.id) ||
        (msg.senderId === activeChat.id && msg.receiverId === currentUser.id)
    );
  };

  const chatConversations = getChatConversations();
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
      <Toaster position="top-center" />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-slate-800 bg-slate-900/10 backdrop-blur-md overflow-hidden h-[calc(100vh-140px)] min-h-[500px]">
          
          {/* Left Column: Conversations Sidebar (4 cols) */}
          <div className="md:col-span-4 border-r border-slate-850 flex flex-col h-full bg-slate-950/20">
            {/* Search & Actions Header */}
            <div className="p-4 border-b border-slate-850 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <MessageSquare className="h-4.5 w-4.5 text-blue-500" />
                  Hộp thư Messenger
                </h2>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-2 py-1 text-4xs font-bold text-white transition-all"
                >
                  <Plus className="h-3 w-3" />
                  Tạo nhóm mới
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm hội thoại..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-550 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatConversations.length === 0 ? (
                <div className="text-center py-12 text-3xs text-slate-500">
                  Chưa có cuộc hội thoại nào. Nhấn Chat ở Job hoặc Cửa hàng để bắt đầu.
                </div>
              ) : (
                chatConversations.map((conv) => {
                  const isGroup = conv.isGroup;
                  const partner = isGroup ? null : conv.participants.find(p => p.id !== currentUser?.id);
                  const isTemp = conv.id.startsWith("temp-");

                  if (!isGroup && !partner) return null;

                  const isActive = activeChat?.id === (isGroup ? conv.id : partner!.id);
                  const displayName = isGroup ? (conv.name || "Nhóm trò chuyện") : partner!.name;
                  const displayBio = isGroup ? `${conv.participants.length} thành viên` : (partner!.role + " • " + (partner!.bio || "Không có bio"));
                  const avatarUrl = isGroup
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=ffffff&bold=true`
                    : (partner!.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=ffffff&bold=true`);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveChat({
                        id: isGroup ? conv.id : partner!.id,
                        name: displayName,
                        avatarUrl,
                        role: isGroup ? "GROUP" : partner!.role,
                        isGroup,
                      })}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-blue-600/15 border border-blue-500/25 text-white"
                          : "hover:bg-slate-900/40 border border-transparent"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 flex-shrink-0 flex items-center justify-center bg-slate-900">
                        {isGroup ? (
                          <Users className="h-4.5 w-4.5 text-indigo-400" />
                        ) : (
                          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-250 truncate">{displayName}</p>
                        <p className="text-3xs text-slate-500 truncate leading-relaxed">
                          {displayBio}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat window (8 cols) */}
          <div className="md:col-span-8 flex flex-col h-full bg-slate-950/10 relative">
            {activeChat ? (
              <>
                {/* Active Partner Header */}
                <div className="p-4 border-b border-slate-850 bg-slate-950/30 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-800 flex-shrink-0 flex items-center justify-center bg-slate-900">
                    {activeChat.isGroup ? (
                      <Users className="h-4.5 w-4.5 text-indigo-400" />
                    ) : (
                      <img
                        src={activeChat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.name)}&background=2563eb&color=ffffff&bold=true`}
                        alt={activeChat.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{activeChat.name}</h3>
                    <span className="inline-flex items-center rounded bg-slate-800 px-1 py-0.2 text-4xs font-medium text-slate-400">
                      {activeChat.role}
                    </span>
                  </div>
                </div>

                {/* Chat Message Logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeConversation.length === 0 ? (
                    <div className="text-center py-12 text-3xs text-slate-555">
                      Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn chào mừng phía dưới!
                    </div>
                  ) : (
                    activeConversation.map((msg) => {
                      const isSelf = msg.senderId === currentUser?.id;
                      const senderAvatar = msg.sender.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender.name)}&background=2563eb&color=ffffff&bold=true`;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2`}
                        >
                          {!isSelf && (
                            <div className="h-6 w-6 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                              <img
                                src={senderAvatar}
                                alt={msg.sender.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[70%]">
                            {activeChat.isGroup && !isSelf && (
                              <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender.name}</span>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words ${
                                isSelf
                                  ? "bg-blue-600 text-white rounded-br-none"
                                  : "bg-slate-900 border border-slate-850 text-slate-200 rounded-bl-none"
                              }`}
                            >
                              {msg.type === "IMAGE" ? (
                                <img src={msg.content} alt="Media Attachment" className="max-w-full rounded-lg object-contain max-h-60" />
                              ) : msg.type === "VIDEO" ? (
                                <video src={msg.content} controls className="max-w-full rounded-lg max-h-60" poster="/cho1.jpg" />
                              ) : (
                                <p>{msg.content}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Media Selectors Panel */}
                {(showEmoji || showGifs) && (
                  <div className="absolute bottom-16 left-4 right-4 bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl z-20 h-80 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
                      <span className="text-2xs font-bold text-slate-300">
                        {showEmoji && "Chọn biểu tượng cảm xúc Emoji"}
                        {showGifs && "Tìm kiếm ảnh động GIPHY"}
                      </span>
                      <button
                        onClick={() => {
                          setShowEmoji(false);
                          setShowGifs(false);
                        }}
                        className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {showEmoji && (
                        <EmojiPicker
                          onEmojiClick={(emojiData) => {
                            setMessageText((prev) => prev + emojiData.emoji);
                            setShowEmoji(false);
                          }}
                          width="100%"
                          height="100%"
                        />
                      )}

                      {showGifs && (
                        <div className="space-y-3 h-full flex flex-col">
                          <input
                            type="text"
                            placeholder="Nhập từ khóa tìm kiếm GIF..."
                            value={gifSearch}
                            onChange={(e) => setGifSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-550 focus:outline-none"
                          />
                          {loadingGifs ? (
                            <div className="flex-1 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2">
                              {gifsList.map((gif) => (
                                <img
                                  key={gif.id}
                                  src={gif.images.fixed_height_small.url}
                                  alt={gif.title}
                                  onClick={() => handleSendMessage(null, gif.images.original.url, "IMAGE")}
                                  className="h-20 w-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Input Send Message Form */}
                <form
                  onSubmit={(e) => handleSendMessage(e)}
                  className="p-4 border-t border-slate-850 bg-slate-950/20 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {/* Emoji Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmoji(!showEmoji);
                        setShowGifs(false);
                      }}
                      className={`p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all ${showEmoji ? "bg-slate-900 text-blue-400" : ""}`}
                      title="Chèn biểu tượng Emoji"
                    >
                      <Smile className="h-4.5 w-4.5" />
                    </button>

                    {/* GIF Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowGifs(!showGifs);
                        setShowEmoji(false);
                      }}
                      className={`p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all ${showGifs ? "bg-slate-900 text-blue-400" : ""}`}
                      title="Chèn ảnh động GIF"
                    >
                      <span className="text-3xs font-extrabold tracking-wider border border-slate-500 rounded px-0.5">GIF</span>
                    </button>

                    {/* File Attach Trigger (Images / Videos) */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all"
                      title="Gửi hình ảnh hoặc video"
                    >
                      <Image className="h-4.5 w-4.5" />
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                  </div>

                  <div className="flex items-center gap-2">
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
                  </div>
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

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-blue-500" />
                Tạo nhóm trò chuyện mới
              </h3>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">TÊN NHÓM</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đội xe ôm Q1, Tổ thợ sửa..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-550 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">CHỌN THÀNH VIÊN</label>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl p-2 space-y-1.5 bg-slate-950/50">
                  {systemUsers.map((user) => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                          } else {
                            setSelectedUserIds(prev => [...prev, user.id]);
                          }
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=ffffff&bold=true`}
                            alt={user.name}
                            className="h-6.5 w-6.5 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <span className="block text-3xs font-bold text-slate-200 truncate">{user.name}</span>
                            <span className="block text-5xs text-slate-500 truncate">{user.role}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="h-3.5 w-3.5 rounded border-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setShowGroupModal(false)}
                className="rounded-lg px-4 py-2 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateGroup}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-3xs font-bold text-white transition-all"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}
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
