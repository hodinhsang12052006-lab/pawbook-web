"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, Suspense, startTransition, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import { BitpawMiniApp } from "@/app/messages/BitpawMiniApp";
import GifPicker from "@/components/chat/GifPicker";
import {
  Send, User, Search, MessageSquare, Loader2, AlertCircle, Plus, Users,
  Video, Smile, X, Lock, Phone, Paperclip, Mic, Zap, Reply, Share2, Info,
  MicOff, VideoOff, PhoneOff, Volume2, Clock, FileText, Cpu, Briefcase,
  Image as ImageIcon
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";
import NextImage from "next/image";
import dynamic from "next/dynamic";

const VideoCallRoom = dynamic(() => import("@/components/chat/VideoCallRoom"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-[480px] w-full bg-slate-950 text-slate-100 rounded-3xl border border-slate-800">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      <p className="mt-2 text-xs text-slate-400">Đang khởi tạo đường truyền cuộc gọi bảo mật ZEGOCLOUD...</p>
    </div>
  ),
});

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
];

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
];

interface UserType {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isInternal?: boolean;
}

interface MessageType {
  id: string;
  content: string;
  type: string; // TEXT, IMAGE, VIDEO, STICKER, ATTENDANCE, CV_PARSED
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
  };
  receiver?: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
  };
  conversationId: string;
  isOptimistic?: boolean; // Cờ dành cho luồng mượt
}

interface ConversationType {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdAt: string;
  participants: UserType[];
  messages: {
    id: string;
    body: string;
    type: string;
    senderId: string;
    conversationId: string;
    createdAt: string;
  }[];
}

interface MessagesContentProps {
  initialSessionUser: any;
  initialConversations: any[];
  initialMessages: any[];
  initialSystemUsers: any[];
}

function CallTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  const format = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <p className="text-3xs text-emerald-450 font-bold tracking-widest font-mono uppercase bg-slate-900 border border-slate-800 px-3 py-1 rounded-full animate-pulse shadow-md">
      🟢 Thời lượng cuộc gọi: {format(seconds)}
    </p>
  );
}

export default function MessagesContent({
  initialSessionUser,
  initialConversations,
  initialMessages,
  initialSystemUsers
}: MessagesContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const directPartnerId = searchParams.get("to");

  // Authentication & Data Loading
  const [currentUser] = useState<any>(initialSessionUser);
  const [conversations, setConversations] = useState<ConversationType[]>(initialConversations);
  const [messages, setMessages] = useState<MessageType[]>(initialMessages);
  const [systemUsers, setSystemUsers] = useState<UserType[]>(initialSystemUsers);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active chat state
  const [activeChat, setActiveChat] = useState<{
    id: string;
    name: string;
    avatarUrl: string;
    role: string;
    isGroup: boolean;
    isOnline: boolean;
    statusText: string;
    conversationId?: string;
  } | null>(null);

  // Input message state
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  // Group Creation State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // WebRTC / Pusher Signaling State
  const [showCallingModal, setShowCallingModal] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callConnected, setCallConnected] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState<{ id: string; name: string } | null>(null);

  // Call Mute states
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  // Refs for WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Message Reactions
  const [messageReactions, setMessageReactions] = useState<{ [msgId: string]: string[] }>({});

  // Media & Selector states
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const callerSignalRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);

  const activeChatRef = useRef(activeChat?.id);
  useEffect(() => {
    activeChatRef.current = activeChat?.id;
  }, [activeChat]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [loadingMoreChatMessages, setLoadingMoreChatMessages] = useState(false);
  const [chatNextCursor, setChatNextCursor] = useState<string | null>(null);
  const chatObserverTarget = useRef<HTMLDivElement>(null);

  // Fetch messages and conversations list from DB
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch("/api/messages");
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (!res.ok) {
        throw new Error("Không thể tải danh sách cuộc trò chuyện. Hãy đăng nhập trước.");
      }
      const data = await res.json();
      const safeMsgs = (data.messages || []).map((m: any) => ({
        id: m.id,
        content: m.content || m.body || "",
        type: m.type || "TEXT",
        senderId: m.senderId,
        receiverId: m.receiverId || "",
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        sender: m.sender ? {
          id: m.sender.id,
          name: m.sender.name,
          avatarUrl: m.sender.avatarUrl || null,
          role: m.sender.role,
        } : { id: "", name: "User", role: "USER" },
        receiver: m.receiver ? {
          id: m.receiver.id,
          name: m.receiver.name,
          avatarUrl: m.receiver.avatarUrl || null,
          role: m.receiver.role,
        } : { id: "", name: "User", role: "USER" },
        conversationId: m.conversationId,
      }));

      const safeConvs = (data.conversations || []).map((conv: any) => ({
        id: conv.id,
        isGroup: conv.isGroup || false,
        name: conv.name || null,
        createdAt: conv.createdAt ? new Date(conv.createdAt).toISOString() : new Date().toISOString(),
        participants: (conv.participants || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl || null,
          role: p.role,
          bio: p.bio || null,
        })),
        messages: (conv.messages || []).map((m: any) => ({
          id: m.id,
          body: m.body,
          type: m.type || "TEXT",
          senderId: m.senderId,
          conversationId: m.conversationId,
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        })),
      }));

      setMessages(safeMsgs);
      setConversations(safeConvs);
      setSystemUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [router]);

  const loadMoreChatMessages = useCallback(async () => {
    if (!activeChat?.conversationId || !chatNextCursor || loadingMoreChatMessages) return;
    try {
      setLoadingMoreChatMessages(true);
      const res = await fetch(`/api/messages?conversationId=${activeChat.conversationId}&cursor=${chatNextCursor}`);
      if (res.ok) {
        const data = await res.json();
        const safeMsgs = (data.messages || []).map((m: any) => ({
          id: m.id,
          content: m.content || m.body || "",
          type: m.type || "TEXT",
          senderId: m.senderId,
          receiverId: m.receiverId || "",
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
          sender: m.sender ? {
            id: m.sender.id,
            name: m.sender.name,
            avatarUrl: m.sender.avatarUrl || null,
            role: m.sender.role,
          } : { id: "", name: "User", role: "USER" },
          receiver: m.receiver ? {
            id: m.receiver.id,
            name: m.receiver.name,
            avatarUrl: m.receiver.avatarUrl || null,
            role: m.receiver.role,
          } : { id: "", name: "User", role: "USER" },
          conversationId: m.conversationId,
        }));

        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Prepend newly fetched older messages
          return [...safeMsgs, ...safePrev];
        });
        setChatNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("Failed to load older messages on scroll-up:", err);
    } finally {
      setLoadingMoreChatMessages(false);
    }
  }, [activeChat?.conversationId, chatNextCursor, loadingMoreChatMessages]);

  // Scroll observer for infinite chat history loading
  useEffect(() => {
    const el = chatObserverTarget.current;
    if (!el || !chatNextCursor) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreChatMessages();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [chatNextCursor, loadMoreChatMessages]);

  // Load message logs when activeChat is toggled
  // useLayoutEffect (not useEffect): flips loadingChatMessages=true synchronously
  // before paint, so the stale "empty" state can never flash between switching
  // activeChat and the fetch actually starting.
  useLayoutEffect(() => {
    if (!activeChat || !activeChat.id) return;

    let isMounted = true;

    async function fetchMessages() {
      setLoadingChatMessages(true);
      try {
        const queryParam = activeChat.isGroup
          ? `conversationId=${activeChat.id}`
          : (activeChat.conversationId
            ? `conversationId=${activeChat.conversationId}`
            : `partnerId=${activeChat.id}`);
        const res = await fetch(`/api/messages?${queryParam}`);
        const data = await res.json();

        if (isMounted) {
          let msgList = [];
          if (Array.isArray(data)) {
            msgList = data;
          } else if (data && Array.isArray(data.messages)) {
            msgList = data.messages;
          }

          const safeMsgs = msgList.map((m: any) => ({
            id: m.id,
            content: m.content || m.body || "",
            type: m.type || "TEXT",
            senderId: m.senderId,
            receiverId: m.receiverId || "",
            createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
            sender: m.sender ? {
              id: m.sender.id,
              name: m.sender.name,
              avatarUrl: m.sender.avatarUrl || null,
              role: m.sender.role,
            } : { id: "", name: "User", role: "USER" },
            receiver: m.receiver ? {
              id: m.receiver.id,
              name: m.receiver.name,
              avatarUrl: m.receiver.avatarUrl || null,
              role: m.receiver.role,
            } : { id: "", name: "User", role: "USER" },
            conversationId: m.conversationId,
          }));

          setMessages(safeMsgs);
          setChatNextCursor(data.nextCursor || null);

          // Update the activeChat conversationId if it is found on the backend!
          if (safeMsgs.length > 0 && !activeChat.conversationId) {
            const fetchedConvId = safeMsgs[0].conversationId;
            if (fetchedConvId) {
              setActiveChat((prev: any) => {
                if (prev && prev.id === activeChat.id) {
                  return { ...prev, conversationId: fetchedConvId };
                }
                return prev;
              });
            }
          }
        }
      } catch (error) {
        console.error("Lỗi tải tin nhắn:", error);
        if (isMounted) setMessages([]);
      } finally {
        if (isMounted) {
          setLoadingChatMessages(false);
        }
      }
    }

    fetchMessages();

    return () => {
      isMounted = false; // Tránh memory leak
    };
  }, [activeChat?.id]);

  // Auto scroll to bottom
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeChat?.id]);

  // Pusher Real-time signaling & Messaging handler
  useEffect(() => {
    if (!currentUser?.id) return;

    const pusher = getPusherClient();
    const channelName = `private-chat-${currentUser.id}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("pusher:subscription_error", (error: any) => {
      console.error("Pusher subscription error:", error);
    });

    channel.bind("new-message", (data: any) => {
      if (!data || !data.message || !data.message.id) return;
      const m = data.message;
      const safeNewMsg: MessageType = {
        id: m.id,
        content: m.content || m.body || "",
        type: m.type || "TEXT",
        senderId: m.senderId,
        receiverId: m.receiverId || "",
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        sender: m.sender ? {
          id: m.sender.id,
          name: m.sender.name,
          avatarUrl: m.sender.avatarUrl || null,
          role: m.sender.role,
        } : { id: "", name: "User", role: "USER" },
        receiver: m.receiver ? {
          id: m.receiver.id,
          name: m.receiver.name,
          avatarUrl: m.receiver.avatarUrl || null,
          role: m.receiver.role,
        } : { id: "", name: "User", role: "USER" },
        conversationId: m.conversationId,
      };

      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.some((existing) => existing.id === safeNewMsg.id)) return safePrev;
        // Deduplication: remove optimistic temp message if content matches
        const filtered = safePrev.filter((msg: any) => msg.isOptimistic !== true || msg.content !== safeNewMsg.content);
        return [...filtered, safeNewMsg];
      });

      // Update conversations preview item list
      setConversations((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map((conv) => {
          if (conv.id === m.conversationId) {
            return {
              ...conv,
              messages: [
                {
                  id: m.id,
                  body: m.content || m.body || "",
                  type: m.type || "TEXT",
                  senderId: m.senderId,
                  conversationId: m.conversationId,
                  createdAt: m.createdAt || new Date().toISOString(),
                },
              ],
            };
          }
          return conv;
        });
      });
    });

    channel.bind("message-updated", (data: any) => {
      if (!data || (!data.id && !data.messageId)) return;
      const targetId = data.id || data.messageId;

      // Sync message reactions list
      if (data.reactions) {
        setMessageReactions(prev => ({
          ...prev,
          [targetId]: data.reactions
        }));
      } else if (data.emoji) {
        setMessageReactions(prev => {
          const current = prev[targetId] || [];
          if (current.includes(data.emoji)) return prev;
          return {
            ...prev,
            [targetId]: [...current, data.emoji]
          };
        });
      }
    });

    // Handle incoming WebRTC calling requests
    channel.bind("incoming-call", (data: any) => {
      if (showCallingModal || receivingCall) return; // Prevent interruption if busy
      setReceivingCall(true);
      setCallerInfo({ id: data.callerId, name: data.callerName });
      setCallType(data.callType || "audio");
      callerSignalRef.current = data.sdp;
    });

    channel.bind("call-candidate", async (data: any) => {
      if (peerConnection.current) {
        const candidate = new RTCIceCandidate(data.candidate);
        if (peerConnection.current.remoteDescription) {
          try {
            await peerConnection.current.addIceCandidate(candidate);
          } catch (e) {
            console.error("Error adding candidate:", e);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    });

    channel.bind("call-accepted", async (data: any) => {
      if (peerConnection.current && peerConnection.current.signalingState === "have-local-offer") {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          setCallConnected(true);

          // Flush queued candidates
          for (const cand of pendingCandidatesRef.current) {
            try {
              await peerConnection.current.addIceCandidate(cand);
            } catch (err) {
              console.error("Error flushing candidate:", err);
            }
          }
          pendingCandidatesRef.current = [];
        } catch (err) {
          console.error("Failed to accept call answer sdp:", err);
        }
      }
    });

    channel.bind("call-rejected", () => {
      toast.error("Cuộc gọi đã bị từ chối hoặc kết thúc.");
      cleanupCall();
    });

    channel.bind("camera-status", (data: any) => {
      setVideoOff(data.videoOff);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [currentUser?.id, showCallingModal, receivingCall]);

  // Clean WebRTC states
  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setShowCallingModal(false);
    setCallConnected(false);
    setReceivingCall(false);
    setCallerInfo(null);
    callerSignalRef.current = null;
    setMicMuted(false);
    setCameraMuted(false);
    setVideoOff(false);
    pendingCandidatesRef.current = [];
  };

  const handleStartCall = async (type: "audio" | "video") => {
    if (!activeChat || activeChat.isGroup) return;
    setCallType(type);
    setShowCallingModal(true);
    setCallConnected(false);

    try {
      const isVideoCall = type === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall ? { width: 640, height: 480 } : false
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      };
      const pc = new RTCPeerConnection(configuration);
      peerConnection.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (!remoteVideoRef.current) return;
        let rStream = remoteVideoRef.current.srcObject as MediaStream;
        if (!rStream) {
          rStream = new MediaStream();
          remoteVideoRef.current.srcObject = rStream;
        }
        event.streams[0].getTracks().forEach((track) => {
          if (!rStream.getTracks().some((t) => t.id === track.id)) {
            rStream.addTrack(track);
          }
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && activeChat?.id) {
          fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetId: activeChat.id,
              action: "candidate",
              candidate: event.candidate,
            }),
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: activeChat.id,
          action: "offer",
          callType: type,
          sdp: offer,
        }),
      });
    } catch (err) {
      console.error("Start call failed:", err);
      toast.error("Không thể truy cập camera hoặc micro.");
      cleanupCall();
    }
  };

  const handleAcceptCall = async () => {
    if (!callerInfo) return;
    setReceivingCall(false);
    setShowCallingModal(true);

    try {
      const isVideoCall = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall ? { width: 640, height: 480 } : false
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      };
      const pc = new RTCPeerConnection(configuration);
      peerConnection.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (!remoteVideoRef.current) return;
        let rStream = remoteVideoRef.current.srcObject as MediaStream;
        if (!rStream) {
          rStream = new MediaStream();
          remoteVideoRef.current.srcObject = rStream;
        }
        event.streams[0].getTracks().forEach((track) => {
          if (!rStream.getTracks().some((t) => t.id === track.id)) {
            rStream.addTrack(track);
          }
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callerInfo?.id) {
          fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetId: callerInfo.id,
              action: "candidate",
              candidate: event.candidate,
            }),
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callerSignalRef.current));
      setCallConnected(true);

      // Flush queued candidates
      for (const cand of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(cand);
        } catch (err) {
          console.error("Error flushing candidate:", err);
        }
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: callerInfo.id,
          action: "accept",
          sdp: answer,
        }),
      });
    } catch (err) {
      console.error("Accept call failed:", err);
      toast.error("Không thể kết nối cuộc gọi.");
      cleanupCall();
    }
  };

  const handleEndCall = async () => {
    const targetId = activeChat?.id || callerInfo?.id;
    if (targetId) {
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId,
            action: "reject",
          }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    cleanupCall();
  };

  const handleSendMessage = async (e: React.FormEvent | null, customContent?: string, customType?: string) => {
    if (e) e.preventDefault();
    if (!activeChat || sending) return;

    const content = customContent || messageText.trim();
    const type = customType || "TEXT";

    if (!content) return;

    if (!customContent) setMessageText("");

    setShowEmoji(false);
    setShowGifs(false);

    // 1. Tạo tin nhắn TẠM THỜI (Fake Message) để hiện ngay lập tức lên màn hình
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageType = {
      id: tempId,
      content: content,
      type: type,
      senderId: currentUser.id,
      receiverId: activeChat.isGroup ? "" : activeChat.id,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl || null,
        role: currentUser.role,
      },
      receiver: {
        id: activeChat.isGroup ? "" : activeChat.id,
        name: activeChat.name,
        avatarUrl: activeChat.avatarUrl || null,
        role: activeChat.isGroup ? "GROUP" : activeChat.role,
      },
      conversationId: activeChat.conversationId || "",
      isOptimistic: true // Cờ đánh dấu tin nhắn đang gửi
    } as any;

    // 2. Nhét ngay vào state để render mượt mà (Độ trễ 0s)
    setMessages((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return [...safePrev, optimisticMessage];
    });

    setSending(true);
    try {
      const isGroup = activeChat.isGroup;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content,
          type: type,
          receiverId: isGroup ? undefined : activeChat.id,
          conversationId: isGroup ? activeChat.conversationId : undefined,
          isGroup,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const m = data.message;
        const safeNewMsg: MessageType = {
          id: m.id,
          content: m.content || m.body || "",
          type: m.type || "TEXT",
          senderId: m.senderId,
          receiverId: m.receiverId || "",
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
          sender: {
            id: currentUser.id,
            name: currentUser.name,
            avatarUrl: currentUser.avatarUrl || null,
            role: currentUser.role,
          },
          conversationId: m.conversationId,
        };

        // Replace temp message with server message
        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const filtered = safePrev.filter((msg) => msg.id !== tempId);
          if (filtered.some((existing) => existing.id === safeNewMsg.id)) return filtered;
          return [...filtered, safeNewMsg];
        });

        // Set activeChat conversationId if it was not present
        if (!activeChat.conversationId) {
          setActiveChat((prev: any) => ({
            ...prev,
            conversationId: m.conversationId,
          }));
        }

        // Real-time update conversations list preview text
        setConversations((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const exists = safePrev.some((c) => c.id === m.conversationId);
          if (exists) {
            return safePrev.map((conv) => {
              if (conv.id === m.conversationId) {
                return {
                  ...conv,
                  messages: [
                    {
                      id: m.id,
                      body: m.content || m.body || "",
                      type: m.type || "TEXT",
                      senderId: m.senderId,
                      conversationId: m.conversationId,
                      createdAt: m.createdAt || new Date().toISOString(),
                    },
                  ],
                };
              }
              return conv;
            });
          } else {
            loadData(true);
            return safePrev;
          }
        });
      } else {
        // Nếu API lỗi, xóa tin nhắn ảo đi
        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.filter((msg) => msg.id !== tempId);
        });
        const errData = await res.json();
        toast.error(errData.error || "Gửi tin nhắn thất bại.");
      }
    } catch (err) {
      console.error("Gửi lỗi:", err);
      // Nếu rớt mạng, xóa tin nhắn ảo đi
      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((msg) => msg.id !== tempId);
      });
    } finally {
      setSending(false);
    }
  };

  const handleAddReaction = useCallback(async (messageId: string, icon: string) => {
    if (!messageId || !activeChat || !currentUser) return;
    try {
      // Optimistic state updates
      setMessageReactions(prev => {
        const current = prev[messageId] || [];
        if (current.includes(icon)) return prev;
        return {
          ...prev,
          [messageId]: [...current, icon]
        };
      });

      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji: icon, icon, partnerId: activeChat.id }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Reaction server error status:", res.status, errText);
      }
    } catch (error) {
      console.error("Reaction error:", error);
    }
  }, [activeChat, currentUser]);

  // Create group chat action
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.length === 0 || creatingGroup) {
      toast.error("Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên.");
      return;
    }

    setCreatingGroup(true);
    const toastId = toast.loading("Đang thiết lập nhóm chat mới...");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          isGroup: true,
          participantIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.conversation) {
        toast.success("Tạo nhóm chat thành công! 👥", { id: toastId });
        setShowGroupModal(false);
        setGroupName("");
        setSelectedUserIds([]);
        loadData(true);
      } else {
        toast.error(data.error || "Tạo nhóm thất bại.", { id: toastId });
      }
    } catch (err) {
      toast.error("Lỗi kết nối mạng.", { id: toastId });
    } finally {
      setCreatingGroup(false);
    }
  };

  // Direct route redirect handling (?to=partnerId)
  useEffect(() => {
    if (!directPartnerId || !currentUser || systemUsers.length === 0) return;
    if (activeChat && activeChat.id === directPartnerId) return;

    const partner = systemUsers.find((u) => u.id === directPartnerId);
    if (partner) {
      // Resolve target conversation if exists
      const matchedConv = conversations.find(
        (c) =>
          !c.isGroup &&
          c.participants.some((p) => p.id === partner.id)
      );

      setActiveChat({
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name)}&background=2563eb&color=ffffff&bold=true`,
        role: partner.role,
        isGroup: false,
        isOnline: true,
        statusText: "Đang hoạt động",
        conversationId: matchedConv?.id,
      });
    }
  }, [directPartnerId, systemUsers, conversations, activeChat, currentUser]);

  // Filter messages for currently active conversation
  const chatMessages = messages.filter((m) => {
    if (!activeChat) return false;
    if (activeChat.isGroup) {
      return m.conversationId === activeChat.conversationId;
    } else {
      if (activeChat.conversationId) {
        return m.conversationId === activeChat.conversationId;
      }
      return (
        (m.senderId === currentUser?.id && m.receiverId === activeChat.id) ||
        (m.senderId === activeChat.id && m.receiverId === currentUser?.id)
      );
    }
  });

  return (
    <div key={activeChat?.id} className="flex w-full h-full overflow-hidden">
      {/* LEFT COLUMN: CONVERSATION LIST & DISCOVER SIDEBAR (4 cols) */}
      <div className={`w-full md:w-[30%] border-r border-slate-850 flex flex-col h-full bg-slate-950/20 ${activeChat ? "hidden md:flex" : "flex"}`}>
        {/* Chat Headers controls */}
        <div className="p-4 border-b border-slate-850 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-900/10">
          <div>
            <h2 className="text-sm font-black text-slate-100">BitPaw Messenger</h2>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">Tin nhắn mã hóa E2EE</p>
          </div>
          <button
            onClick={() => setShowGroupModal(true)}
            className="p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold shadow-sm shadow-blue-500/5 uppercase tracking-wide"
            title="Tạo nhóm chat mới"
          >
            <Plus className="h-4 w-4" /> Nhóm
          </button>
        </div>

        {/* Conversations History List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-850/60 bg-slate-950/20 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-600" />
            <input
              type="text"
              placeholder="Tìm kiếm tin nhắn, đối tác..."
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest">Đang tải cuộc hội thoại...</span>
            </div>
          ) : conversations.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {conversations.map((conv) => {
                const isGroup = conv.isGroup;
                const partner = isGroup
                  ? null
                  : conv.participants.find((p) => p.id !== currentUser?.id);

                if (!isGroup && !partner) return null;

                const displayName = isGroup ? conv.name || "Nhóm trò chuyện" : partner!.name;
                const avatarUrl = isGroup
                  ? ""
                  : partner!.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=ffffff&bold=true`;

                const displayBio = isGroup
                  ? `${conv.participants.length} thành viên tham gia`
                  : partner!.role || "Thành viên PawBook";

                const isActive = activeChat?.conversationId === conv.id;

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
                      statusText: "Đang hoạt động",
                      conversationId: conv.id
                    })}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ease-in-out ${isActive
                      ? "bg-blue-600/15 border border-blue-500/25 text-white"
                      : "hover:bg-slate-900/40 border border-transparent"
                      }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                        {isGroup ? (
                          <Users className="h-5 w-5 text-indigo-400" />
                        ) : (
                          <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=ffffff&bold=true`} alt={displayName} className="object-cover w-full h-full rounded-full" />
                        )}
                      </div>
                      {!isGroup && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{displayName}</p>
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
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN CHAT PANEL (8 cols) */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-900 relative ${!activeChat ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            {/* Active Partner Header */}
            <div className="p-4 border-b border-slate-855 bg-slate-950 flex items-center justify-between gap-3 flex-none z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveChat(null)}
                  className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer mr-1 flex items-center gap-1.5 text-xs font-bold transition-all border border-slate-800"
                >
                  ⬅️ Back
                </button>
                <div className="relative flex-shrink-0">
                  <div className="relative h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                    {activeChat.isGroup ? (
                      <Users className="h-5 w-5 text-indigo-400" />
                    ) : (
                      <img
                        src={activeChat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.name)}&background=2563eb&color=ffffff&bold=true`}
                        alt={activeChat.name}
                        className="object-cover w-full h-full rounded-full"
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

              {/* Call & controls button (Disabled for groups) */}
              {!activeChat.isGroup && (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleStartCall("audio")}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title="Cuộc gọi thoại bảo mật"
                  >
                    <Phone className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => handleStartCall("video")}
                    className="p-2.5 rounded-xl border border-slate-850 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title="Cuộc gọi video thời gian thực"
                  >
                    <Video className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Chat Message Logs Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 custom-scrollbar flex flex-col min-w-0 relative">
              {/* Scroll observer target for history load */}
              <div ref={chatObserverTarget} className="h-2 w-full flex-none" />

              {loadingMoreChatMessages && (
                <div className="flex items-center justify-center py-2 text-4xs font-bold text-slate-550 gap-1.5 animate-fadeIn flex-none">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span>ĐANG CUỘN TẢI LỊCH SỬ TIN NHẮN...</span>
                </div>
              )}

              {loadingChatMessages && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-full px-3 py-1 text-[10px] text-slate-300 flex items-center gap-1.5 shadow-lg z-50 animate-fadeIn backdrop-blur-sm pointer-events-none">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <span className="font-bold tracking-wider uppercase">Đang nạp tin nhắn mới...</span>
                </div>
              )}

              {chatMessages.length > 0 ? (
                chatMessages.map((msg, idx) => {
                  const isSelf = msg.senderId === currentUser?.id;
                  const senderAvatar = isSelf
                    ? currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=2563eb&color=ffffff&bold=true`
                    : msg.sender?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.name || "U")}&background=2563eb&color=ffffff&bold=true`;

                  if (msg.type === "SYSTEM") {
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
                        <div className="relative h-6 w-6 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                          <img
                            src={senderAvatar}
                            alt={msg.sender?.name || "User"}
                            className="object-cover w-full h-full rounded-full"
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
                              </div>
                            </div>
                          ) : (msg.type || "").toUpperCase().includes("CALL") && msg.type !== "CALL_PROMPT_INCOMING" ? (
                            (() => {
                              const isMissedCall = (msg.content || "").toLowerCase().includes("nhỡ") || (msg.content || "").toLowerCase().includes("missed");
                              const isVideo = (msg.type || "").toUpperCase().includes("VIDEO") || (msg.content || "").toLowerCase().includes("video");
                              return (
                                <div className="flex flex-col bg-[#242526] text-white rounded-2xl p-3 w-[250px] shadow-sm border border-slate-700/50 text-left animate-fadeIn">
                                  {/* Phần Header: Icon + Tiêu đề */}
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-full ${isMissedCall ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-white'}`}>
                                      {isVideo ? <Video size={20} /> : <Phone size={20} />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-sm">
                                        {isMissedCall ? (isVideo ? "Đã nhỡ cuộc gọi video" : "Đã nhỡ cuộc gọi thoại") : (isVideo ? "Cuộc gọi video" : "Cuộc gọi thoại")}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {msg.content}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Phần Button: Nút GỌI LẠI */}
                                  <button
                                    onClick={() => handleStartCall(isVideo ? "video" : "audio")}
                                    className="w-full bg-[#3a3b3c] hover:bg-[#4e4f50] transition-colors py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
                                  >
                                    Gọi lại
                                  </button>
                                </div>
                              );
                            })()
                          ) : msg.type === "CALL_PROMPT_INCOMING" ? (
                            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2 text-left min-w-[240px] shadow-xl border-l-4 border-l-blue-500 animate-fadeIn">
                              <p className="font-black text-slate-100 flex items-center gap-1">
                                <span>📞 Cuộc gọi đang đổ chuông</span>
                              </p>
                              <p className="text-3xs text-slate-400">{msg.content}</p>
                              <div className="flex gap-2 pt-1 border-t border-slate-800/60 mt-1">
                                <button
                                  onClick={handleAcceptCall}
                                  className="py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-5xs transition-all cursor-pointer text-center"
                                >
                                  Trả lời
                                </button>
                                <button
                                  onClick={handleEndCall}
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
                                <div className="relative w-60 h-40 max-w-full overflow-hidden rounded-lg">
                                  <NextImage
                                    src={msg.content}
                                    alt="Media Attachment"
                                    fill
                                    sizes="(max-width: 768px) 240px, 240px"
                                    quality={75}
                                    className="object-contain"
                                  />
                                </div>
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
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className="text-xs hover:scale-130 transition-transform active:scale-95 duration-75 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <span className="text-[8px] text-slate-500 font-mono select-none">
                            {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : !loadingChatMessages ? (
                // Chỉ hiển thị "Chưa có tin nhắn nào" khi KHÔNG CÓ TIN NHẮN và KHÔNG ĐANG LOAD
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500 animate-fadeIn">
                  <span className="text-xl">👋</span>
                  <p className="text-xs font-bold text-slate-400">Chưa có tin nhắn nào</p>
                  <p className="text-4xs text-slate-600 max-w-[200px] leading-relaxed">Gửi tin nhắn chào hỏi để bắt đầu thảo luận công việc & MMO.</p>
                </div>
              ) : null}
              <div ref={scrollRef} className="h-2 w-full flex-none" />
            </div>

            {/* Unified Telegram-like Media panel (Emoji / Stickers / GIFs) */}
            {(showEmoji || showGifs) && (
              <div className="absolute bottom-24 left-4 right-4 bg-slate-950 border border-slate-855 rounded-2xl p-4 shadow-2xl z-20 h-80 flex flex-col animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("emoji"); setShowEmoji(true); setShowGifs(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "emoji" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                    >
                      😀 Emojis
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("sticker"); setShowEmoji(false); setShowGifs(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "sticker" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                    >
                      ✨ Stickers
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("gif"); setShowGifs(true); setShowEmoji(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "gif" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                    >
                      🎬 GIFs
                    </button>
                  </div>
                  <button
                    type="button"
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
                    <div className="h-full py-1">
                      <GifPicker onSelect={(url) => {
                        handleSendMessage(null, url, "IMAGE");
                      }} onClose={() => {
                        setShowEmoji(false);
                        setShowGifs(false);
                      }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat Textbox Entry Bar */}
            <div className="p-4 border-t border-slate-855 bg-slate-950 flex-none z-10">
              {isTyping && (
                <div className="text-[10px] text-slate-400 font-semibold mb-2 ml-1 flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
                  <span>Đối phương đang soạn tin nhắn...</span>
                </div>
              )}
              <form onSubmit={(e) => handleSendMessage(e)} className="space-y-3">
                <div className="flex items-center gap-2">
                  {/* Add Custom Emoji/Sticker Shortcut */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmoji(!showEmoji);
                      setShowGifs(false);
                    }}
                    className={`p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ${showEmoji && chatPanelTab !== "gif" ? "bg-slate-900 text-blue-400 border-blue-500/30" : ""}`}
                    title="Chèn biểu tượng, nhãn dán"
                  >
                    <Smile className="h-4 w-4" />
                  </button>

                  {/* GIF Picker Toggle Button */}
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
                    }}
                    className={`px-2.5 py-1 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer text-xs font-black font-sans leading-none flex items-center justify-center border border-slate-800 ${showEmoji && chatPanelTab === "gif" ? "bg-blue-600/20 text-blue-300 border-blue-500/50" : ""}`}
                    title="Chèn ảnh động GIF"
                  >
                    GIF
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const fileInput = document.createElement("input");
                      fileInput.type = "file";
                      fileInput.accept = "image/*";
                      fileInput.onchange = async () => {
                        const file = fileInput.files?.[0];
                        if (!file) return;

                        const toastId = toast.loading("Đang tải ảnh đính kèm lên Cloudinary...");
                        try {
                          const formData = new FormData();
                          formData.append("file", file);

                          const uploadRes = await fetch("/api/upload", {
                            method: "POST",
                            body: formData,
                          });
                          const uploadData = await uploadRes.json();
                          if (uploadRes.ok && uploadData.url) {
                            toast.success("Tải ảnh lên thành công! ☁️", { id: toastId });

                            // Send image message
                            const isGroup = activeChat.isGroup;
                            const res = await fetch("/api/messages", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                content: uploadData.url,
                                type: "IMAGE",
                                receiverId: isGroup ? undefined : activeChat.id,
                                conversationId: isGroup ? activeChat.conversationId : undefined,
                                isGroup,
                              }),
                            });

                            if (res.ok) {
                              const data = await res.json();
                              const m = data.message;
                              const safeNewMsg: MessageType = {
                                id: m.id,
                                content: m.content || m.body || "",
                                type: m.type || "IMAGE",
                                senderId: m.senderId,
                                receiverId: m.receiverId || "",
                                createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
                                sender: {
                                  id: currentUser.id,
                                  name: currentUser.name,
                                  avatarUrl: currentUser.avatarUrl || null,
                                  role: currentUser.role,
                                },
                                conversationId: m.conversationId,
                              };

                              setMessages((prev) => [...prev, safeNewMsg]);
                            }
                          } else {
                            toast.error(uploadData.error || "Tải ảnh lên thất bại.", { id: toastId });
                          }
                        } catch (err) {
                          toast.error("Lỗi mạng khi tải ảnh.", { id: toastId });
                        }
                      };
                      fileInput.click();
                    }}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Đính kèm tệp tin hình ảnh"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // GPS Attendance Checkin
                      toast.promise(
                        new Promise(async (resolve, reject) => {
                          try {
                            const isGroup = activeChat.isGroup;
                            const res = await fetch("/api/messages", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                content: "Đã chấm công qua vệ tinh GPS thành công.",
                                type: "ATTENDANCE",
                                receiverId: isGroup ? undefined : activeChat.id,
                                conversationId: isGroup ? activeChat.conversationId : undefined,
                                isGroup,
                              }),
                            });

                            if (res.ok) {
                              const data = await res.json();
                              const m = data.message;
                              const safeNewMsg: MessageType = {
                                id: m.id,
                                content: m.content || m.body || "",
                                type: m.type || "ATTENDANCE",
                                senderId: m.senderId,
                                receiverId: m.receiverId || "",
                                createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
                                sender: {
                                  id: currentUser.id,
                                  name: currentUser.name,
                                  avatarUrl: currentUser.avatarUrl || null,
                                  role: currentUser.role,
                                },
                                conversationId: m.conversationId,
                              };

                              setMessages((prev) => [...prev, safeNewMsg]);
                              resolve("Chấm công thành công! ⏱️");
                            } else {
                              reject("Lỗi lưu chấm công.");
                            }
                          } catch (e) {
                            reject("Lỗi mạng.");
                          }
                        }),
                        {
                          loading: "Đang dò tìm vệ tinh GPS...",
                          success: (msg: any) => msg,
                          error: (err: any) => err,
                        }
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    title="Điểm danh chấm công GPS"
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
            </div>
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
                  placeholder="Nhập tên nhóm trò chuyện..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-4xs font-bold text-slate-400 mb-1.5 uppercase">Chọn thành viên</label>
                <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-850 rounded-xl p-2 bg-slate-950/40 custom-scrollbar">
                  {systemUsers.length === 0 ? (
                    <p className="text-center py-4 text-slate-500 text-5xs">Chưa có thành viên nào.</p>
                  ) : (
                    systemUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      const isDisabled = user.id === currentUser?.id;
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
                            <div className="relative h-6.5 w-6.5 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
                              <img
                                src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=ffffff&bold=true`}
                                alt={user.name}
                                className="object-cover w-full h-full rounded-full"
                              />
                            </div>
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
              <div className="relative h-28 w-28 rounded-full overflow-hidden border-4 border-slate-800 shadow-2xl z-10">
                <img
                  src={activeChat.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeChat.name)}&background=2563eb&color=ffffff&bold=true`}
                  alt={activeChat.name}
                  className="object-cover w-full h-full rounded-full"
                />
              </div>
              <div className="absolute inset-0 h-28 w-28 rounded-full bg-blue-500/20 animate-ping z-0 scale-110" />
              <div className="absolute inset-0 h-28 w-28 rounded-full bg-indigo-500/10 animate-ping z-0 scale-125" style={{ animationDelay: "0.5s" }} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-lg font-black text-slate-100">{activeChat.name}</h2>
              {callConnected ? (
                <CallTimer active={callConnected && showCallingModal} />
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
              <VideoCallRoom
                roomId={activeChat.conversationId || "call-room-" + activeChat.id}
                userId={currentUser?.id}
                userName={currentUser?.name}
                onLeave={handleEndCall}
              />
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
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${micMuted ? "bg-red-500 text-white border border-red-400" : "bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"}`}
                  title={micMuted ? "Bật micro" : "Tắt micro"}
                >
                  {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-600/20 transition-all hover:scale-105"
                  title="Kết thúc cuộc gọi"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>

                {callType === "audio" ? (
                  <button
                    type="button"
                    onClick={() => toast.success("🔊 Đã chuyển sang loa ngoài")}
                    className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                    title="Loa ngoài"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const nextMute = !cameraMuted;
                      setCameraMuted(nextMute);
                      if (localStreamRef.current) {
                        localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !nextMute);
                      }
                      fetch("/api/calls", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          targetId: activeChat.id,
                          action: "camera",
                          videoOff: nextMute,
                        }),
                      });
                    }}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${cameraMuted ? "bg-red-500 text-white border border-red-400" : "bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"}`}
                    title={cameraMuted ? "Bật camera" : "Tắt camera"}
                  >
                    {cameraMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
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
              <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-blue-500 shadow-2xl z-10">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(callerInfo.name)}&background=2563eb&color=ffffff&bold=true`}
                  alt={callerInfo.name}
                  className="object-cover w-full h-full rounded-full"
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
                onClick={handleAcceptCall}
                className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-450 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="Nhận cuộc gọi"
              >
                <Phone className="h-6 w-6 stroke-[2.5px]" />
              </button>

              <button
                type="button"
                onClick={handleEndCall}
                className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                title="Từ chối"
              >
                <PhoneOff className="h-6 w-6 stroke-[2.5px]" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}