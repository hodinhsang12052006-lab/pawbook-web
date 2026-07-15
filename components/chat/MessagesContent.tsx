"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import GifPicker from "@/components/chat/GifPicker";
import CallManager, { CallManagerHandle } from "@/components/chat/CallManager";
import {
  Send, User, Search, MessageSquare, Loader2, Plus, Users,
  Smile, X, Lock, Paperclip, Zap, Phone, Video,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { getPusherClient } from "@/lib/pusher";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageToggle from "@/components/layout/LanguageToggle";

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
  type: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender?: { id: string; name: string; avatarUrl: string | null; role: string };
  receiver?: { id: string; name: string; avatarUrl: string | null; role: string };
  conversationId: string;
  isOptimistic?: boolean;
}

interface ConversationType {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdAt: string;
  participants: UserType[];
  messages: { id: string; body: string; type: string; senderId: string; conversationId: string; createdAt: string }[];
}

interface ActiveChatType {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
  isGroup: boolean;
  isOnline: boolean;
  statusText: string;
  conversationId?: string;
}

interface MessagesContentProps {
  initialSessionUser: any;
  initialConversations: any[];
  initialMessages: any[];
  initialSystemUsers: any[];
}

// ---------------------------------------------------------------------------
// Local message cache: Record<chatKey, ChatBucket>. A chat is keyed by its
// real conversationId once known; a brand-new 1-1 chat that hasn't sent or
// received a first message yet has no conversationId, so it's keyed by
// `partner:<userId>` until the server resolves a real one (see rekeyBucket).
//
// This is the whole point of the zero-latency requirement: once a chat's key
// has an entry here, switching back to it renders its messages on the same
// frame — no fetch, no spinner, nothing. A background refresh still runs to
// pick up anything new, but it only ever merges into the bucket, never clears
// it, so the screen never goes blank.
// ---------------------------------------------------------------------------
interface ChatBucket {
  messages: MessageType[];
  nextCursor: string | null;
}

function chatKeyFor(chat: { id: string; conversationId?: string } | null | undefined): string | null {
  if (!chat) return null;
  return chat.conversationId || `partner:${chat.id}`;
}

function mergeSorted(a: MessageType[], b: MessageType[]): MessageType[] {
  const map = new Map<string, MessageType>();
  a.forEach((m) => map.set(m.id, m));
  b.forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
}

function mapServerMessage(m: any): MessageType {
  return {
    id: m.id,
    content: m.content || m.body || "",
    type: m.type || "TEXT",
    senderId: m.senderId,
    receiverId: m.receiverId || "",
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    sender: m.sender
      ? { id: m.sender.id, name: m.sender.name, avatarUrl: m.sender.avatarUrl || null, role: m.sender.role }
      : { id: "", name: "User", role: "USER" } as any,
    receiver: m.receiver
      ? { id: m.receiver.id, name: m.receiver.name, avatarUrl: m.receiver.avatarUrl || null, role: m.receiver.role }
      : { id: "", name: "User", role: "USER" } as any,
    conversationId: m.conversationId,
  };
}

const AVATAR_FALLBACK = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=ffffff&bold=true`;

export default function MessagesContent({
  initialSessionUser,
  initialConversations,
  initialMessages,
  initialSystemUsers,
}: MessagesContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const directPartnerId = searchParams.get("to");
  const { t, locale } = useLanguage();

  const [currentUser] = useState<any>(initialSessionUser);
  const [conversations, setConversations] = useState<ConversationType[]>(initialConversations);
  const [systemUsers, setSystemUsers] = useState<UserType[]>(initialSystemUsers);
  const [loading, setLoading] = useState(false);

  const [activeChat, setActiveChat] = useState<ActiveChatType | null>(null);

  const [chatBuckets, setChatBuckets] = useState<Record<string, ChatBucket>>(() => {
    const seed: Record<string, ChatBucket> = {};
    (initialMessages || []).forEach((m: any) => {
      const key = m.conversationId || `partner:${m.senderId}`;
      const existing = seed[key] || { messages: [], nextCursor: null };
      seed[key] = { messages: mergeSorted(existing.messages, [mapServerMessage(m)]), nextCursor: null };
    });
    return seed;
  });

  const activeKey = chatKeyFor(activeChat);
  const activeBucket = activeKey ? chatBuckets[activeKey] : undefined;
  const chatMessages = activeBucket?.messages ?? [];
  const chatNextCursor = activeBucket?.nextCursor ?? null;

  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [loadingMoreChatMessages, setLoadingMoreChatMessages] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [messageReactions, setMessageReactions] = useState<{ [msgId: string]: string[] }>({});

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");

  const chatObserverTarget = useRef<HTMLDivElement>(null);
  const callManagerRef = useRef<CallManagerHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevChatKeyRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const pendingScrollAdjustRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  // Live mirror of activeChat for the Pusher handler below, which is bound
  // once per session (deps: [currentUser?.id] only) and would otherwise read
  // a frozen activeChat from whenever it first bound.
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Reset ephemeral input UI on chat switch. This must NOT remount the whole
  // component (that would tear down the Pusher subscription and — before the
  // Call/message split — interrupt an active call); it's a targeted reset.
  useEffect(() => {
    setMessageText("");
    setShowEmoji(false);
    setShowGifs(false);
    setChatPanelTab("emoji");
  }, [activeChat?.id]);

  // -------------------------------------------------------------------------
  // Cache write helpers
  // -------------------------------------------------------------------------
  const patchBucket = useCallback((key: string | null, updater: (bucket: ChatBucket) => ChatBucket) => {
    if (!key) return;
    setChatBuckets((prev) => {
      const current = prev[key] || { messages: [], nextCursor: null };
      return { ...prev, [key]: updater(current) };
    });
  }, []);

  const mergeIntoBucket = useCallback((key: string | null, msgs: MessageType[]) => {
    patchBucket(key, (bucket) => ({ ...bucket, messages: mergeSorted(bucket.messages, msgs) }));
  }, [patchBucket]);

  const prependIntoBucket = useCallback((key: string | null, msgs: MessageType[], nextCursor: string | null) => {
    patchBucket(key, (bucket) => ({ messages: mergeSorted(msgs, bucket.messages), nextCursor }));
  }, [patchBucket]);

  const removeFromBucket = useCallback((key: string | null, predicate: (m: MessageType) => boolean) => {
    patchBucket(key, (bucket) => ({ ...bucket, messages: bucket.messages.filter((m) => !predicate(m)) }));
  }, [patchBucket]);

  // Migrates a bucket from a temporary `partner:<id>` key to the real
  // conversationId once the server resolves one.
  const rekeyBucket = useCallback((oldKey: string | null, newKey: string | null) => {
    if (!oldKey || !newKey || oldKey === newKey) return;
    setChatBuckets((prev) => {
      if (!prev[oldKey]) return prev;
      const oldBucket = prev[oldKey];
      const newBucket = prev[newKey] || { messages: [], nextCursor: null };
      const merged: ChatBucket = {
        messages: mergeSorted(newBucket.messages, oldBucket.messages),
        nextCursor: newBucket.nextCursor ?? oldBucket.nextCursor,
      };
      const next = { ...prev };
      delete next[oldKey];
      next[newKey] = merged;
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Sidebar data (conversation list + system users) — independent of the
  // per-chat message cache above.
  // -------------------------------------------------------------------------
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch("/api/messages");
      if (res.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (!res.ok) throw new Error("Không thể tải danh sách cuộc trò chuyện.");
      const data = await res.json();

      const safeConvs: ConversationType[] = (data.conversations || []).map((conv: any) => ({
        id: conv.id,
        isGroup: conv.isGroup || false,
        name: conv.name || null,
        createdAt: conv.createdAt ? new Date(conv.createdAt).toISOString() : new Date().toISOString(),
        participants: (conv.participants || []).map((p: any) => ({
          id: p.id, name: p.name, avatarUrl: p.avatarUrl || null, role: p.role, bio: p.bio || null,
        })),
        messages: (conv.messages || []).map((m: any) => ({
          id: m.id, body: m.body, type: m.type || "TEXT", senderId: m.senderId,
          conversationId: m.conversationId,
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        })),
      }));

      setConversations(safeConvs);
      setSystemUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load sidebar data:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [router]);

  // -------------------------------------------------------------------------
  // Load message history whenever the active chat changes. Zero-latency:
  // only shows the spinner if this chat's bucket has never been fetched
  // before; otherwise it's an invisible background refresh that merges in.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!activeChat || !activeChat.id) return;
    const chat = activeChat;
    const key = chatKeyFor(chat)!;
    const isFirstOpen = !chatBuckets[key];

    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    async function fetchMessages() {
      if (isFirstOpen) setLoadingChatMessages(true);
      try {
        const queryParam = chat.isGroup
          ? `conversationId=${chat.id}`
          : (chat.conversationId ? `conversationId=${chat.conversationId}` : `partnerId=${chat.id}`);
        const res = await fetch(`/api/messages?${queryParam}`, { signal: controller.signal });
        const data = await res.json();
        if (!alive) return;

        const msgList: any[] = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
        const safeMsgs = msgList.map(mapServerMessage);
        const fetchedConvId = safeMsgs[0]?.conversationId;
        const effectiveKey = chat.conversationId || fetchedConvId || key;

        if (effectiveKey !== key) rekeyBucket(key, effectiveKey);

        if (isFirstOpen) {
          // First time ever opening this chat — establish messages + cursor.
          patchBucket(effectiveKey, (bucket) => ({
            messages: mergeSorted(bucket.messages, safeMsgs),
            nextCursor: data.nextCursor ?? null,
          }));
        } else {
          // Background refresh of an already-cached chat — merge only, never
          // touch the pagination cursor (that's owned by loadMoreChatMessages).
          mergeIntoBucket(effectiveKey, safeMsgs);
        }

        if (!chat.conversationId && fetchedConvId) {
          setActiveChat((prev) => (prev && prev.id === chat.id ? { ...prev, conversationId: fetchedConvId } : prev));
        }
      } catch (error) {
        console.error("Lỗi tải tin nhắn:", error);
        // Deliberately not clearing the bucket — a stale-but-present history
        // beats a blank screen on a transient network error.
      } finally {
        clearTimeout(timeoutId);
        if (alive) setLoadingChatMessages(false);
      }
    }

    fetchMessages();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
    // chatBuckets/patchBucket/mergeIntoBucket/rekeyBucket deliberately omitted:
    // this must only re-run when the active chat itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // -------------------------------------------------------------------------
  // Smooth infinite scroll (Telegram-style "load ahead" on scroll-to-top),
  // preserving scroll position — the container never jumps.
  // -------------------------------------------------------------------------
  const loadingMoreRef = useRef(false);

  const loadMoreChatMessages = useCallback(async () => {
    if (!activeChat?.conversationId || !chatNextCursor || loadingMoreRef.current) return;
    const key = activeChat.conversationId;
    try {
      loadingMoreRef.current = true;
      setLoadingMoreChatMessages(true);

      const container = scrollContainerRef.current;
      if (container) {
        pendingScrollAdjustRef.current = { prevScrollHeight: container.scrollHeight, prevScrollTop: container.scrollTop };
      }

      const res = await fetch(`/api/messages?conversationId=${key}&cursor=${chatNextCursor}`);
      if (res.ok) {
        const data = await res.json();
        const safeMsgs = (data.messages || []).map(mapServerMessage);
        prependIntoBucket(key, safeMsgs, data.nextCursor || null);
      } else {
        pendingScrollAdjustRef.current = null;
      }
    } catch (err) {
      console.error("Failed to load older messages on scroll-up:", err);
      pendingScrollAdjustRef.current = null;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreChatMessages(false);
    }
  }, [activeChat?.conversationId, chatNextCursor, prependIntoBucket]);

  useEffect(() => {
    const el = chatObserverTarget.current;
    if (!el || !chatNextCursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreChatMessages(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [chatNextCursor, loadMoreChatMessages]);

  // Track whether the user is scrolled near the bottom, to decide whether a
  // newly arrived message should auto-scroll or leave them where they are.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Single scroll-management effect covering all three cases: restoring
  // position after prepending history, jumping to bottom on chat switch, and
  // smooth-scrolling down for a genuinely new message (own message, or the
  // user was already near the bottom).
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (pendingScrollAdjustRef.current) {
      const { prevScrollHeight, prevScrollTop } = pendingScrollAdjustRef.current;
      el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight);
      pendingScrollAdjustRef.current = null;
      prevMessageCountRef.current = chatMessages.length;
      return;
    }

    if (prevChatKeyRef.current !== activeKey) {
      prevChatKeyRef.current = activeKey;
      prevMessageCountRef.current = chatMessages.length;
      el.scrollTop = el.scrollHeight;
      return;
    }

    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = chatMessages.length;
    if (chatMessages.length <= prevCount) return;

    const lastMsg = chatMessages[chatMessages.length - 1];
    const isOwn = lastMsg?.senderId === currentUser?.id;
    if (isOwn || isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages, activeKey, currentUser?.id]);

  // Which message ids are appearing in the DOM for the first time this
  // session — only these get the entrance animation, so revisiting an
  // already-seen chat doesn't replay it for the whole history.
  const freshMessageIds = useMemo(() => {
    const fresh = new Set<string>();
    chatMessages.forEach((m) => {
      if (!animatedMessageIdsRef.current.has(m.id)) {
        fresh.add(m.id);
        animatedMessageIdsRef.current.add(m.id);
      }
    });
    return fresh;
  }, [chatMessages]);

  // -------------------------------------------------------------------------
  // Realtime messaging channel. Deliberately bound ONLY to currentUser?.id —
  // this must subscribe exactly once per session. Call signaling lives
  // entirely in CallManager's own separate subscription to the same channel,
  // so nothing here can ever interrupt an active call.
  // -------------------------------------------------------------------------
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
      const safeNewMsg = mapServerMessage(m);

      const liveActiveChat = activeChatRef.current;
      const belongsToActiveChat =
        liveActiveChat &&
        (liveActiveChat.conversationId
          ? liveActiveChat.conversationId === m.conversationId
          : (m.senderId === liveActiveChat.id || m.receiverId === liveActiveChat.id));

      if (belongsToActiveChat) {
        const key = chatKeyFor(liveActiveChat);
        if (!liveActiveChat.conversationId && m.conversationId) {
          rekeyBucket(key, m.conversationId);
          setActiveChat((prev) => (prev && prev.id === liveActiveChat.id ? { ...prev, conversationId: m.conversationId } : prev));
          removeFromBucket(m.conversationId, (msg: any) => msg.isOptimistic === true && msg.content === safeNewMsg.content);
          mergeIntoBucket(m.conversationId, [safeNewMsg]);
        } else {
          removeFromBucket(key, (msg: any) => msg.isOptimistic === true && msg.content === safeNewMsg.content);
          mergeIntoBucket(key, [safeNewMsg]);
        }
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === m.conversationId
            ? {
                ...conv,
                messages: [{
                  id: m.id, body: m.content || m.body || "", type: m.type || "TEXT",
                  senderId: m.senderId, conversationId: m.conversationId,
                  createdAt: m.createdAt || new Date().toISOString(),
                }],
              }
            : conv
        )
      );
    });

    channel.bind("message-updated", (data: any) => {
      if (!data || (!data.id && !data.messageId)) return;
      const targetId = data.id || data.messageId;
      if (data.reactions) {
        setMessageReactions((prev) => ({ ...prev, [targetId]: data.reactions }));
      } else if (data.emoji) {
        setMessageReactions((prev) => {
          const current = prev[targetId] || [];
          if (current.includes(data.emoji)) return prev;
          return { ...prev, [targetId]: [...current, data.emoji] };
        });
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [currentUser?.id, rekeyBucket, mergeIntoBucket, removeFromBucket]);

  // -------------------------------------------------------------------------
  // Optimistic send: bubble appears instantly (slide-up animation via
  // freshMessageIds/message-slide-up), request goes out in the background,
  // then the temp bubble is swapped for the confirmed one.
  // -------------------------------------------------------------------------
  const handleSendMessage = useCallback(async (e: React.FormEvent | null, customContent?: string, customType?: string) => {
    if (e) e.preventDefault();
    if (!activeChat || sending) return;

    const content = customContent || messageText.trim();
    const type = customType || "TEXT";
    if (!content) return;

    if (!customContent) setMessageText("");
    setShowEmoji(false);
    setShowGifs(false);

    const sendKey = chatKeyFor(activeChat)!;
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageType = {
      id: tempId,
      content,
      type,
      senderId: currentUser.id,
      receiverId: activeChat.isGroup ? "" : activeChat.id,
      createdAt: new Date().toISOString(),
      sender: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || null, role: currentUser.role },
      receiver: {
        id: activeChat.isGroup ? "" : activeChat.id,
        name: activeChat.name,
        avatarUrl: activeChat.avatarUrl || null,
        role: activeChat.isGroup ? "GROUP" : activeChat.role,
      },
      conversationId: activeChat.conversationId || "",
      isOptimistic: true,
    };

    mergeIntoBucket(sendKey, [optimisticMessage]);
    setSending(true);

    try {
      const isGroup = activeChat.isGroup;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content, type,
          receiverId: isGroup ? undefined : activeChat.id,
          conversationId: isGroup ? activeChat.conversationId : undefined,
          isGroup,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const m = data.message;
        const safeNewMsg = mapServerMessage({ ...m, sender: currentUser });

        const finalKey = m.conversationId || sendKey;
        if (finalKey !== sendKey) rekeyBucket(sendKey, finalKey);
        removeFromBucket(finalKey, (msg) => msg.id === tempId);
        mergeIntoBucket(finalKey, [safeNewMsg]);

        if (!activeChat.conversationId) {
          setActiveChat((prev) => (prev ? { ...prev, conversationId: m.conversationId } : prev));
        }

        setConversations((prev) => {
          const exists = prev.some((c) => c.id === m.conversationId);
          if (exists) {
            return prev.map((conv) =>
              conv.id === m.conversationId
                ? { ...conv, messages: [{ id: m.id, body: m.content || m.body || "", type: m.type || "TEXT", senderId: m.senderId, conversationId: m.conversationId, createdAt: m.createdAt || new Date().toISOString() }] }
                : conv
            );
          }
          loadData(true);
          return prev;
        });
      } else {
        removeFromBucket(sendKey, (msg) => msg.id === tempId);
        const errData = await res.json();
        toast.error(errData.error || "Gửi tin nhắn thất bại.");
      }
    } catch (err) {
      console.error("Gửi lỗi:", err);
      removeFromBucket(sendKey, (msg) => msg.id === tempId);
    } finally {
      setSending(false);
    }
  }, [activeChat, sending, currentUser, loadData, mergeIntoBucket, removeFromBucket, rekeyBucket]);

  const handleGifSelect = useCallback((url: string) => {
    handleSendMessage(null, url, "IMAGE");
  }, [handleSendMessage]);

  const handleCloseMediaPanel = useCallback(() => {
    setShowEmoji(false);
    setShowGifs(false);
  }, []);

  const handleAddReaction = useCallback(async (messageId: string, icon: string) => {
    if (!messageId || !activeChat || !currentUser) return;
    try {
      setMessageReactions((prev) => {
        const current = prev[messageId] || [];
        if (current.includes(icon)) return prev;
        return { ...prev, [messageId]: [...current, icon] };
      });
      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji: icon, icon, partnerId: activeChat.id }),
      });
      if (!res.ok) console.error("Reaction server error status:", res.status);
    } catch (error) {
      console.error("Reaction error:", error);
    }
  }, [activeChat, currentUser]);

  const handleCreateGroup = useCallback(async () => {
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
        body: JSON.stringify({ name: groupName.trim(), isGroup: true, participantIds: selectedUserIds }),
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
  }, [groupName, selectedUserIds, creatingGroup, loadData]);

  const handleUploadImage = useCallback(() => {
    if (!activeChat) return;
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
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          toast.success("Tải ảnh lên thành công! ☁️", { id: toastId });
          handleSendMessage(null, uploadData.url, "IMAGE");
        } else {
          toast.error(uploadData.error || "Tải ảnh lên thất bại.", { id: toastId });
        }
      } catch (err) {
        toast.error("Lỗi mạng khi tải ảnh.", { id: toastId });
      }
    };
    fileInput.click();
  }, [activeChat, handleSendMessage]);

  const handleGpsCheckin = useCallback(async () => {
    if (!activeChat) return;
    // handleSendMessage already reports its own errors via toast — don't wrap
    // it in toast.promise too, that would show a false "success" afterwards
    // since handleSendMessage catches its own failures instead of rejecting.
    const toastId = toast.loading("Đang dò tìm vệ tinh GPS...");
    await handleSendMessage(null, "Đã chấm công qua vệ tinh GPS thành công.", "ATTENDANCE");
    toast.success("Chấm công thành công! ⏱️", { id: toastId });
  }, [activeChat, handleSendMessage]);

  // Direct route redirect handling (?to=partnerId)
  useEffect(() => {
    if (!directPartnerId || !currentUser || systemUsers.length === 0) return;
    if (activeChat && activeChat.id === directPartnerId) return;

    const partner = systemUsers.find((u) => u.id === directPartnerId);
    if (partner) {
      const matchedConv = conversations.find((c) => !c.isGroup && c.participants.some((p) => p.id === partner.id));
      setActiveChat({
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl || AVATAR_FALLBACK(partner.name),
        role: partner.role,
        isGroup: false,
        isOnline: true,
        statusText: "Đang hoạt động",
        conversationId: matchedConv?.id,
      });
    }
  }, [directPartnerId, systemUsers, conversations, activeChat, currentUser]);

  const callPartner = activeChat
    ? { id: activeChat.id, name: activeChat.name, avatarUrl: activeChat.avatarUrl, isGroup: activeChat.isGroup, conversationId: activeChat.conversationId }
    : null;

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Mounted unconditionally — NOT inside "activeChat ? ... : ...". An
          active call must survive switching chats, receiving messages, or
          hitting the mobile "Back" button (which clears activeChat entirely).
          Its full-screen overlays render on top of everything else regardless
          of where in the tree it lives; the header buttons that trigger it
          live below and reach it via the ref. */}
      <CallManager
        ref={callManagerRef}
        currentUserId={currentUser?.id}
        currentUserName={currentUser?.name}
        currentUserAvatar={currentUser?.avatarUrl || null}
        activePartner={callPartner}
      />

      {/* LEFT COLUMN: CONVERSATION LIST */}
      <div className={`w-full md:w-[30%] border-r border-slate-850 flex flex-col h-full bg-slate-950/20 ${activeChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-850 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-900/10">
          <div>
            <h2 className="text-sm font-black text-slate-100">{t("messenger.title")}</h2>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">{t("messenger.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold shadow-sm shadow-blue-500/5 uppercase tracking-wide"
              title="Tạo nhóm chat mới"
            >
              <Plus className="h-4 w-4" /> {t("messenger.newGroup")}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-850/60 bg-slate-950/20 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-600" />
            <input
              type="text"
              placeholder={t("messenger.searchPlaceholder")}
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest">{t("messenger.loadingConversations")}</span>
            </div>
          ) : conversations.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {conversations.map((conv) => {
                const isGroup = conv.isGroup;
                const partner = isGroup ? null : conv.participants.find((p) => p.id !== currentUser?.id);
                if (!isGroup && !partner) return null;

                const displayName = isGroup ? conv.name || "Nhóm trò chuyện" : partner!.name;
                const avatarUrl = isGroup ? "" : partner!.avatarUrl || AVATAR_FALLBACK(displayName);
                const displayBio = isGroup ? `${conv.participants.length} thành viên tham gia` : partner!.role || "Thành viên PawBook";
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
                      conversationId: conv.id,
                    })}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ease-in-out ${isActive ? "bg-blue-600/15 border border-blue-500/25 text-white" : "hover:bg-slate-900/40 border border-transparent"}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                        {isGroup ? <Users className="h-5 w-5 text-indigo-400" /> : (
                          <img src={avatarUrl || AVATAR_FALLBACK(displayName)} alt={displayName} className="object-cover w-full h-full rounded-full" />
                        )}
                      </div>
                      {!isGroup && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{displayName}</p>
                      <p className="text-3xs text-slate-500 truncate leading-relaxed">{displayBio}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 mt-8 animate-fadeIn">
              <MessageSquare className="h-8 w-8 text-slate-700" />
              <p className="text-3xs font-bold text-slate-400">{t("messenger.noConversations")}</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN CHAT PANEL */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-900 relative ${!activeChat ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
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
                    {activeChat.isGroup ? <Users className="h-5 w-5 text-indigo-400" /> : (
                      <img src={activeChat.avatarUrl || AVATAR_FALLBACK(activeChat.name)} alt={activeChat.name} className="object-cover w-full h-full rounded-full" />
                    )}
                  </div>
                  {!activeChat.isGroup && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>{activeChat.name}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Lock className="h-3 w-3 text-emerald-500" />
                    <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Mã hóa đầu cuối (E2EE)</span>
                  </div>
                </div>
              </div>

              {/* Trigger buttons only — the CallManager instance itself is
                  mounted once, unconditionally, at the top of the tree above
                  (see comment there) so it survives this header disappearing
                  entirely (e.g. mobile "Back" clears activeChat mid-call). */}
              {!activeChat.isGroup && (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => callManagerRef.current?.startCall("audio")}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title="Cuộc gọi thoại bảo mật"
                  >
                    <Phone className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => callManagerRef.current?.startCall("video")}
                    className="p-2.5 rounded-xl border border-slate-850 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title="Cuộc gọi video thời gian thực"
                  >
                    <Video className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 custom-scrollbar flex flex-col min-w-0 relative">
              <div ref={chatObserverTarget} className="h-2 w-full flex-none" />

              {loadingMoreChatMessages && (
                <div className="flex items-center justify-center py-2 text-4xs font-bold text-slate-550 gap-1.5 animate-fadeIn flex-none">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span>{t("messenger.loadingHistory")}</span>
                </div>
              )}

              {loadingChatMessages && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-full px-3 py-1 text-[10px] text-slate-300 flex items-center gap-1.5 shadow-lg z-50 animate-fadeIn backdrop-blur-sm pointer-events-none">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <span className="font-bold tracking-wider uppercase">{t("messenger.loadingMessages")}</span>
                </div>
              )}

              {chatMessages.length > 0 ? (
                chatMessages.map((msg, idx) => {
                  const isSelf = msg.senderId === currentUser?.id;
                  const senderAvatar = isSelf
                    ? currentUser.avatarUrl || AVATAR_FALLBACK(currentUser.name)
                    : msg.sender?.avatarUrl || AVATAR_FALLBACK(msg.sender?.name || "U");
                  const animClass = freshMessageIds.has(msg.id) ? "message-slide-up" : "";

                  const prevMsg = idx > 0 ? chatMessages[idx - 1] : null;
                  const msgDay = new Date(msg.createdAt).toDateString();
                  const showDateSeparator = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== msgDay;
                  const dateSeparatorLabel = (() => {
                    if (!showDateSeparator) return null;
                    const d = new Date(msg.createdAt);
                    const today = new Date().toDateString();
                    const yesterday = new Date(Date.now() - 86400000).toDateString();
                    if (msgDay === today) return t("messenger.today");
                    if (msgDay === yesterday) return t("messenger.yesterday");
                    return d.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "long", year: "numeric" });
                  })();
                  const dateSeparator = showDateSeparator ? (
                    <div key={`sep-${msg.id || idx}`} className="flex items-center justify-center my-4 w-full">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/70 border border-slate-850 px-3 py-1 rounded-full shadow-sm">
                        {dateSeparatorLabel}
                      </span>
                    </div>
                  ) : null;

                  if (msg.type === "SYSTEM") {
                    return (
                      <React.Fragment key={msg.id || idx}>
                        {dateSeparator}
                        <div className={`flex justify-center my-3 w-full ${animClass}`}>
                          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900/60 border border-slate-850 text-[10px] text-slate-400 font-semibold tracking-wide font-sans shadow-inner">
                            <span>🤖</span>
                            <span>{msg.content}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={msg.id || idx}>
                      {dateSeparator}
                      <div className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative ${animClass}`}>
                        {!isSelf && (
                          <div className="relative h-6 w-6 rounded-full overflow-hidden border border-slate-800 flex-shrink-0">
                            <img src={senderAvatar} alt={msg.sender?.name || "User"} className="object-cover w-full h-full rounded-full" />
                          </div>
                        )}
                        <div className="flex flex-col max-w-[70%] relative pb-1">
                          {activeChat.isGroup && !isSelf && (
                            <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender?.name}</span>
                          )}

                          <div className="relative">
                            {msg.type === "STICKER" ? (
                              <div className="text-5xl my-2 select-none transform hover:scale-115 hover:-rotate-3 active:scale-95 transition-all cursor-pointer" title="Sticker">
                                {msg.content}
                              </div>
                            ) : msg.type === "ATTENDANCE" ? (
                              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2 min-w-[260px] text-emerald-300 font-sans shadow-lg text-left">
                                <p className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                  <span className="text-emerald-500">⏱️</span> GPS Chấm Công Thành Công
                                </p>
                                <div className="text-3xs space-y-1 mt-1 text-emerald-250/90 leading-relaxed font-semibold">
                                  <p>✅ Đã chấm công thành công lúc 08:00 AM.</p>
                                  <p>📍 Vị trí: Trùng khớp với tọa độ Radar.</p>
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
                                  // Plain <img>, not next/image: content comes from
                                  // arbitrary external hosts (Tenor GIFs, Cloudinary
                                  // uploads). next/image's optimizer 400s on any host
                                  // not explicitly allowlisted — a plain <img> just
                                  // loads the URL directly, no allowlist needed.
                                  <div className="relative w-60 max-w-full overflow-hidden rounded-lg">
                                    <img
                                      src={msg.content}
                                      alt="Hình ảnh"
                                      loading="lazy"
                                      className="w-full h-auto max-h-60 object-contain rounded-lg"
                                      onError={(e) => {
                                        const imgEl = e.currentTarget;
                                        imgEl.style.display = "none";
                                        const parent = imgEl.parentElement;
                                        if (parent && !parent.querySelector(".img-fallback")) {
                                          const fallback = document.createElement("div");
                                          fallback.className = "img-fallback flex flex-col items-center justify-center w-full h-32 bg-slate-950/40 text-slate-500 gap-1.5 text-[10px] border border-slate-800 rounded-lg";
                                          fallback.innerHTML = "⚠️ <span class='font-semibold text-slate-400'>Ảnh lỗi hoặc không tìm thấy</span>";
                                          parent.appendChild(fallback);
                                        }
                                      }}
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
                                onClick={() => setMessageReactions((prev) => ({ ...prev, [msg.id]: [] }))}
                                className={`absolute -bottom-2.5 ${isSelf ? "left-2" : "right-2"} bg-slate-900 border border-slate-800 rounded-full px-1.5 py-0.5 text-[9px] flex items-center gap-0.5 shadow-lg z-20 select-none cursor-pointer hover:bg-slate-800 transition-colors`}
                                title="Nhấp để xóa cảm xúc"
                              >
                                {messageReactions[msg.id].map((emoji, i) => (
                                  <span key={i} className="hover:scale-125 transition-transform duration-100">{emoji}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className={`absolute -top-7 ${isSelf ? "right-0" : "left-0"} flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-lg px-2 py-0.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 backdrop-blur-sm`}>
                            <div className="flex items-center gap-1 border-r border-slate-800 pr-1.5 mr-1.5">
                              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
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
                    </React.Fragment>
                  );
                })
              ) : !loadingChatMessages ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500 animate-fadeIn">
                  <span className="text-xl">👋</span>
                  <p className="text-xs font-bold text-slate-400">{t("messenger.noMessagesYet")}</p>
                  <p className="text-4xs text-slate-600 max-w-[200px] leading-relaxed">{t("messenger.noMessagesHint")}</p>
                </div>
              ) : null}
            </div>

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
                    onClick={() => { setShowEmoji(false); setShowGifs(false); }}
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
                          onClick={() => { handleSendMessage(null, stk.emoji, "STICKER"); setShowEmoji(false); }}
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
                      <GifPicker onSelect={handleGifSelect} onClose={handleCloseMediaPanel} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-855 bg-slate-950 flex-none z-10">
              <form onSubmit={(e) => handleSendMessage(e)} className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowEmoji(!showEmoji); setShowGifs(false); }}
                    className={`p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ${showEmoji && chatPanelTab !== "gif" ? "bg-slate-900 text-blue-400 border-blue-500/30" : ""}`}
                    title="Chèn biểu tượng, nhãn dán"
                  >
                    <Smile className="h-4 w-4" />
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
                    }}
                    className={`px-2.5 py-1 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer text-xs font-black font-sans leading-none flex items-center justify-center border border-slate-800 ${showEmoji && chatPanelTab === "gif" ? "bg-blue-600/20 text-blue-300 border-blue-500/50" : ""}`}
                    title="Chèn ảnh động GIF"
                  >
                    GIF
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadImage}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Đính kèm tệp tin hình ảnh"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleGpsCheckin}
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
                    placeholder={t("messenger.inputPlaceholder")}
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
              <p className="text-xs font-bold text-slate-300">{t("messenger.selectConversation")}</p>
              <p className="text-3xs text-slate-500 mt-1 max-w-[280px] leading-relaxed">{t("messenger.selectConversationHint")}</p>
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
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
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
                            setSelectedUserIds((prev) => isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition-all duration-300 ${isDisabled ? "opacity-35 cursor-not-allowed select-none" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative h-6.5 w-6.5 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
                              <img src={user.avatarUrl || AVATAR_FALLBACK(user.name)} alt={user.name} className="object-cover w-full h-full rounded-full" />
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
                            onChange={() => {}}
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

      <Toaster />
    </div>
  );
}
