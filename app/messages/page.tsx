"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import { BitpawMiniApp } from "./BitpawMiniApp";
import {
  Send, User, Search, MessageSquare, Loader2, AlertCircle, Plus, Users,
  Image, Video, Smile, X, Lock, Phone, Paperclip, Mic, Zap, Reply, Share2, Info,
  MicOff, VideoOff, PhoneOff, Volume2, Clock, FileText, Cpu, Briefcase
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";


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
  type: string; // TEXT, IMAGE, VIDEO, STICKER
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

const MOCK_STICKERS = [
  { emoji: "🐶", label: "Cún Cười" },
  { emoji: "🐱", label: "Mèo Wow" },
  { emoji: "🚀", label: "Thăng Tiến" },
  { emoji: "💎", label: "VIP Deal" },
  { emoji: "💼", label: "Duyệt Công" },
  { emoji: "🚗", label: "Vận Chuyển" },
  { emoji: "🛠️", label: "Đang Tới" },
  { emoji: "🔥", label: "Hot Deal" },
  { emoji: "🎉", label: "Chốt Deal" },
  { emoji: "👍", label: "Cực Tốt" },
  { emoji: "❤️", label: "Yêu Thích" },
  { emoji: "⭐", label: "5 Sao" }
];

const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
  "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
  "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
  "✍️", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤝", "👏", "🙌",
  "👐", "🤲", "🙏", "💅", "🤳", "💪", "🦾", "🦿", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "🔥", "✨",
  "🌟", "⭐", "🎉", "🎈", "🚀", "💡", "💯", "💬", "🔒", "⚡"
];

const MOCK_GIFS = [
  { id: "mock-gif-1", title: "Cún Cười", images: { fixed_height_small: { url: "https://media.giphy.com/media/3ndwBmDYT6Wre/giphy.gif" }, original: { url: "https://media.giphy.com/media/3ndwBmDYT6Wre/giphy.gif" } } },
  { id: "mock-gif-2", title: "Mèo Wow", images: { fixed_height_small: { url: "https://media.giphy.com/media/vfkseZ45HkiIG9qnkU/giphy.gif" }, original: { url: "https://media.giphy.com/media/vfkseZ45HkiIG9qnkU/giphy.gif" } } },
  { id: "mock-gif-3", title: "Đồng ý", images: { fixed_height_small: { url: "https://media.giphy.com/media/l3q2lh5O3dxkoOkIU/giphy.gif" }, original: { url: "https://media.giphy.com/media/l3q2lh5O3dxkoOkIU/giphy.gif" } } },
  { id: "mock-gif-4", title: "Chúc mừng", images: { fixed_height_small: { url: "https://media.giphy.com/media/26tOZ42cX5t5gzVIyL/giphy.gif" }, original: { url: "https://media.giphy.com/media/26tOZ42cX5t5gzVIyL/giphy.gif" } } },
  { id: "mock-gif-5", title: "Đang làm việc", images: { fixed_height_small: { url: "https://media.giphy.com/media/3orifc88219cR1qDVC/giphy.gif" }, original: { url: "https://media.giphy.com/media/3orifc88219cR1qDVC/giphy.gif" } } },
  { id: "mock-gif-6", title: "Vẫy tay", images: { fixed_height_small: { url: "https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif" }, original: { url: "https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif" } } }
];

function MessengerContent() {
  const searchParams = useSearchParams();
  const searchUserId = searchParams.get("userId") || searchParams.get("to");

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
    isOnline: boolean;
    statusText: string;
    status?: string;
  } | null>(null);

  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Group chat creation states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupType, setGroupType] = useState("FUN");

  // Media & Selector states
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [gifSearch, setGifSearch] = useState("");
  const [gifsList, setGifsList] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Calling States (Calling UI Mockup)
  const [showCallingModal, setShowCallingModal] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callConnected, setCallConnected] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [jobStates, setJobStates] = useState<Record<string, 'OPEN' | 'ACCEPTED' | 'SYNCING' | 'COMPLETED'>>({});
  const [isMiniAppOpen, setIsMiniAppOpen] = useState(false);
  const [showSSOModal, setShowSSOModal] = useState(false);
  const [ssoStep, setSSOStep] = useState(1);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [showJoinWorkspaceModal, setShowJoinWorkspaceModal] = useState(false);
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [joiningWorkspace, setJoiningWorkspace] = useState(false);

  // Sidebar Tabs State: chat (Trò chuyện) or contacts (Danh bạ / Lời mời)
  const [sidebarTab, setSidebarTab] = useState<"chat" | "contacts">("chat");

  // Local Chat Bubble Reactions State
  const [messageReactions, setMessageReactions] = useState<{ [messageId: string]: string[] }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTypeRef = useRef<"image" | "video" | "document" | "">("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState<any>(null);
  const [callerInfo, setCallerInfo] = useState<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const callerSignalRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  const activeChatRef = useRef(activeChat?.id);
  useEffect(() => {
    activeChatRef.current = activeChat?.id;
  }, [activeChat]);



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

  console.log("DEBUG: File page.tsx đã được load!");

  // 🚀 ĐẠI TU PUSHER: LUÔN LẮNG NGHE TRÊN KÊNH CÁ NHÂN
  useEffect(() => {
    if (!currentUser) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = currentUser.id; // Kênh vĩnh cửu của User
    console.log("📡 Pusher đã bật ống nghe tại kênh cá nhân:", channelName);
    const channel = pusher.subscribe(channelName);
    
    const messageHandler = (newMessage: any) => {
      console.log("📥 TỔNG ĐÀI BÁO TIN:", newMessage);
      // BỘ LỌC UI: Chỉ hiển thị nếu tin nhắn thuộc về màn hình đang mở
      if (
        activeChatRef.current === newMessage.senderId || 
        activeChatRef.current === newMessage.receiverId ||
        (newMessage.conversationId && activeChatRef.current === newMessage.conversationId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      } else {
        console.log("Tin nhắn từ hộp thoại khác, đang chạy ngầm...");
      }
    };

    channel.bind("new-message", messageHandler);

    return () => {
      channel.unbind("new-message", messageHandler);
      pusher.unsubscribe(channelName);
    };
  }, [currentUser]); // Khóa dependency: Chỉ chạy 1 lần duy nhất khi có user

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
          isOnline: true,
          statusText: "Đang hoạt động"
        });
      }
    }
  }, [systemUsers, searchUserId, activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to chat log bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChat, isTyping]);

  // Calling seconds timer hook
  useEffect(() => {
    let interval: any;
    if (showCallingModal && callConnected) {
      interval = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(interval);
  }, [showCallingModal, callConnected]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const handleStartCall = async (type: "audio" | "video") => {
    if (!activeChat) return;
    try {
      setCallType(type);
      setShowCallingModal(true);
      setCallConnected(false); // Start caller in Calling/Ringing state, NOT connected yet!

      const isVideoCall = type === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall ? { width: 640, height: 480 } : false
      });
      localStreamRef.current = stream;

      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 300);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const streams = event.streams;
        if (remoteVideoRef.current && streams[0]) {
          remoteVideoRef.current.srcObject = streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Call feature disabled on socket
      toast.error("Tính năng gọi qua socket tạm thời bị vô hiệu hóa.");

      console.log(`[Socket] Call offer emitted to receiver ${activeChat.id}`);

    } catch (err: any) {
      console.error("Failed to start WebRTC call:", err);
      toast.error("Không thể mở Camera/Microphone: " + err.message);
      setShowCallingModal(false);
    }
  };

  const handleAcceptCall = async () => {
    try {
      const isVideoCall = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall ? { width: 640, height: 480 } : false
      });
      localStreamRef.current = stream;

      setCallConnected(true);

      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }, 300);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const streams = event.streams;
        if (remoteVideoRef.current && streams[0]) {
          remoteVideoRef.current.srcObject = streams[0];
        }
      };

      const activeSignal = callerSignalRef.current || callerSignal;

      // Verification of input signaling data to prevent crashed sessions
      if (!activeSignal) {
        console.error("Mất tín hiệu Offer!");
        toast.error("Thiếu thông tin kết nối WebRTC (Offer).");
        return;
      }

      // Đã CHUẨN HÓA thứ tự async/await của luồng nạp Offer -> tạo Answer
      await pc.setRemoteDescription(new RTCSessionDescription(activeSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Answer calls signal emitters disabled on socket

      console.log(`[Socket] Call answer accepted and returned to caller ${callerInfo?.id}`);

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      toast.success("Cuộc gọi đã kết nối thành công! 📞");

    } catch (err: any) {
      console.error("WebRTC accept call connection error:", err);
      toast.error("Lỗi thiết bị: " + (err.message || "Không thể kết nối."));
      setCallConnected(true);
    }
  };

  const handleEndCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setShowCallingModal(false);
    setCallConnected(false);
    toast.success(`Cuộc gọi đã kết thúc. Thời lượng: ${formatTimer(callSeconds)}`);
  };

  // GIF Search Debouncer with local MOCK fallbacks
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
          setGifsList(payload.data && payload.data.length > 0 ? payload.data : MOCK_GIFS);
        } else {
          setGifsList(MOCK_GIFS);
        }
      } catch (err) {
        console.error("Giphy fetch error:", err);
        setGifsList(MOCK_GIFS);
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
    if (!activeChat) return;

    const content = customContent || messageText.trim();
    const type = customType || "TEXT";

    if (!content) return;

    if (!customContent) setMessageText("");

    setShowEmoji(false);
    setShowGifs(false);

    const bodyPayload: any = {
      content,
      type,
    };

    if (activeChat.isGroup) {
      bodyPayload.conversationId = activeChat.id;
    } else {
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

    const tempId = `optimistic-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content,
      type,
      senderId: currentUser?.id || "",
      receiverId: activeChat.id,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser?.id || "",
        name: currentUser?.name || "Bạn",
        avatarUrl: currentUser?.avatarUrl || null,
        role: currentUser?.role || "USER",
      },
      receiver: {
        id: activeChat.id,
        name: activeChat.name,
        role: activeChat.role || "USER",
      },
      conversationId: bodyPayload.conversationId || "",
    };

    // 1. Cập nhật UI lập tức (Optimistic UI)
    setMessages((prev) => [...prev, tempMessage]);



    // 3. API lưu Database chạy ngầm
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        // Nếu API lỗi, xóa tin nhắn ảo đi
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(data.error || "Gửi tin nhắn thất bại.");
      } else {
        // Cập nhật lại ID chuẩn từ DB
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Lỗi kết nối mạng.");
    }
  };

  const handleSyncContacts = () => {
    setSyncingContacts(true);
    setTimeout(() => {
      setSyncingContacts(false);
      toast.success("Đồng bộ danh bạ hoàn tất! Đã cập nhật trạng thái liên hệ.");
    }, 2000);
  };

  const handleJoinWorkspace = () => {
    if (!workspaceCode.trim()) {
      toast.error("Vui lòng nhập mã doanh nghiệp!");
      return;
    }
    setJoiningWorkspace(true);
    setTimeout(() => {
      setJoiningWorkspace(false);
      setShowJoinWorkspaceModal(false);
      setWorkspaceCode("");
      toast("⏳ Đã gửi yêu cầu! Vui lòng chờ Quản lý công ty phê duyệt để tham gia vào nhóm nội bộ.", {
        icon: "⏳",
        style: {
          background: "#1e293b",
          border: "1px solid #d97706",
          color: "#f59e0b",
          fontSize: "11px",
          fontWeight: "bold",
          maxWidth: "350px"
        }
      });
    }, 1500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("video/")) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("❌ Kích thước video vượt quá 50MB. Vui lòng tải lên file nhẹ hơn!");
        return;
      }
    } else {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File quá lớn (tối đa 10MB)");
        return;
      }
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isDoc = file.type.includes("msword") || file.type.includes("officedocument");

    if (!isImage && !isVideo && !isPdf && !isDoc) {
      toast.error("Chỉ chấp nhận tệp hình ảnh, video, PDF hoặc Word.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Đang gửi tệp tin đính kèm...");
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
        await handleSendMessage(null, data.url, isVideo ? "VIDEO" : (isImage ? "IMAGE" : "TEXT"));
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName.trim(),
          isGroup: true,
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
        loadData();
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng khi tạo nhóm.");
    }
  };

  const handleAddReaction = (msgId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const existing = prev[msgId] || [];
      if (existing.includes(emoji)) {
        return {
          ...prev,
          [msgId]: existing.filter((e) => e !== emoji)
        };
      }
      return {
        ...prev,
        [msgId]: [...existing, emoji]
      };
    });
  };

  const getChatConversations = () => {
    if (!currentUser) return { dbList: [] };

    let list = [...conversations];

    const adminIndex = list.findIndex(c => !c.isGroup && c.participants.some(p => p.id === "10000000001"));
    let adminConv: any = null;

    if (adminIndex > -1) {
      adminConv = list.splice(adminIndex, 1)[0];
    } else if (currentUser.id !== "10000000001") {
      const adminUser = systemUsers.find(u => u.id === "10000000001") || {
        id: "10000000001",
        name: "BITPAWOS (Admin)",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        role: "ADMIN",
        bio: "Tài khoản quản trị viên tối cao của hệ thống BitPaw."
      };
      adminConv = {
        id: "temp-10000000001",
        isGroup: false,
        name: null,
        createdAt: new Date().toISOString(),
        participants: [currentUser, adminUser],
        messages: [],
      };
    }

    if (searchUserId && searchUserId !== "10000000001" && !list.some(c => !c.isGroup && c.participants.some(p => p.id === searchUserId))) {
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

    const filteredDbList = list.filter((c) => {
      if (c.isGroup) {
        return c.name?.toLowerCase().includes(searchFilter.toLowerCase());
      } else {
        const partner = c.participants.find((p) => p.id !== currentUser.id);
        return partner?.name.toLowerCase().includes(searchFilter.toLowerCase());
      }
    });

    if (adminConv) {
      filteredDbList.unshift(adminConv);
    }

    return {
      dbList: filteredDbList
    };
  };

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

  const { dbList } = getChatConversations();
  const activeConversation = getConversationMessages();

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 animate-pulse">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang khởi tạo khu chat...</p>
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
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      <Navbar />
      <Toaster position="top-center" />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        
        @keyframes messageSlideIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .message-bounce-in {
          animation: messageSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes ringGlow {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.15;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        .calling-ring {
          animation: ringGlow 2s infinite ease-out;
        }
      `}</style>

      <main className="flex-1 flex overflow-hidden">

        {/* Left Sidebar */}
        <div className={`w-full md:w-[30%] border-r border-slate-850 flex flex-col h-full bg-slate-950/20 ${activeChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-slate-850 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-blue-500" />
                Hộp thư Messenger
              </h2>
              {sidebarTab === "chat" && (
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 px-3 py-1.5 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo nhóm mới
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/50 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setSidebarTab("chat")}
                className={`py-1.5 rounded-lg text-3xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${sidebarTab === "chat"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                  }`}
              >
                <span>💬</span> Trò chuyện
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("contacts")}
                className={`py-1.5 rounded-lg text-3xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${sidebarTab === "contacts"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                  }`}
              >
                <span>👥</span> Danh bạ / Lời mời
              </button>
            </div>

            {sidebarTab === "chat" && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm hội thoại..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-555 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {sidebarTab === "chat" ? (
              <>
                {dbList.length > 0 ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 mb-2">Hộp Thư Hệ Thống (Real-time)</p>
                    {dbList.map((conv) => {
                      const isGroup = conv.isGroup;
                      const partner = isGroup ? null : conv.participants.find(p => p.id !== currentUser?.id);

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
                            isOnline: true,
                            statusText: "Đang hoạt động"
                          })}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ease-in-out ${isActive
                              ? "bg-blue-600/15 border border-blue-500/25 text-white"
                              : "hover:bg-slate-900/40 border border-transparent"
                            }`}
                        >
                          <div className="relative flex-shrink-0">
                            <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                              {isGroup ? (
                                <Users className="h-5 w-5 text-indigo-400" />
                              ) : (
                                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                              )}
                            </div>
                            {!isGroup && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-255 truncate">{displayName}</p>
                            <p className="text-3xs text-slate-500 truncate leading-relaxed">
                              {displayBio}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 mt-8 animate-fadeIn">
                    <MessageSquare className="h-8 w-8 text-slate-700" />
                    <p className="text-3xs font-bold text-slate-400">Không có cuộc trò chuyện nào</p>
                    <p className="text-4xs text-slate-550 max-w-[200px] leading-relaxed">Hãy kết bạn trên Bảng tin để nhắn tin hoặc chọn một tin đăng để liên hệ.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 p-2 animate-fadeIn text-xs">
                <button
                  onClick={() => toast.success("Hiện tại chưa có lời mời kết bạn mới nào.")}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-850 transition-all cursor-pointer font-bold text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span>🔔</span> Lời mời kết bạn
                  </div>
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-5xs font-extrabold">0</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncContacts}
                  disabled={syncingContacts}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-98 transition-all cursor-pointer text-3xs disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {syncingContacts ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang quét danh bạ thiết bị...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Đồng bộ danh bạ điện thoại</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowJoinWorkspaceModal(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 font-extrabold shadow-md active:scale-98 transition-all cursor-pointer text-3xs"
                >
                  <span>🏢</span>
                  <span>Gia nhập Không gian Doanh Nghiệp</span>
                </button>

                <p className="text-[10px] uppercase tracking-wider text-slate-550 font-extrabold px-2 mt-2">Bạn bè & Đồng nghiệp ({contacts.length})</p>

                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 mt-4 border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                    <span className="text-xl animate-pulse">👥</span>
                    <p className="text-[10px] font-bold text-slate-400">Danh bạ trống</p>
                    <p className="text-[9px] text-slate-550 max-w-[200px] leading-relaxed">
                      Bạn chưa có cuộc trò chuyện nào. Hãy kết nối thêm bạn bè!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 overflow-y-auto max-h-[420px] custom-scrollbar">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => setActiveChat({
                          id: contact.id,
                          name: contact.name,
                          avatarUrl: contact.avatarUrl,
                          role: contact.role,
                          isGroup: false,
                          isOnline: true,
                          statusText: `Đang ở ${contact.location} • Cách bạn ${contact.distance}`,
                          status: contact.status
                        })}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-900/40 border border-transparent transition-all duration-300"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url(${contact.avatarUrl})` }} />
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${contact.status === "busy" ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-slate-200 truncate">{contact.name}</p>
                            {contact.isInternal && (
                              <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">
                                ✓ Nhân viên nội bộ
                              </span>
                            )}
                          </div>
                          <p className="text-3xs text-slate-450 truncate mt-0.5">{contact.role}</p>
                          <p className="text-4xs text-slate-500 flex items-center gap-0.5 mt-1 font-semibold">
                            <span>📍 Đang ở {contact.location}</span>
                            <span>•</span>
                            <span>Cách {contact.distance}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat window */}
        <div className={`flex-1 flex flex-col h-full bg-slate-900 relative ${activeChat ? "flex" : "hidden md:flex"}`}>
          {activeChat ? (
            <>
              {/* Active Partner Header */}
              <div className="p-4 border-b border-slate-855 bg-slate-950/30 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer mr-1 flex items-center gap-1.5 text-xs font-bold transition-all border border-slate-800"
                  >
                    ⬅️
                  </button>
                  <div className="relative flex-shrink-0">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                      {activeChat.isGroup ? (
                        <Users className="h-5 w-5 text-indigo-400" />
                      ) : (
                        <img
                          src={activeChat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.name)}&background=2563eb&color=ffffff&bold=true`}
                          alt={activeChat.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    {!activeChat.isGroup && (
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${(activeChat as any).status === "busy" ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>{activeChat.name}</span>
                      <span className={`h-2 w-2 rounded-full ${(activeChat as any).status === "busy" ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <Lock className="h-3 w-3 text-emerald-500" />
                      <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Mã hóa đầu cuối (E2EE)</span>
                      <span className="text-slate-655 mx-1">•</span>
                      <span className="text-4xs text-slate-500 leading-none">
                        {(activeChat as any).status === "busy" ? "Đang phục vụ khách (Bận)" : "Sẵn sàng nhận việc (Rảnh)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartCall("audio")}
                    className="p-2.5 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                    title="Gọi thoại E2EE"
                  >
                    <Phone className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => handleStartCall("video")}
                    className="p-2.5 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                    title="Gọi Video Call E2EE"
                  >
                    <Video className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => toast.success("Mở bảng thông tin chi tiết...")}
                    className="p-2.5 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                    title="Chi tiết"
                  >
                    <Info className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Chat Message Logs - Đã KHÓA CHẶT THẺ CHA BẰNG FLEX ĐỂ CUỘN */}
              <div className="flex-1 flex flex-col h-0 min-h-0 bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar scroll-smooth">
                  {activeConversation.length === 0 ? (
                    <div className="text-center py-12 text-3xs text-slate-555">
                      Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn chào mừng phía dưới!
                    </div>
                  ) : (
                    activeConversation.map((msg: any, idx: number) => {
                      const isSelf = msg.senderId === "self" || msg.senderId === currentUser?.id;
                      const senderAvatar = msg.sender?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.name || "U")}&background=2563eb&color=ffffff&bold=true`;

                      if (msg.type === "SYSTEM" || msg.isSystem) {
                        return (
                          <div key={msg.id || idx} className="flex justify-center my-3 w-full animate-fadeIn">
                            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900/60 border border-slate-850 text-[10px] text-slate-400 font-semibold tracking-wide font-sans shadow-inner">
                              <span>🤖</span>
                              <span>{msg.content}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative message-bounce-in`}
                        >
                          {!isSelf && (
                            <div className="h-6 w-6 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                              <img
                                src={senderAvatar}
                                alt={msg.sender?.name || "User"}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[70%] relative pb-1">
                            {activeChat.isGroup && !isSelf && (
                              <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender?.name}</span>
                            )}

                            <div className="relative">
                              {msg.type === "STICKER" ? (
                                <div className="text-5xl my-2 select-none transform hover:scale-115 hover:-rotate-3 active:scale-95 transition-all cursor-pointer animate-fadeIn" title="Telegram Sticker">
                                  {msg.content}
                                </div>
                              ) : msg.type === "ATTENDANCE" ? (
                                <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2 min-w-[260px] text-emerald-300 font-sans shadow-lg animate-fadeIn text-left">
                                  <p className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                    <span className="text-emerald-500">⏱️</span> GPS Chấm Công Thành Công
                                  </p>
                                  <div className="text-3xs space-y-1 mt-1 text-emerald-250/90 leading-relaxed font-semibold">
                                    <p>✅ Đã chấm công thành công lúc 08:00 AM.</p>
                                    <p>📍 Vị trí: Trùng khớp với tọa độ Radar.</p>
                                    <p>💰 Lương dự kiến: Đang tính toán...</p>
                                  </div>
                                </div>
                              ) : msg.type === "JOB" ? (
                                <div className="p-4 bg-blue-950/25 border border-blue-500/50 rounded-2xl space-y-3 min-w-[270px] text-blue-350 font-sans shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-fadeIn text-left">
                                  <p className="font-extrabold text-[10px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                    <span>⚡</span> BITPAW DISPATCHING JOB CARD
                                  </p>
                                  <div className="text-3xs space-y-1.5 text-slate-350 leading-relaxed font-semibold mt-1">
                                    <p className="flex items-center gap-1"><span className="text-xs">💅</span> <span className="font-bold text-slate-400">Dịch vụ:</span> Gói Massage Cổ Vai Gáy (Khách VIP - Phòng 3)</p>
                                    <p className="flex items-center gap-1"><span className="text-xs">💰</span> <span className="font-bold text-slate-400">Hoa hồng:</span> 150,000 VNĐ</p>
                                    <p className="flex items-center gap-1"><span className="text-xs">⏰</span> <span className="font-bold text-slate-400">Thời gian:</span> Bắt đầu ngay</p>
                                  </div>
                                  <div className="flex flex-col gap-2 pt-2.5 border-t border-blue-500/20">
                                    {jobStates[msg.id] === 'ACCEPTED' ? (
                                      <div className="space-y-2">
                                        <button
                                          type="button"
                                          disabled
                                          className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-500 font-extrabold text-[9px] text-center cursor-not-allowed border border-slate-700"
                                        >
                                          Đã nhận bởi bạn
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setJobStates(prev => ({ ...prev, [msg.id]: 'SYNCING' }));
                                            setTimeout(() => {
                                              setJobStates(prev => ({ ...prev, [msg.id]: 'COMPLETED' }));
                                              toast.success("💰 Ping! Đã ghi nhận doanh thu 150.000đ vào ví Bitpaw của bạn.", {
                                                icon: "💰",
                                                style: {
                                                  background: "#1e293b",
                                                  border: "1px solid #10b981",
                                                  color: "#10b981",
                                                  fontSize: "11px",
                                                  fontWeight: "bold"
                                                }
                                              });
                                            }, 2000);
                                          }}
                                          className="w-full py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[9px] transition-all cursor-pointer text-center shadow-md shadow-emerald-555/25"
                                        >
                                          ✅ HOÀN THÀNH & CHẤM CÔNG
                                        </button>
                                      </div>
                                    ) : jobStates[msg.id] === 'SYNCING' ? (
                                      <div className="space-y-2">
                                        <button
                                          type="button"
                                          disabled
                                          className="w-full py-1.5 rounded-xl bg-slate-850 text-slate-550 font-extrabold text-[9px] text-center cursor-not-allowed flex items-center justify-center gap-1.5"
                                        >
                                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                          <span>⏳ Đang đồng bộ với Bitpaw...</span>
                                        </button>
                                      </div>
                                    ) : jobStates[msg.id] === 'COMPLETED' ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="w-full py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-extrabold text-[9px] text-center cursor-not-allowed"
                                      >
                                        ✓ Đã hoàn thành & Lưu doanh thu
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setJobStates(prev => ({ ...prev, [msg.id]: 'ACCEPTED' }));
                                          toast.success("⚡ Nhận kèo thành công! Đang thực hiện công việc...");
                                        }}
                                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-[9px] transition-all cursor-pointer text-center shadow-md shadow-blue-550/25"
                                      >
                                        ⚡ NHẬN KÈO
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : msg.type === "QUOTATION" ? (
                                <div className="p-3.5 bg-amber-950/20 border border-amber-550/30 rounded-2xl space-y-2.5 min-w-[260px] text-amber-300 font-sans shadow-lg animate-fadeIn text-left">
                                  <p className="font-extrabold text-[10px] uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <span className="text-amber-500">📄</span> Báo Giá & Hợp Đồng Gig
                                  </p>
                                  <div className="text-3xs space-y-1 mt-1 text-amber-250/90 leading-relaxed font-semibold">
                                    <p>📄 Báo giá dịch vụ: Vệ sinh máy lạnh 2 bộ.</p>
                                    <p>💵 Tổng tiền: 450,000 VNĐ.</p>
                                  </div>
                                  <div className="flex gap-2 pt-2 border-t border-amber-500/20">
                                    <button
                                      type="button"
                                      onClick={() => toast.success("✅ Đã chấp nhận và thanh toán 450.000 VNĐ thành công!")}
                                      className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-5xs transition-all cursor-pointer text-center"
                                    >
                                      Chấp nhận & Thanh toán
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toast.error("❌ Đã từ chối báo giá dịch vụ.")}
                                      className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 font-bold text-5xs transition-all cursor-pointer text-center"
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words relative ${isSelf
                                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-blue-600/10"
                                      : "bg-slate-800 text-white rounded-2xl rounded-bl-sm border border-slate-750"
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
                              )}

                              {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                <div
                                  onClick={() => setMessageReactions(prev => ({ ...prev, [msg.id]: [] }))}
                                  className={`absolute -bottom-2.5 ${isSelf ? "left-2" : "right-2"} bg-slate-900 border border-slate-800 rounded-full px-1.5 py-0.5 text-[9px] flex items-center gap-0.5 shadow-lg z-20 select-none animate-fadeIn cursor-pointer hover:bg-slate-800 transition-colors`}
                                  title="Nhấp để xóa cảm xúc"
                                >
                                  {messageReactions[msg.id].map((emoji, idx) => (
                                    <span key={idx} className="hover:scale-125 transition-transform duration-100">{emoji}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className={`absolute -top-7 ${isSelf ? "right-0" : "left-0"} flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-lg px-2 py-0.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 backdrop-blur-sm`}>
                              <div className="flex items-center gap-1 border-r border-slate-800 pr-1.5 mr-1.5">
                                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleAddReaction(msg.id, emoji)}
                                    className="hover:scale-125 transition-transform text-2xs cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => toast.success("Đang thiết lập phản hồi...")}
                                className="p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="Trả lời"
                              >
                                <Reply className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.success("Đang chuyển tiếp tin nhắn...")}
                                className="p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="Chuyển tiếp"
                              >
                                <Share2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm p-3 bg-slate-800 w-fit rounded-2xl rounded-bl-sm mb-4 animate-fadeIn">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-350">Đang soạn tin</span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Unified Telegram-like Media panel (Emoji / Stickers / GIFs) */}
              {(showEmoji || showGifs) && (
                <div className="absolute bottom-24 left-4 right-4 bg-slate-950 border border-slate-855 rounded-2xl p-4 shadow-2xl z-20 h-80 flex flex-col animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setChatPanelTab("emoji"); setShowEmoji(true); setShowGifs(false); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "emoji"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                      >
                        😀 Emojis
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChatPanelTab("sticker"); setShowEmoji(false); setShowGifs(false); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "sticker"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                      >
                        ✨ Stickers
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChatPanelTab("gif"); setShowGifs(true); setShowEmoji(false); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "gif"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                      >
                        🎬 GIFs
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowEmoji(false);
                        setShowGifs(false);
                      }}
                      className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {chatPanelTab === "emoji" && (
                      <div className="grid grid-cols-8 sm:grid-cols-10 gap-3 p-2 h-full overflow-y-auto custom-scrollbar select-none">
                        {POPULAR_EMOJIS.map((emoji, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setMessageText((prev) => prev + emoji)}
                            className="text-2xl p-2 rounded-xl hover:bg-slate-900 hover:scale-125 active:scale-95 transition-transform duration-200 cursor-pointer text-center flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {chatPanelTab === "sticker" && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 p-1">
                        {MOCK_STICKERS.map((stk) => (
                          <div
                            key={stk.label}
                            onClick={() => {
                              handleSendMessage(null, stk.emoji, "STICKER");
                              setShowEmoji(false);
                            }}
                            className="hover:scale-125 hover:-rotate-3 active:scale-95 transition-all duration-300 cursor-pointer p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 shadow-md select-none hover:shadow-indigo-500/10 hover:border-indigo-500/30"
                          >
                            <span className="text-4xl animate-bounce" style={{ animationDuration: "2s" }}>{stk.emoji}</span>
                            <span className="text-[9px] text-slate-500 tracking-wider font-semibold uppercase">{stk.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {chatPanelTab === "gif" && (
                      <div className="space-y-3 h-full flex flex-col">
                        <input
                          type="text"
                          placeholder="Nhập từ khóa tìm kiếm GIF..."
                          value={gifSearch}
                          onChange={(e) => setGifSearch(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-550 focus:outline-none"
                        />
                        {loadingGifs ? (
                          <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 custom-scrollbar">
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
                className="p-4 border-t border-slate-850 bg-slate-950/20 flex flex-col gap-2 flex-shrink-0"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmoji(!showEmoji);
                        setShowGifs(false);
                        setShowAttachmentMenu(false);
                      }}
                      className={`p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer ${showEmoji && chatPanelTab !== "gif" ? "bg-slate-900 text-blue-400" : ""}`}
                      title="Chèn biểu tượng, nhãn dán"
                    >
                      <Smile className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (showEmoji && chatPanelTab === "gif") {
                          setShowEmoji(false);
                        } else {
                          setShowEmoji(true);
                          setChatPanelTab("gif");
                          setShowGifs(true);
                        }
                        setShowAttachmentMenu(false);
                      }}
                      className={`px-2.5 py-1 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer text-xs font-black font-sans leading-none flex items-center justify-center border border-slate-800 ${showEmoji && chatPanelTab === "gif" ? "bg-blue-600/20 text-blue-300 border-blue-500/50" : ""}`}
                      title="Chèn ảnh động GIF"
                    >
                      GIF
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMiniAppOpen(true)}
                      className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                      title="Chấm công GPS"
                    >
                      <Clock className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSendMessage(null, "💅 Dịch vụ: Gói Massage Cổ Vai Gáy (Khách VIP - Phòng 3)\n💰 Hoa hồng: 150,000 VNĐ\n⏰ Thời gian: Bắt đầu ngay", "JOB");
                        toast.success("⚡ Đã phân phối thẻ nhận việc (Job Card) mới!");
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                      title="Tạo Job Card điều phối"
                    >
                      <Briefcase className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSendMessage(null, "Hệ thống đề xuất: Kèo này ưu tiên cho @Trần-Thị-Mai vì đang có ít đơn nhất trong ngày.", "SYSTEM");
                        toast.success("🤖 Đã gửi đề xuất hệ thống!");
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                      title="Đề xuất của Robot hệ thống"
                    >
                      <Cpu className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSendMessage(null, "QUOTATION_GIG_CONTRACT_V1", "QUOTATION");
                        toast.success("📄 Đã gửi bản báo giá & hợp đồng dịch vụ!");
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                      title="Gửi báo giá / hợp đồng"
                    >
                      <FileText className="h-5 w-5" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(!showAttachmentMenu);
                          setShowEmoji(false);
                          setShowGifs(false);
                        }}
                        className={`p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer ${showAttachmentMenu ? "bg-slate-900 text-blue-450" : ""}`}
                        title="Đính kèm tệp tin"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>

                      {showAttachmentMenu && (
                        <div className="absolute bottom-10 left-0 bg-slate-900 border border-slate-800 rounded-xl py-2 w-48 shadow-2xl z-30 animate-fadeIn text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              fileTypeRef.current = "image";
                              fileInputRef.current?.setAttribute("accept", "image/*");
                              fileInputRef.current?.click();
                              setShowAttachmentMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors duration-150"
                          >
                            <span>🖼️</span> Hình ảnh
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              fileTypeRef.current = "document";
                              fileInputRef.current?.setAttribute("accept", ".pdf,.doc,.docx,.xls,.xlsx");
                              fileInputRef.current?.click();
                              setShowAttachmentMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors duration-150"
                          >
                            <span>📄</span> Tài liệu PDF/Word
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              fileTypeRef.current = "video";
                              fileInputRef.current?.setAttribute("accept", "video/*");
                              fileInputRef.current?.click();
                              setShowAttachmentMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors duration-150"
                          >
                            <span>🎥</span> Video (&lt; 50MB)
                          </button>
                          <div className="border-t border-slate-800 mt-1 pt-1.5 px-4 text-[9px] text-slate-500 italic">
                            Tối ưu hóa hình ảnh. Giới hạn Video &lt; 50MB
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toast.success("🎤 Chức năng ghi âm thoại đang được giả lập...")}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                      title="Ghi âm giọng nói (Voice)"
                    >
                      <Mic className="h-5 w-5" />
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => toast.success("⚡ Mở bảng chấm công & Thống kê HR dự án...")}
                    className="hidden md:flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-555 text-white font-extrabold text-[10px] shadow-lg shadow-amber-500/10 cursor-pointer transition-all hover:scale-105 duration-305"
                    title="Công cụ quản trị chấm công HR"
                  >
                    <Zap className="h-3 w-3 fill-white" />
                    <span>⚡ Công cụ HR/Chấm công</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                    placeholder="Viết tin nhắn phản hồi, chốt deal, chấm công..."
                    className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-200 placeholder-slate-550 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className="h-10 w-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 transition-all duration-300 cursor-pointer shadow-lg shadow-blue-500/20"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 animate-fadeIn">
              <MessageSquare className="h-10 w-10 text-slate-700 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-slate-300">Chọn cuộc trò chuyện</p>
                <p className="text-3xs text-slate-500 mt-1 max-w-[280px] leading-relaxed">
                  Hãy chọn một cuộc trò chuyện hoặc bắt đầu kết bạn để nhắn tin.
                </p>
              </div>
            </div>
          )}
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
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer animate-fadeIn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs animate-fadeIn">
              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">TÊN NHÓM</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đội xe ôm Q1, Tổ thợ sửa..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-555 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">LOẠI NHÓM CHAT</label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-250 focus:outline-none cursor-pointer"
                >
                  <option value="FUN">Giải trí & Giao lưu</option>
                  <option value="HR">Công việc (Chấm công & HR)</option>
                </select>
              </div>

              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">CHỌN THÀNH VIÊN</label>
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl p-2 space-y-1.5 bg-slate-950/50 custom-scrollbar">
                  {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500 text-4xs font-semibold">
                      <span>👥</span>
                      <p className="mt-1">Trống. Vui lòng thêm bạn bè trước khi tạo nhóm.</p>
                    </div>
                  ) : (
                    contacts.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      const isDisabled = groupType === "HR" && !user.isInternal;

                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            if (isDisabled) return;
                            if (isSelected) {
                              setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                            } else {
                              setSelectedUserIds(prev => [...prev, user.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition-all duration-300 ${isDisabled ? "opacity-35 cursor-not-allowed select-none" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=ffffff&bold=true`}
                              alt={user.name}
                              className="h-6.5 w-6.5 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="block text-3xs font-bold text-slate-200 truncate">{user.name}</span>
                                {user.isInternal && (
                                  <span className="inline-flex items-center text-[7px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 px-1 py-0.1 rounded-full">
                                    ✓ Nội bộ
                                  </span>
                                )}
                              </div>
                              <span className="block text-5xs text-slate-500 truncate">{user.role}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => { }}
                            className="h-3.5 w-3.5 rounded border-slate-800 text-blue-600 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setShowGroupModal(false)}
                className="rounded-lg px-4 py-2 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-all duration-300"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateGroup}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-3xs font-bold text-white transition-all duration-300 cursor-pointer"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIO / VIDEO CALL MODAL OVERLAY */}
      {showCallingModal && activeChat && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between z-50 p-8 text-slate-100 animate-fadeIn">
          <div className="flex flex-col items-center space-y-2 mt-12">
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              {callType === "video" ? "Cuộc gọi Video E2EE" : "Cuộc gọi thoại E2EE"}
            </span>
            <p className="text-3xs text-slate-500 font-semibold italic">Cuộc gọi được bảo mật bằng mã hóa đầu cuối</p>
          </div>

          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-slate-800 shadow-2xl relative z-10">
                <img
                  src={activeChat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.name)}&background=2563eb&color=ffffff&bold=true`}
                  alt={activeChat.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute inset-0 h-28 w-28 rounded-full bg-blue-500/20 animate-ping z-0 scale-110" />
              <div className="absolute inset-0 h-28 w-28 rounded-full bg-indigo-500/10 animate-ping z-0 scale-125" style={{ animationDelay: "0.5s" }} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-lg font-black text-slate-100">{activeChat.name}</h2>
              {callConnected ? (
                <p className="text-sm font-extrabold text-emerald-400 tracking-wider font-mono">
                  {formatTimer(callSeconds)}
                </p>
              ) : (
                <p className="text-3xs text-slate-400 font-bold animate-pulse">
                  Đang gọi {callType === "video" ? "Video" : "Thoại"} cho {activeChat.name}...
                </p>
              )}
            </div>
          </div>

          {callConnected && callType === "audio" && (
            <audio ref={remoteVideoRef} autoPlay playsInline muted={false} className="hidden" />
          )}

          {callConnected && callType === "video" && (
            <div className="absolute inset-x-4 top-24 bottom-32 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-20 flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                {videoOff ? (
                  <p className="text-3xs font-bold text-slate-400">🎥 Camera đối tác đã tắt</p>
                ) : (
                  <div className="text-center text-[10px] text-white/70 font-semibold animate-pulse">
                    🎥 Đang truyền luồng Video Real-time...
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 right-4 h-32 w-24 bg-slate-955 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-30">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted={true}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1.5 bg-black/60 px-1.5 py-0.2 rounded text-[7px] text-white/90 pointer-events-none">Bạn</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-6 mb-8 z-30">
            {!callConnected ? (
              <>
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 cursor-pointer"
                  title="Nhận cuộc gọi"
                >
                  <Phone className="h-6 w-6 stroke-[2.5px]" />
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-14 w-14 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-red-500/20 cursor-pointer"
                  title="Từ chối"
                >
                  <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const nextMute = !micMuted;
                    setMicMuted(nextMute);
                    if (localStreamRef.current) {
                      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !nextMute);
                    }
                    toast.success(nextMute ? "🔇 Đã tắt micro" : "🎤 Đã bật micro");
                  }}
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${micMuted ? "bg-red-500 text-white border border-red-400" : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"}`}
                  title={micMuted ? "Bật micro" : "Tắt micro"}
                >
                  {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-14 w-14 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-red-550/20 cursor-pointer"
                  title="Gác máy"
                >
                  <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
                </button>

                {callType === "video" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextVideoOff = !videoOff;
                      setVideoOff(nextVideoOff);
                      if (localStreamRef.current) {
                        localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !nextVideoOff);
                      }
                      toast.success(nextVideoOff ? "🚫 Đã tắt camera" : "🎥 Đã mở camera");
                    }}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${videoOff ? "bg-red-500 text-white border border-red-400" : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"}`}
                    title={videoOff ? "Bật camera" : "Tắt camera"}
                  >
                    {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toast.success("🔊 Đã chuyển sang loa ngoài")}
                    className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                    title="Loa ngoài"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* INCOMING CALL MODAL OVERLAY */}
      {receivingCall && callerInfo && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-[2000] p-8 text-slate-100 animate-fadeIn">
          <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-blue-500 shadow-2xl relative z-10">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(callerInfo.name)}&background=2563eb&color=ffffff&bold=true`}
                  alt={callerInfo.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute inset-0 h-24 w-24 rounded-full bg-blue-500/20 animate-ping z-0 scale-110" />
            </div>

            <div className="space-y-2">
              <span className="bg-blue-650/20 border border-blue-500/35 px-3 py-1 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 justify-center">
                📞 Đang đổ chuông...
              </span>
              <h2 className="text-base font-extrabold text-slate-200">Cuộc gọi đến</h2>
              <p className="text-sm font-black text-slate-100">{callerInfo.name} đang gọi cho bạn...</p>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (ringtoneRef.current) {
                    ringtoneRef.current.pause();
                    ringtoneRef.current = null;
                  }
                  setReceivingCall(false);

                  // Accept and show WebRTC modal
                  setCallType("video");
                  setShowCallingModal(true);
                  handleAcceptCall();
                }}
                className="h-14 w-14 rounded-full bg-emerald-500 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 cursor-pointer animate-bounce"
                title="Trả lời"
              >
                <Phone className="h-6 w-6 stroke-[2.5px]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (ringtoneRef.current) {
                    ringtoneRef.current.pause();
                    ringtoneRef.current = null;
                  }
                  setReceivingCall(false);
                }}
                className="h-14 w-14 rounded-full bg-rose-500 hover:scale-105 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-rose-500/20 cursor-pointer"
                title="Từ chối"
              >
                <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* JOIN WORKSPACE MODAL */}
      {showJoinWorkspaceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>🏢</span>
                Gia nhập Không gian làm việc
              </h3>
              <button
                onClick={() => {
                  setShowJoinWorkspaceModal(false);
                  setWorkspaceCode("");
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-3xs text-slate-400 leading-relaxed">
                Nhập mã mời doanh nghiệp của bạn để gia nhập không gian làm việc chính thức, liên kết danh bạ đồng nghiệp nội bộ và mở khóa các công cụ chấm công chuyên biệt.
              </p>

              <div className="space-y-1">
                <label className="block text-4xs font-bold text-slate-400">MÃ DOANH NGHIỆP</label>
                <input
                  type="text"
                  placeholder="VD: BITPAW-8899..."
                  value={workspaceCode}
                  onChange={(e) => setWorkspaceCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 uppercase"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => {
                  setShowJoinWorkspaceModal(false);
                  setWorkspaceCode("");
                }}
                className="rounded-xl px-4 py-2 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleJoinWorkspace}
                disabled={joiningWorkspace}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-3xs font-extrabold text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {joiningWorkspace && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Gửi yêu cầu phê duyệt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SSO REDIRECT MODAL OVERLAY */}
      {showSSOModal && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 text-slate-100 animate-fadeIn">
          <div className="text-center space-y-6 max-w-sm">
            <div className="relative flex justify-center items-center">
              <div className="h-16 w-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center animate-spin duration-[3000ms]">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-black tracking-wide text-slate-200 flex items-center justify-center gap-1.5 animate-pulse">
                {ssoStep === 1 ? (
                  <>
                    <span>🔄</span>
                    <span>Đang chuyển hướng an toàn sang Bitpaw HR...</span>
                  </>
                ) : (
                  <>
                    <span>👤</span>
                    <span>Đang xác thực sinh trắc học...</span>
                  </>
                )}
              </h3>
              <p className="text-[9px] text-slate-500 italic">Cổng kết nối bảo mật SSO tích hợp Bitpaw OAuth2</p>
            </div>
          </div>
        </div>
      )}
      <BitpawMiniApp isOpen={isMiniAppOpen} onClose={() => setIsMiniAppOpen(false)} />
    </div>
  );
}

export default function MessengerPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 animate-pulse">
        <Navbar />
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Đang khởi tạo khu chat...</p>
        </main>
      </div>
    }>
      <MessengerContent />
    </Suspense>
  );
}