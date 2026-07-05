"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import { 
  Send, User, Search, MessageSquare, Loader2, AlertCircle, Plus, Users, 
  Image, Video, Smile, X, Lock, Phone, Paperclip, Mic, Zap, Reply, Share2, Info 
} from "lucide-react";
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

const MOCK_PARTNERS = [
  {
    id: "mock-group-1",
    name: "Team Chấm Công Q3 (HR Group)",
    avatarUrl: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=100&auto=format&fit=crop&q=80",
    role: "WORKPLACE",
    bio: "12 thành viên • HR & Quản trị nhân sự",
    isOnline: true,
    statusText: "Giải quyết chấm công hàng ngày",
    isGroup: true,
    messages: [
      { id: "mg-1-1", content: "Mọi người nhớ chấm công định vị đúng vị trí Radar công trường nhé!", senderId: "mock-1", receiverId: "group", createdAt: new Date(Date.now() - 3600000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam (HR)", role: "ADMIN", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "group", name: "Team Chấm Công Q3", role: "GROUP" } },
      { id: "mg-1-2", content: "Em gửi báo cáo sản lượng ngày hôm nay rồi anh Nam ơi.", senderId: "mock-3", receiverId: "group", createdAt: new Date(Date.now() - 3200000).toISOString(), type: "TEXT", sender: { id: "mock-3", name: "Phạm Minh Hải", role: "DRIVER", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "group", name: "Team Chấm Công Q3", role: "GROUP" } },
      { id: "mg-1-3", content: "Đã duyệt báo cáo chấm công tự động của Hải qua GPS. Tuyệt vời!", senderId: "mock-1", receiverId: "group", createdAt: new Date(Date.now() - 3000000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam (HR)", role: "ADMIN", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "group", name: "Team Chấm Công Q3", role: "GROUP" } },
    ]
  },
  {
    id: "mock-group-2",
    name: "Nhóm Dự án A (Platform)",
    avatarUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80",
    role: "WORKPLACE",
    bio: "8 thành viên • Dev & Ops",
    isOnline: true,
    statusText: "Triển khai hệ thống 0% chiết khấu",
    isGroup: true,
    messages: [
      { id: "mg-2-1", content: "Hệ thống VNPay và nạp PawCoin đã tích hợp thành công trên production.", senderId: "mock-1", receiverId: "group", createdAt: new Date(Date.now() - 7200000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "group", name: "Nhóm Dự án A", role: "GROUP" } },
      { id: "mg-2-2", content: "Quá tốt rồi! Sắp tới mình làm thêm E2EE mã hóa tin nhắn chat là siêu bảo mật.", senderId: "self", receiverId: "group", createdAt: new Date(Date.now() - 7000000).toISOString(), type: "TEXT", sender: { id: "self", name: "Bạn", role: "USER" }, receiver: { id: "group", name: "Nhóm Dự án A", role: "GROUP" } },
    ]
  },
  {
    id: "mock-1",
    name: "Lê Hoàng Nam (Tech Lead)",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
    role: "DEVELOPER",
    bio: "Hỗ trợ kỹ thuật PawBook",
    isOnline: true,
    statusText: "Đang hoạt động",
    isGroup: false,
    messages: [
      { id: "m-1-1", content: "Chào bạn! Mình thấy bạn đang quan tâm dự án PawBook đúng không?", senderId: "mock-1", receiverId: "self", createdAt: new Date(Date.now() - 3600000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-1-2", content: "Bên mình đang miễn phí 100% chiết khấu cho mọi giao dịch vận chuyển và gọi thợ đó!", senderId: "mock-1", receiverId: "self", createdAt: new Date(Date.now() - 3500000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-1-3", content: "Chào anh Nam, đúng rồi ạ. Giao diện mượt mà quá, em đang test thử các tính năng.", senderId: "self", receiverId: "mock-1", createdAt: new Date(Date.now() - 3400000).toISOString(), type: "TEXT", sender: { id: "self", name: "Bạn", role: "USER" }, receiver: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER" } },
      { id: "m-1-4", content: "Cảm ơn bạn nhé! Bạn có thể sử dụng các tiện ích quét CV bằng AI hoặc nâng cấp tài khoản VIP để trải nghiệm đầy đủ nha.", senderId: "mock-1", receiverId: "self", createdAt: new Date(Date.now() - 3300000).toISOString(), type: "TEXT", sender: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
    ]
  },
  {
    id: "mock-2",
    name: "Nguyễn Thùy Chi (F&B Owner)",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    role: "EMPLOYER",
    bio: "Tìm thợ pha chế Cafe & Delivery",
    isOnline: false,
    statusText: "Hoạt động 15 phút trước",
    isGroup: false,
    messages: [
      { id: "m-2-1", content: "Chào bạn, bên mình đang cần tuyển gấp 2 nhân viên pha chế ca tối ở Q3.", senderId: "mock-2", receiverId: "self", createdAt: new Date(Date.now() - 7200000).toISOString(), type: "TEXT", sender: { id: "mock-2", name: "Nguyễn Thùy Chi", role: "EMPLOYER", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-2-2", content: "Lương 25k - 30k/h cộng thưởng doanh số. Bạn xem hồ sơ của mình có phù hợp không?", senderId: "mock-2", receiverId: "self", createdAt: new Date(Date.now() - 7100000).toISOString(), type: "TEXT", sender: { id: "mock-2", name: "Nguyễn Thùy Chi", role: "EMPLOYER", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-2-3", content: "Chào chị, em đã nhận được thông tin, để em gửi CV qua hệ thống nhé.", senderId: "self", receiverId: "mock-2", createdAt: new Date(Date.now() - 7000000).toISOString(), type: "TEXT", sender: { id: "self", name: "Bạn", role: "USER" }, receiver: { id: "mock-2", name: "Nguyễn Thùy Chi", role: "EMPLOYER" } },
    ]
  },
  {
    id: "mock-3",
    name: "Phạm Minh Hải (Tài Xế Grab)",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    role: "DRIVER",
    bio: "Đội vận tải công nghệ 0% chiết khấu",
    isOnline: true,
    statusText: "Đang hoạt động",
    isGroup: false,
    messages: [
      { id: "m-3-1", content: "Anh ơi, em đang đỗ ở gần Radar của anh tầm 200m nhé.", senderId: "mock-3", receiverId: "self", createdAt: new Date(Date.now() - 1200000).toISOString(), type: "TEXT", sender: { id: "mock-3", name: "Phạm Minh Hải", role: "DRIVER", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-3-2", content: "Để em chạy xe qua đón anh đi spa cún luôn nhé.", senderId: "mock-3", receiverId: "self", createdAt: new Date(Date.now() - 1100000).toISOString(), type: "TEXT", sender: { id: "mock-3", name: "Phạm Minh Hải", role: "DRIVER", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
    ]
  },
  {
    id: "mock-4",
    name: "Trần Thị Mai (Thợ Spa Cún)",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
    role: "SERVICE_PROVIDER",
    bio: "Dịch vụ làm đẹp thú cưng tại nhà",
    isOnline: false,
    statusText: "Hoạt động 3 giờ trước",
    isGroup: false,
    messages: [
      { id: "m-4-1", content: "Chào chị, em chuyên tỉa lông tạo kiểu nghệ thuật cho cún mèo.", senderId: "mock-4", receiverId: "self", createdAt: new Date(Date.now() - 18000000).toISOString(), type: "TEXT", sender: { id: "mock-4", name: "Trần Thị Mai", role: "SERVICE_PROVIDER", avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
      { id: "m-4-2", content: "Cho em xin cân nặng của bé để báo giá chính xác nha chị.", senderId: "mock-4", receiverId: "self", createdAt: new Date(Date.now() - 17900000).toISOString(), type: "TEXT", sender: { id: "mock-4", name: "Trần Thị Mai", role: "SERVICE_PROVIDER", avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80" }, receiver: { id: "self", name: "Bạn", role: "USER" } },
    ]
  }
];

function MessengerContent() {
  const searchParams = useSearchParams();
  const searchUserId = searchParams.get("userId");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mockPartners, setMockPartners] = useState<any[]>(MOCK_PARTNERS);

  const [activeChat, setActiveChat] = useState<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    role: string;
    isGroup: boolean;
    isOnline: boolean;
    statusText: string;
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
    if (!currentUser || !activeChat || activeChat.id.startsWith("mock-")) return;

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
          isOnline: true,
          statusText: "Đang hoạt động"
        });
      }
    }
  }, [systemUsers, searchUserId, activeChat]);

  // Auto select first mock partner on mount if no search query parameter and no active chat
  useEffect(() => {
    if (!searchUserId && !activeChat && mockPartners.length > 0) {
      const firstMock = mockPartners[0];
      setActiveChat({
        id: firstMock.id,
        name: firstMock.name,
        avatarUrl: firstMock.avatarUrl,
        role: firstMock.role,
        isGroup: firstMock.isGroup || false,
        isOnline: firstMock.isOnline,
        statusText: firstMock.statusText
      });
    }
  }, [searchUserId, activeChat, mockPartners]);

  // Scroll to chat log bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat, mockPartners]);

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

    if (activeChat.id.startsWith("mock-")) {
      const newMessage = {
        id: `mock-msg-${Date.now()}`,
        content,
        type,
        senderId: "self",
        receiverId: activeChat.id,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUser?.id || "self",
          name: currentUser?.name || "Bạn",
          role: currentUser?.role || "USER",
          avatarUrl: currentUser?.avatarUrl
        },
        receiver: {
          id: activeChat.id,
          name: activeChat.name,
          role: activeChat.role
        }
      };

      setMockPartners(prev => prev.map(m => {
        if (m.id === activeChat.id) {
          return {
            ...m,
            messages: [...m.messages, newMessage]
          };
        }
        return m;
      }));

      // Auto response mock simulator
      if (type === "TEXT") {
        setTimeout(() => {
          const autoReplies: {[key: string]: string[]} = {
            "mock-group-1": [
              "Hệ thống đã ghi nhận GPS chấm công công trình. Mọi người làm việc cẩn thận nhé!",
              "Nhắc nhở: Các tài xế nhớ update lịch trình trong ngày hôm nay."
            ],
            "mock-group-2": [
              "Hệ thống định tuyến API đã load mượt mà.",
              "Anh em tiến hành test luồng và nộp log báo cáo vào tối nay nhé!"
            ],
            "mock-1": [
              "Vâng đúng rồi ạ! Nền tảng PawBook giúp tối ưu hóa chi phí tốt nhất cho cộng đồng.",
              "Nếu bạn có bất cứ câu hỏi nào khác về dự án, cứ nhắn cho mình nhé!",
              "Chúc bạn một ngày làm việc hiệu quả! 🚀"
            ],
            "mock-2": [
              "Dạ vâng, bạn gửi CV qua rồi thì mình sẽ phản hồi lại sớm nhất nha.",
              "Cảm ơn bạn đã quan tâm đến tin tuyển dụng của quán!"
            ],
            "mock-3": [
              "Dạ em đang di chuyển qua rồi anh nhé, khoảng 3 phút nữa em tới nơi.",
              "Em chạy xe ôm công nghệ uy tín, anh yên tâm nhé!"
            ],
            "mock-4": [
              "Dạ bé nhà mình thuộc giống chó gì thế ạ? Để em chuẩn bị dụng cụ kéo cắt phù hợp nha chị.",
              "Dịch vụ spa bên em cam kết làm cún cưng dễ chịu, không stress."
            ]
          };

          const replies = autoReplies[activeChat.id] || ["Mình đã nhận được tin nhắn của bạn nhé!"];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];

          const botMessage = {
            id: `mock-msg-bot-${Date.now()}`,
            content: randomReply,
            type: "TEXT",
            senderId: activeChat.id,
            receiverId: "self",
            createdAt: new Date().toISOString(),
            sender: {
              id: activeChat.id,
              name: activeChat.name,
              role: activeChat.role,
              avatarUrl: activeChat.avatarUrl
            },
            receiver: {
              id: currentUser?.id || "self",
              name: currentUser?.name || "Bạn",
              role: currentUser?.role || "USER"
            }
          };

          setMockPartners(prev => prev.map(m => {
            if (m.id === activeChat.id) {
              return {
                ...m,
                messages: [...m.messages, botMessage]
              };
            }
            return m;
          }));
        }, 1000);
      }
      return;
    }

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

    const newGroupId = `mock-group-${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      name: `${groupName.trim()} (${groupType === "HR" ? "HR Group" : "Fun"})`,
      role: groupType === "HR" ? "WORKPLACE" : "GROUP",
      bio: `${selectedUserIds.length + 1} thành viên`,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=${groupType === "HR" ? "d97706" : "4f46e5"}&color=ffffff&bold=true`,
      isGroup: true,
      isOnline: true,
      statusText: "Vừa mới tạo",
      messages: [
        {
          id: `m-g-${Date.now()}`,
          content: `Chào mọi người! Nhóm đã được khởi tạo với vai trò: ${groupType === "HR" ? "Công việc & Chấm công HR" : "Giải trí & Giao lưu"}.`,
          senderId: "mock-1",
          createdAt: new Date().toISOString(),
          type: "TEXT",
          sender: { id: "mock-1", name: "Lê Hoàng Nam", role: "DEVELOPER" }
        }
      ]
    };

    setMockPartners(prev => [newGroup, ...prev]);
    toast.success("Tạo nhóm trò chuyện thành công! 🎉");
    setShowGroupModal(false);
    setGroupName("");
    setSelectedUserIds([]);
    setActiveChat({
      id: newGroup.id,
      name: newGroup.name,
      avatarUrl: newGroup.avatarUrl,
      role: newGroup.role,
      isGroup: true,
      isOnline: true,
      statusText: newGroup.statusText
    });
  };

  const getChatConversations = () => {
    if (!currentUser) return { dbList: [], mockList: [] };
    
    const list = [...conversations];

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

    const filteredDbList = list.filter((c) => {
      if (c.isGroup) {
        return c.name?.toLowerCase().includes(searchFilter.toLowerCase());
      } else {
        const partner = c.participants.find((p) => p.id !== currentUser.id);
        return partner?.name.toLowerCase().includes(searchFilter.toLowerCase());
      }
    });

    const filteredMocks = mockPartners.filter(m => 
      m.name.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return {
      dbList: filteredDbList,
      mockList: filteredMocks
    };
  };

  const getConversationMessages = () => {
    if (!activeChat || !currentUser) return [];
    if (activeChat.id.startsWith("mock-")) {
      const mock = mockPartners.find(m => m.id === activeChat.id);
      return mock ? mock.messages : [];
    }
    if (activeChat.isGroup) {
      return messages.filter((msg) => msg.conversationId === activeChat.id);
    }
    return messages.filter(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === activeChat.id) ||
        (msg.senderId === activeChat.id && msg.receiverId === currentUser.id)
    );
  };

  const { dbList, mockList } = getChatConversations();
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar />
      <Toaster position="top-center" />

      <main className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 h-full overflow-hidden">
          
          {/* Left Column: Conversations Sidebar (30% width, 4 cols) */}
          <div className="md:col-span-4 border-r border-slate-850 flex flex-col h-full bg-slate-950/20">
            {/* Search & Actions Header */}
            <div className="p-4 border-b border-slate-850 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <MessageSquare className="h-4.5 w-4.5 text-blue-500" />
                  Hộp thư Messenger
                </h2>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 px-3 py-1.5 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
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
              {/* Online Partners Mock List (Rich aesthetics) */}
              {mockList.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 mb-2">Đoạn Chat Đề Xuất (Bản Địa)</p>
                  {mockList.map((m) => {
                    const isActive = activeChat?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setActiveChat({
                          id: m.id,
                          name: m.name,
                          avatarUrl: m.avatarUrl,
                          role: m.role,
                          isGroup: m.isGroup || false,
                          isOnline: m.isOnline,
                          statusText: m.statusText
                        })}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          isActive
                            ? "bg-blue-600/15 border border-blue-500/25 text-white"
                            : "hover:bg-slate-900/40 border border-transparent"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                            {m.isGroup ? (
                              <Users className="h-5 w-5 text-indigo-400" />
                            ) : (
                              <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${m.isOnline ? "bg-emerald-500" : "bg-slate-500"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-slate-200 truncate">{m.name}</p>
                            <span className="text-[9px] text-slate-500">{m.isOnline ? "Online" : "Off"}</span>
                          </div>
                          <p className="text-3xs text-slate-500 truncate leading-relaxed">
                            {m.bio}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Database Real Conversations */}
              {dbList.length > 0 && (
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
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          isActive
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
                          <p className="text-xs font-bold text-slate-250 truncate">{displayName}</p>
                          <p className="text-3xs text-slate-500 truncate leading-relaxed">
                            {displayBio}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat window (70% width, 8 cols) */}
          <div className="md:col-span-8 flex flex-col h-full bg-slate-950/10 relative animate-fadeIn">
            {activeChat ? (
              <>
                {/* Active Partner Header */}
                <div className="p-4 border-b border-slate-855 bg-slate-950/30 flex items-center justify-between gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
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
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 ${activeChat.isOnline ? "bg-emerald-500" : "bg-slate-500"}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{activeChat.name}</span>
                        <span className={`h-2 w-2 rounded-full ${activeChat.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
                      </h3>
                      {/* E2EE Subheader Indicator */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="h-3 w-3 text-emerald-500" />
                        <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Mã hóa đầu cuối (E2EE)</span>
                        <span className="text-slate-655 mx-1">•</span>
                        <span className="text-4xs text-slate-500 leading-none">
                          {activeChat.isOnline ? "Đang hoạt động" : activeChat.statusText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Calls and Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toast.success(`📞 Đang khởi tạo cuộc gọi thoại mã hóa E2EE đến ${activeChat.name}...`)}
                      className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Gọi thoại E2EE"
                    >
                      <Phone className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => toast.success(`📹 Đang khởi tạo cuộc gọi video mã hóa E2EE đến ${activeChat.name}...`)}
                      className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Gọi Video Call E2EE"
                    >
                      <Video className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => toast.success("Mở bảng thông tin chi tiết...")}
                      className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Chi tiết"
                    >
                      <Info className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                {/* Chat Message Logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {activeConversation.length === 0 ? (
                    <div className="text-center py-12 text-3xs text-slate-555">
                      Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn chào mừng phía dưới!
                    </div>
                  ) : (
                    activeConversation.map((msg: any) => {
                      const isSelf = msg.senderId === "self" || msg.senderId === currentUser?.id;
                      const senderAvatar = msg.sender?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.name || "U")}&background=2563eb&color=ffffff&bold=true`;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative`}
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
                          <div className="flex flex-col max-w-[70%] relative">
                            {activeChat.isGroup && !isSelf && (
                              <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender?.name}</span>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words relative ${
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

                            {/* Floating Toolbar on Hover */}
                            <div className={`absolute -top-7 ${isSelf ? "right-0" : "left-0"} flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-lg px-2 py-0.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-30 backdrop-blur-sm`}>
                              {/* Reactions */}
                              <div className="flex items-center gap-1 border-r border-slate-800 pr-1.5 mr-1.5">
                                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => toast.success(`Bạn đã thả cảm xúc ${emoji} tin nhắn!`)}
                                    className="hover:scale-125 transition-transform text-2xs cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              {/* Actions */}
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
                  <div ref={messagesEndRef} />
                </div>

                {/* Media Selectors Panel */}
                {(showEmoji || showGifs) && (
                  <div className="absolute bottom-20 left-4 right-4 bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl z-20 h-72 flex flex-col">
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
                        className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white cursor-pointer"
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
                  className="p-4 border-t border-slate-850 bg-slate-950/20 flex flex-col gap-2 flex-shrink-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {/* Emoji Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmoji(!showEmoji);
                          setShowGifs(false);
                        }}
                        className={`p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer ${showEmoji ? "bg-slate-900 text-blue-400" : ""}`}
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
                        className={`p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer ${showGifs ? "bg-slate-900 text-blue-400" : ""}`}
                        title="Chèn ảnh động GIF"
                      >
                        <span className="text-3xs font-extrabold tracking-wider border border-slate-500 rounded px-0.5">GIF</span>
                      </button>

                      {/* File Attach Trigger (Images / Videos / Files) */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Đính kèm tệp tin"
                      >
                        <Paperclip className="h-4.5 w-4.5" />
                      </button>

                      {/* Voice (Mic) Trigger */}
                      <button
                        type="button"
                        onClick={() => toast.success("🎤 Chức năng ghi âm thoại đang được giả lập...")}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Ghi âm giọng nói (Voice)"
                      >
                        <Mic className="h-4.5 w-4.5" />
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        className="hidden"
                      />
                    </div>

                    {/* HR Tools Trigger */}
                    <button
                      type="button"
                      onClick={() => toast.success("⚡ Mở bảng chấm công & Thống kê HR dự án...")}
                      className="flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-555 text-white font-extrabold text-[10px] shadow-lg shadow-amber-500/10 cursor-pointer transition-all hover:scale-105"
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
                      className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim() || sending}
                      className="h-10 w-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-lg shadow-blue-500/20"
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
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1">TÊN NHÓM</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đội xe ôm Q1, Tổ thợ sửa..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-550 focus:outline-none"
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
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl p-2 space-y-1.5 bg-slate-950/50">
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
                className="rounded-lg px-4 py-2 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateGroup}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-3xs font-bold text-white transition-all cursor-pointer"
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
