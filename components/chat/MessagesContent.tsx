"use client";

import Link from "next/link";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import GifPicker from "@/components/chat/GifPicker";
import {
  Send, Search, MessageSquare, Loader2, Plus, Users,
  Smile, X, ArrowLeft, Check, CheckCheck, Paperclip, Phone, Video, MoreVertical, Flag, ShieldOff, ShieldCheck, RefreshCw,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { playSound } from "@/lib/sounds";
import { useIsOnline, lastActiveLabel } from "@/lib/presence";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useCallManager } from "@/lib/CallManagerContext";
import { avatarSrc } from "@/lib/avatar";
import { POPULAR_EMOJIS, MOCK_STICKERS, UserType, MessageType, foldVi, shortChatTime, PresenceAvatar, TypingDots, describeCall, ROLE_VI, ConversationType, ActiveChatType, MessagesContentProps, ChatBucket, chatKeyFor, mergeSorted, mapServerMessage } from "./chatShared";
import { ReportUserModal, CreateGroupModal } from "./ChatModals";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { Pin, Palette } from "lucide-react";
import { CHAT_WALLPAPERS, getWallpaperId, saveWallpaper, wallpaperById } from "@/lib/chatWallpapers";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function MessagesContent({
  initialSessionUser,
  initialConversations,
  initialMessages,
  initialSystemUsers,
}: MessagesContentProps) {
  useTr(); // render lại khi đổi VI/EN
  const router = useRouter();
  const searchParams = useSearchParams();
  const directPartnerId = searchParams.get("to");
  const { t, locale } = useLanguage();

  const [currentUser] = useState<any>(initialSessionUser);
  const [conversations, setConversations] = useState<ConversationType[]>(initialConversations);
  const [systemUsers, setSystemUsers] = useState<UserType[]>(initialSystemUsers);
  const [loading, setLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");

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
  // Khung tin mờ chỉ hiện nếu sau 250ms vẫn chưa có gì — mở chat đã có sẵn
  // tin (cache / tải trước) thì không bao giờ thấy trạng thái "đang tải".
  const [showChatSkeleton, setShowChatSkeleton] = useState(false);
  useEffect(() => {
    if (!loadingChatMessages) {
      setShowChatSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowChatSkeleton(true), 250);
    return () => clearTimeout(t);
  }, [loadingChatMessages]);
  const [loadingMoreChatMessages, setLoadingMoreChatMessages] = useState(false);

  const [messageText, setMessageText] = useState("");
  // Realtime: ai đang soạn tin (theo hội thoại, hết hạn sau 4s) và mốc "đã
  // xem" của đối phương (theo hội thoại).
  const [typingByConv, setTypingByConv] = useState<Record<string, string>>({});
  const [seenByConv, setSeenByConv] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialConversations || [])
        .filter((c: ConversationType) => c.partnerLastReadAt)
        .map((c: ConversationType) => [c.id, c.partnerLastReadAt as string])
    )
  );
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef(0);
  const [sending, setSending] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [messageReactions, setMessageReactions] = useState<{ [msgId: string]: string[] }>({});

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");

  // Chặn/Báo cáo — bắt buộc theo App Store Guideline 1.2 cho app có nhắn tin
  // giữa người dùng với nhau.
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  // Tài khoản chính thức PawNail (tick xanh) — luôn ghim đầu danh sách làm kênh hỗ trợ.
  const [official, setOfficial] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/official").then((r) => (r.ok ? r.json() : null)).then((d) => d?.account && setOfficial(d.account)).catch(() => {});
  }, []);
  const [showChatMenu, setShowChatMenu] = useState(false);
  // Hình nền khung chat — riêng từng cuộc trò chuyện, lưu trên thiết bị.
  const [wallpaperId, setWallpaperId] = useState("default");
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [wallpaperForAll, setWallpaperForAll] = useState(false);
  useEffect(() => {
    setWallpaperId(getWallpaperId(activeKey));
  }, [activeKey]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [blockActionLoading, setBlockActionLoading] = useState(false);

  const { startCall } = useCallManager();
  const chatObserverTarget = useRef<HTMLDivElement>(null);
  // ?to= ngoài danh sách systemUsers → tra hồ sơ 1 lần duy nhất mỗi partner.
  const directPartnerLookupRef = useRef<string | null>(null);
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
  // Mở chat tức thì kiểu Messenger/Zalo:
  //  (1) lưu ~40 tin gần nhất của 25 hội thoại trên máy → vào lại trang là có ngay;
  //  (2) tải trước 6 hội thoại gần nhất lúc rảnh;
  //  (3) chạm / rê chuột vào hội thoại là bắt đầu tải trước khi kịp bấm.
  // -------------------------------------------------------------------------
  const CACHE_KEY = currentUser?.id ? `pn_chat_cache_v1_${currentUser.id}` : null;
  const chatBucketsRef = useRef(chatBuckets);
  chatBucketsRef.current = chatBuckets;
  useEffect(() => {
    if (!CACHE_KEY) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, { messages: MessageType[] }>;
      setChatBuckets((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(cached)) {
          if (!Array.isArray(v?.messages)) continue;
          // Bản trên máy chỉ để hiện ngay — giữ cursor null để lần tải mạng
          // đầu tiên vẫn chạy như "mở lần đầu" (lấy đúng phân trang).
          next[k] = next[k] ? { ...next[k], messages: mergeSorted(v.messages, next[k].messages) } : { messages: v.messages, nextCursor: null, fromDisk: true } as ChatBucket;
        }
        return next;
      });
    } catch {}
  }, [CACHE_KEY]);
  useEffect(() => {
    if (!CACHE_KEY) return;
    const t = setTimeout(() => {
      try {
        const entries = Object.entries(chatBuckets)
          .map(([k, b]) => [k, b.messages.filter((m: any) => !m.isOptimistic).slice(-40)] as const)
          .filter(([, m]) => m.length)
          .sort((a, b) => String(b[1][b[1].length - 1]?.createdAt).localeCompare(String(a[1][a[1].length - 1]?.createdAt)))
          .slice(0, 25);
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries.map(([k, m]) => [k, { messages: m }]))));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [chatBuckets, CACHE_KEY]);

  const prefetchingRef = useRef<Set<string>>(new Set());
  const prefetchChat = useCallback(async (conversationId: string) => {
    const b = chatBucketsRef.current[conversationId] as (ChatBucket & { fromDisk?: boolean }) | undefined;
    if ((b && !b.fromDisk) || prefetchingRef.current.has(conversationId)) return;
    prefetchingRef.current.add(conversationId);
    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs = (Array.isArray(data?.messages) ? data.messages : []).map(mapServerMessage);
      setChatBuckets((prev) => {
        const cur = prev[conversationId] as (ChatBucket & { fromDisk?: boolean }) | undefined;
        if (cur && !cur.fromDisk) return prev; // đã mở thật trong lúc chờ
        return { ...prev, [conversationId]: { messages: mergeSorted(cur?.messages ?? [], msgs), nextCursor: data.nextCursor ?? null } };
      });
      if (data?.partnerLastReadAt) setSeenByConv((prev) => ({ ...prev, [conversationId]: data.partnerLastReadAt }));
    } catch {
    } finally {
      prefetchingRef.current.delete(conversationId);
    }
  }, []);

  // Tải trước các hội thoại gần nhất, từng cái một, lúc trình duyệt rảnh.
  const prefetchedTopRef = useRef(false);
  useEffect(() => {
    if (prefetchedTopRef.current || conversations.length === 0) return;
    prefetchedTopRef.current = true;
    const ids = conversations.slice(0, 6).map((c) => c.id);
    let i = 0;
    const next = () => {
      if (i >= ids.length) return;
      prefetchChat(ids[i++]).finally(() => setTimeout(next, 150));
    };
    const t = setTimeout(next, 400);
    return () => clearTimeout(t);
  }, [conversations, prefetchChat]);

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
      if (!res.ok) throw new Error(tr("Không thể tải danh sách cuộc trò chuyện.", "Couldn't load conversations."));
      const data = await res.json();

      const safeConvs: ConversationType[] = (data.conversations || []).map((conv: any) => ({
        id: conv.id,
        isGroup: conv.isGroup || false,
        name: conv.name || null,
        createdAt: conv.createdAt ? new Date(conv.createdAt).toISOString() : new Date().toISOString(),
        participants: (conv.participants || []).map((p: any) => ({
          id: p.id, name: p.name, avatarUrl: p.avatarUrl || null, role: p.role, bio: p.bio || null,
          lastActiveAt: p.lastActiveAt || null,
        })),
        unreadCount: conv.unreadCount || 0,
        partnerLastReadAt: conv.partnerLastReadAt || null,
        messages: (conv.messages || []).map((m: any) => ({
          id: m.id, body: m.body, type: m.type || "TEXT", senderId: m.senderId,
          conversationId: m.conversationId,
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        })),
      }));

      setConversations(safeConvs);
      setSeenByConv((prev) => {
        const next = { ...prev };
        for (const c of safeConvs) if (c.partnerLastReadAt && !next[c.id]) next[c.id] = c.partnerLastReadAt;
        return next;
      });
      setSystemUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load sidebar data:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [router]);

  // Danh sách userId đã chặn — tải 1 lần lúc mount để biết disable khung
  // nhập tin nhắn cho đúng conversation (server vẫn là chốt chặn thật, đây
  // chỉ là UX để không cho gõ tin nhắn vào chat đã chặn).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/block")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.blockedUserIds) setBlockedUserIds(new Set(data.blockedUserIds));
      })
      .catch((err) => console.error("Failed to load blocked users:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const isActiveChatBlocked = !!(activeChat && !activeChat.isGroup && blockedUserIds.has(activeChat.id));

  const handleToggleBlock = useCallback(async () => {
    if (!activeChat || activeChat.isGroup || blockActionLoading) return;
    setBlockActionLoading(true);
    setShowChatMenu(false);
    const wasBlocked = blockedUserIds.has(activeChat.id);
    try {
      const res = await fetch(`/api/block${wasBlocked ? `?userId=${activeChat.id}` : ""}`, {
        method: wasBlocked ? "DELETE" : "POST",
        headers: wasBlocked ? undefined : { "Content-Type": "application/json" },
        body: wasBlocked ? undefined : JSON.stringify({ userId: activeChat.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || tr("Không thể cập nhật trạng thái chặn.", "Couldn't update block status."));
        return;
      }
      setBlockedUserIds((prev) => {
        const next = new Set(prev);
        if (wasBlocked) next.delete(activeChat.id);
        else next.add(activeChat.id);
        return next;
      });
      toast.success(wasBlocked ? tr("Đã bỏ chặn.", "Unblocked.") : tr("Đã chặn người dùng này.", "User blocked."));
    } catch {
      toast.error(tr("Lỗi mạng.", "Network error."));
    } finally {
      setBlockActionLoading(false);
    }
  }, [activeChat, blockedUserIds, blockActionLoading]);

  const handleSubmitReport = useCallback(async () => {
    if (!activeChat || activeChat.isGroup || !reportReason.trim()) return;
    setBlockActionLoading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeChat.id, reason: reportReason.trim() }),
      });
      if (res.ok) {
        toast.success(tr("Đã gửi báo cáo — đội ngũ sẽ xem xét sớm.", "Report sent — our team will review it soon."));
        setShowReportModal(false);
        setReportReason("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || tr("Không thể gửi báo cáo.", "Couldn't send the report."));
      }
    } catch {
      toast.error(tr("Lỗi mạng.", "Network error."));
    } finally {
      setBlockActionLoading(false);
    }
  }, [activeChat, reportReason]);

  // -------------------------------------------------------------------------
  // Load message history whenever the active chat changes. Zero-latency:
  // only shows the spinner if this chat's bucket has never been fetched
  // before; otherwise it's an invisible background refresh that merges in.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!activeChat || !activeChat.id) return;
    const chat = activeChat;
    const key = chatKeyFor(chat)!;
    const existing = chatBuckets[key] as (ChatBucket & { fromDisk?: boolean }) | undefined;
    const isFirstOpen = !existing || !!existing.fromDisk;

    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    async function fetchMessages() {
      // Chỉ báo "đang tải" khi THỰC SỰ chưa có tin nào để hiện.
      if (isFirstOpen && !existing?.messages?.length) setLoadingChatMessages(true);
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
        if (data?.partnerLastReadAt && fetchedConvId) {
          setSeenByConv((prev) => ({ ...prev, [fetchedConvId]: data.partnerLastReadAt }));
        }

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
      } catch (error: any) {
        // AbortError fires every time the user switches chats before this
        // fetch resolves (cleanup below calls controller.abort()) — that's
        // the intended, constant behavior of fast chat-switching, not a
        // failure, so it must not be logged as one.
        if (error?.name !== "AbortError") {
          console.error("Lỗi tải tin nhắn:", error);
        }
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
    } catch (err: any) {
      // "TypeError: Failed to fetch" fires here whenever the browser cancels
      // in-flight requests on navigation/unload — expected, not a bug.
      if (err?.name !== "AbortError") {
        console.error("Failed to load older messages on scroll-up:", err);
      }
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

  // Đánh dấu đã đọc: lưu mốc trên server (bắn "message-seen" cho đối phương)
  // + xoá badge chưa đọc của hội thoại ngay trên giao diện.
  const markSeen = useCallback((conversationId: string) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId && c.unreadCount ? { ...c, unreadCount: 0 } : c)));
    fetch("/api/messages/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
  }, []);
  // -------------------------------------------------------------------------
  // Realtime messaging channel — DÙNG CHUNG với CallManager/
  // UnreadMessagesContext qua lib/pusherUserChannel.ts (xem comment ở đó).
  // Chỉ bind/unbind ĐÚNG các handler của component này bằng tham chiếu hàm,
  // không bao giờ unbind_all()/unsubscribe() — trước đây làm vậy sẽ xóa mất
  // listener "incoming-call" của CallManager mỗi khi rời trang /messages,
  // khiến chuông gọi đến chết vĩnh viễn cho tới khi F5 lại trang.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = acquireUserChannel(currentUser.id);
    if (!channel) return;

    const handleSubscriptionError = (error: any) => {
      console.error("Pusher subscription error:", error);
    };

    const handleNewMessage = (data: any) => {
      if (!data || !data.message || !data.message.id) return;
      const m = data.message;
      const safeNewMsg = mapServerMessage(m);

      const liveActiveChat = activeChatRef.current;
      const belongsToActiveChat =
        liveActiveChat &&
        (liveActiveChat.conversationId
          ? liveActiveChat.conversationId === m.conversationId
          : (m.senderId === liveActiveChat.id || m.receiverId === liveActiveChat.id));

      // Người gửi vừa gửi xong → tắt "đang soạn tin" của họ ngay. Đối phương
      // đã trả lời nghĩa là đã đọc mọi tin trước đó (giống Messenger).
      if (m.senderId !== currentUser.id && m.conversationId) {
        const repliedAt = m.createdAt || new Date().toISOString();
        setSeenByConv((prev) =>
          !prev[m.conversationId] || prev[m.conversationId] < repliedAt ? { ...prev, [m.conversationId]: repliedAt } : prev
        );
        setTypingByConv((prev) => {
          if (!prev[m.conversationId]) return prev;
          const next = { ...prev };
          delete next[m.conversationId];
          return next;
        });
      }

      if (belongsToActiveChat) {
        if (m.senderId !== currentUser.id && m.conversationId && !document.hidden) {
          markSeen(m.conversationId);
        }
        // Tin đến ngay trong khung chat đang mở — tiếng "bóp" nhẹ như Messenger.
        if (m.senderId !== currentUser.id) playSound(document.hidden ? "message" : "messageInChat");
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
      } else if (m.senderId !== currentUser.id) {
        // Tin nhắn thuộc 1 cuộc hội thoại KHÁC cuộc đang mở — vẫn đang ở
        // /messages nên UnreadMessagesContext tự bỏ qua (coi như "đang đọc
        // tin nhắn"), nhưng người dùng thực ra không nhìn thấy tin này, nên
        // tự phát âm thanh ở đây thay vì im lặng bỏ qua hoàn toàn.
        playSound("message");
      }

      setConversations((prev) => {
        const exists = prev.some((conv) => conv.id === m.conversationId);
        // Tin nhắn đầu tiên của 1 cuộc hội thoại HOÀN TOÀN MỚI (chưa từng
        // nhắn qua lại) — .map() bên dưới không thể "thêm" 1 hội thoại chưa
        // tồn tại trong state, nên trước đây sidebar bên nhận không bao giờ
        // hiện hội thoại mới trong thời gian thực, phải F5 mới thấy. Refetch
        // toàn bộ danh sách 1 lần cho đúng trường hợp hiếm này thay vì tự
        // đoán hình dạng participants từ mỗi payload new-message.
        if (!exists) {
          loadData(true);
          return prev;
        }
        return prev.map((conv) =>
          conv.id === m.conversationId
            ? {
                ...conv,
                messages: [{
                  id: m.id, body: m.content || m.body || "", type: m.type || "TEXT",
                  senderId: m.senderId, conversationId: m.conversationId,
                  createdAt: m.createdAt || new Date().toISOString(),
                }],
                unreadCount:
                  m.senderId !== currentUser.id && !belongsToActiveChat
                    ? (conv.unreadCount || 0) + 1
                    : conv.unreadCount || 0,
              }
            : conv
        );
      });
    };

    const handleMessageUpdated = (data: any) => {
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
    };

    const handleMessageSeen = (data: any) => {
      if (!data?.conversationId || !data?.seenAt) return;
      setSeenByConv((prev) => ({ ...prev, [data.conversationId]: data.seenAt }));
    };

    const handleUserTyping = (data: any) => {
      if (!data?.conversationId || data.userId === currentUser.id) return;
      const convId = data.conversationId as string;
      setTypingByConv((prev) => ({ ...prev, [convId]: data.name || "" }));
      clearTimeout(typingTimersRef.current[convId]);
      typingTimersRef.current[convId] = setTimeout(() => {
        setTypingByConv((prev) => {
          const next = { ...prev };
          delete next[convId];
          return next;
        });
      }, 4500);
    };

    channel.bind("pusher:subscription_error", handleSubscriptionError);
    channel.bind("new-message", handleNewMessage);
    channel.bind("message-updated", handleMessageUpdated);
    channel.bind("message-seen", handleMessageSeen);
    channel.bind("user-typing", handleUserTyping);

    return () => {
      channel.unbind("pusher:subscription_error", handleSubscriptionError);
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-updated", handleMessageUpdated);
      channel.unbind("message-seen", handleMessageSeen);
      channel.unbind("user-typing", handleUserTyping);
      releaseUserChannel(currentUser.id);
    };
  }, [currentUser?.id, rekeyBucket, mergeIntoBucket, removeFromBucket, loadData, markSeen]);

  useEffect(() => {
    if (activeChat?.conversationId) markSeen(activeChat.conversationId);
  }, [activeChat?.conversationId, markSeen]);

  // Báo "đang soạn tin" tối đa 1 lần / 3 giây khi gõ.
  const notifyTyping = useCallback(() => {
    const convId = activeChat?.conversationId;
    if (!convId || Date.now() - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = Date.now();
    fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId }),
    }).catch(() => {});
  }, [activeChat?.conversationId]);

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
        // Nhật ký cuộc gọi (CALL) do CallManager tự ghi — không kêu "vút".
        if (customType !== "CALL") playSound("sent");
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
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || tr("Gửi tin nhắn thất bại.", "Message failed to send."));
        patchBucket(sendKey, (bucket) => ({
          ...bucket,
          messages: bucket.messages.map((m) => (m.id === tempId ? { ...m, sendError: true } : m)),
        }));
      }
    } catch (err) {
      console.error("Gửi lỗi:", err);
      toast.error(tr("Không thể gửi tin nhắn. Vui lòng kiểm tra lại kết nối mạng!", "Couldn't send the message. Please check your connection!"));
      // Giữ lại bong bóng tin nhắn (đánh dấu sendError) thay vì xóa mất tích —
      // người dùng bấm "Thử lại" thay vì phải gõ lại từ đầu.
      patchBucket(sendKey, (bucket) => ({
        ...bucket,
        messages: bucket.messages.map((m) => (m.id === tempId ? { ...m, sendError: true } : m)),
      }));
    } finally {
      setSending(false);
    }
  }, [activeChat, sending, currentUser, loadData, mergeIntoBucket, removeFromBucket, rekeyBucket, messageText, patchBucket]);

  // Bấm "Thử lại" trên 1 tin nhắn gửi lỗi — bỏ bong bóng lỗi cũ, gửi lại y
  // nguyên nội dung như 1 lần gửi mới (tạo bong bóng optimistic mới).
  const retrySendMessage = useCallback((msg: MessageType) => {
    const key = chatKeyFor(activeChat);
    removeFromBucket(key, (m) => m.id === msg.id);
    handleSendMessage(null, msg.content, msg.type);
  }, [activeChat, removeFromBucket, handleSendMessage]);

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
      toast.error(tr("Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên.", "Enter a group name and pick at least 1 member."));
      return;
    }
    setCreatingGroup(true);
    const toastId = toast.loading(tr("Đang thiết lập nhóm chat mới...", "Setting up the new group..."));
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), isGroup: true, participantIds: selectedUserIds }),
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        toast.success(tr("Tạo nhóm chat thành công! 👥", "Group created! 👥"), { id: toastId });
        setShowGroupModal(false);
        setGroupName("");
        setSelectedUserIds([]);
        loadData(true);
      } else {
        toast.error(data.error || tr("Tạo nhóm thất bại.", "Couldn't create the group."), { id: toastId });
      }
    } catch (err) {
      toast.error(tr("Lỗi kết nối mạng.", "Network connection error."), { id: toastId });
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
      const rawFile = fileInput.files?.[0];
      if (!rawFile) return;
      const toastId = toast.loading(tr("Đang tải ảnh đính kèm lên Cloudinary...", "Uploading image..."));
      try {
        const file = await prepareFileForUpload(rawFile);
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          toast.success(tr("Tải ảnh lên thành công! ☁️", "Image uploaded! ☁️"), { id: toastId });
          handleSendMessage(null, uploadData.url, "IMAGE");
        } else {
          toast.error(uploadData.error || tr("Tải ảnh lên thất bại.", "Image upload failed."), { id: toastId });
        }
      } catch (err) {
        toast.error(err instanceof FileTooLargeError ? err.message : tr("Lỗi mạng khi tải ảnh.", "Network error while uploading."), { id: toastId });
      }
    };
    fileInput.click();
  }, [activeChat, handleSendMessage]);

  // Direct route redirect handling (?to=partnerId)
  useEffect(() => {
    if (!directPartnerId || !currentUser || systemUsers.length === 0) return;
    if (activeChat && activeChat.id === directPartnerId) return;

    const openWith = (partner: { id: string; name: string; avatarUrl?: string | null; role: string }) => {
      const matchedConv = conversations.find((c) => !c.isGroup && c.participants.some((p) => p.id === partner.id));
      setActiveChat({
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl || "",
        role: partner.role,
        isGroup: false,
        isOnline: true,
        statusText: tr("Đang hoạt động", "Active now"),
        conversationId: matchedConv?.id,
      });
    };

    // systemUsers chỉ là 100 user đầu tiên server trả về — khi hệ thống có
    // hơn 100 tài khoản, bấm "Nhắn tin" với người nằm ngoài danh sách đó
    // trước đây không làm gì cả. Tìm tiếp trong người tham gia các hội thoại
    // sẵn có, rồi cuối cùng lấy hồ sơ công khai của họ từ server.
    const partner =
      systemUsers.find((u) => u.id === directPartnerId) ||
      conversations.flatMap((c) => c.participants).find((p) => p.id === directPartnerId);
    if (partner) {
      openWith(partner);
      return;
    }
    if (directPartnerLookupRef.current === directPartnerId) return;
    directPartnerLookupRef.current = directPartnerId;
    fetch(`/api/profile?id=${encodeURIComponent(directPartnerId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user?.id && user.id !== currentUser.id) openWith(user);
      })
      .catch(() => {});
  }, [directPartnerId, systemUsers, conversations, activeChat, currentUser]);

  // Danh sách hội thoại: sắp theo tin nhắn MỚI NHẤT (trước đây theo ngày
  // tạo hội thoại, chat vừa có tin mới vẫn nằm tít dưới) + lọc theo ô tìm kiếm
  // (trước đây ô tìm kiếm không nối vào đâu cả).
  const conversationRows = useMemo(() => {
    const q = foldVi(listQuery.trim());
    return conversations
      .map((conv) => {
        const partner = conv.isGroup ? null : conv.participants.find((p) => p.id !== currentUser?.id) || null;
        const displayName = conv.isGroup ? conv.name || tr("Nhóm trò chuyện", "Group chat") : partner?.name || "";
        const lastMsg = conv.messages[conv.messages.length - 1];
        return { conv, partner, displayName, lastMsg, sortAt: lastMsg?.createdAt || conv.createdAt };
      })
      .filter((row) => row.conv.isGroup || row.partner)
      .filter((row) => !q || foldVi(row.displayName).includes(q) || foldVi(row.lastMsg?.body || "").includes(q))
      .sort((a, b) => {
        const pa = a.partner?.id === official?.id ? 1 : 0;
        const pb = b.partner?.id === official?.id ? 1 : 0;
        return pb - pa || b.sortAt.localeCompare(a.sortAt);
      });
  }, [conversations, listQuery, currentUser?.id, official?.id]);
  const hasOfficialConv = !!official && conversations.some((c) => !c.isGroup && c.participants.some((p) => p.id === official.id));
  const showOfficialStub = !!official && official.id !== currentUser?.id && !hasOfficialConv && !listQuery.trim();
  const openOfficialChat = () =>
    official &&
    setActiveChat({ id: official.id, name: official.name, avatarUrl: official.avatarUrl || "", role: "ADMIN", isGroup: false, isOnline: false, statusText: "" });

  // Vị trí tin cuối cùng của mình trong đoạn chat (gắn Đã gửi/Đã xem).
  const lastSelfIndex = useMemo(
    () => chatMessages.reduce((acc, m, i) => (m.senderId === currentUser?.id ? i : acc), -1),
    [chatMessages, currentUser?.id]
  );

  // Trạng thái THẬT của đối phương đang chat.
  // Chỉ theo dõi online khi đã có cuộc trò chuyện chung (server từ chối người lạ).
  const partnerOnline = useIsOnline(activeChat && !activeChat.isGroup && activeChat.conversationId ? activeChat.id : null);
  const partnerLastActiveAt = useMemo(() => {
    if (!activeChat || activeChat.isGroup) return null;
    for (const c of conversations) {
      const p = c.participants.find((x) => x.id === activeChat.id);
      if (p?.lastActiveAt) return p.lastActiveAt;
    }
    return null;
  }, [activeChat, conversations]);
  const activeChatTyping = activeChat?.conversationId ? typingByConv[activeChat.conversationId] !== undefined : false;

  const callPartner = activeChat
    ? { id: activeChat.id, name: activeChat.name, avatarUrl: activeChat.avatarUrl, isGroup: activeChat.isGroup, conversationId: activeChat.conversationId }
    : null;

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* LEFT COLUMN: CONVERSATION LIST */}
      <div className={`w-full md:w-[30%] border-r border-slate-850 flex flex-col h-full bg-slate-950/20 ${activeChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-850 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-900/10">
          <div>
            <h2 className="text-sm font-black text-slate-100">{t("messenger.title")}</h2>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">{t("messenger.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 rounded-xl bg-pink-600/10 hover:bg-pink-600/20 border border-pink-500/20 text-pink-400 hover:text-pink-300 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold shadow-sm shadow-pink-500/5 uppercase tracking-wide"
              title={tr("Tạo nhóm chat mới", "New group chat")}
            >
              <Plus className="h-4 w-4" /> {t("messenger.newGroup")}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-850/60 bg-slate-950/20 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-600" />
            <input
              type="search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={t("messenger.searchPlaceholder")}
              aria-label={tr("Tìm cuộc trò chuyện", "Search conversations")}
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {showOfficialStub && (
            <div className="border-b border-slate-850/60 p-2">
              <button
                type="button"
                onClick={openOfficialChat}
                aria-current={activeChat?.id === official!.id ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all ${activeChat?.id === official!.id ? "bg-gradient-to-r from-sky-600/20 to-blue-600/10 ring-1 ring-sky-500/30" : "hover:bg-white/[0.04]"}`}
              >
                <PresenceAvatar watch={false} userId={official!.id} src={avatarSrc(official!.avatarUrl, official!.name, official!.id)} alt={official!.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[13px] font-bold text-slate-100">
                    {official!.name} <VerifiedBadge className="h-3.5 w-3.5" />
                    <Pin className="ml-auto h-3 w-3 flex-shrink-0 rotate-45 text-slate-500" aria-label={tr("Đã ghim", "Pinned")} />
                  </p>
                  <p className="truncate text-[11px] text-sky-300/90">{tr("Hỗ trợ chính thức · nhắn tin cho PawNail", "Official support · message PawNail")}</p>
                </div>
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-6 w-6 text-pink-500 animate-spin" />
              <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest">{t("messenger.loadingConversations")}</span>
            </div>
          ) : conversations.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {conversationRows.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-500">{tr("Không tìm thấy cuộc trò chuyện nào khớp “", "No conversations match “")}{listQuery}&rdquo;.</p>
              )}
              {conversationRows.map(({ conv, partner, displayName, lastMsg }) => {
                const isGroup = conv.isGroup;
                const avatarUrl = isGroup ? "" : partner!.avatarUrl || "";
                const isActive = activeChat?.conversationId === conv.id;
                const fromMe = lastMsg?.senderId === currentUser?.id;
                const unread = isActive ? 0 : conv.unreadCount || 0;
                const isTyping = typingByConv[conv.id] !== undefined;
                const preview = lastMsg
                  ? `${fromMe ? tr("Bạn: ", "You: ") : ""}${lastMsg.type === "IMAGE" ? tr("📷 Ảnh", "📷 Photo") : lastMsg.type === "VIDEO" ? "🎬 Video" : lastMsg.type === "CALL" ? `📞 ${describeCall(lastMsg.body).text}` : lastMsg.body}`
                  : isGroup
                  ? tr(`${conv.participants.length} thành viên`, `${conv.participants.length} members`)
                  : tr("Bắt đầu trò chuyện", "Start chatting");

                return (
                  <button
                    type="button"
                    key={conv.id}
                    onPointerEnter={() => prefetchChat(conv.id)}
                    onTouchStart={() => prefetchChat(conv.id)}
                    onClick={() => setActiveChat({
                      id: isGroup ? conv.id : partner!.id,
                      name: displayName,
                      avatarUrl,
                      role: isGroup ? "GROUP" : partner!.role,
                      isGroup,
                      isOnline: false,
                      statusText: "",
                      conversationId: conv.id,
                    })}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-200 ${isActive ? "bg-gradient-to-r from-pink-600/20 to-fuchsia-600/10 ring-1 ring-pink-500/30" : "hover:bg-white/[0.04]"}`}
                  >
                    {isGroup ? (
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 ring-1 ring-white/10">
                        <Users className="h-5 w-5 text-fuchsia-300" />
                      </span>
                    ) : (
                      <PresenceAvatar userId={partner!.id} src={avatarSrc(avatarUrl, displayName, partner!.id)} alt={displayName} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`flex min-w-0 items-center gap-1 text-[13px] ${unread > 0 ? "font-black text-white" : "font-bold text-slate-100"}`}>
                          <span className="truncate">{displayName}</span>
                          {!isGroup && isVerifiedRole(partner!.role) && <VerifiedBadge className="h-3.5 w-3.5" />}
                          {!isGroup && partner!.id === official?.id && <Pin className="h-3 w-3 flex-shrink-0 rotate-45 text-slate-500" aria-label={tr("Đã ghim", "Pinned")} />}
                        </p>
                        {lastMsg && <span className={`flex-shrink-0 text-[10px] ${unread > 0 ? "font-bold text-pink-300" : "text-slate-500"}`}>{shortChatTime(lastMsg.createdAt)}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!isGroup && (
                          <span className={`flex-shrink-0 rounded px-1.5 py-px text-[9px] font-bold ${isVerifiedRole(partner!.role) ? "bg-sky-500/15 text-sky-300" : "bg-slate-800/80 text-slate-400"}`}>{isVerifiedRole(partner!.role) ? tr("Chính thức", "Official") : ROLE_VI()[partner!.role] || tr("Thành viên", "Member")}</span>
                        )}
                        {isTyping ? (
                          <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-pink-300">
                            {tr("Đang soạn tin ", "Typing ")}<TypingDots />
                          </p>
                        ) : (
                          <p className={`truncate text-[11px] ${unread > 0 ? "font-semibold text-slate-200" : "text-slate-500"}`}>{preview}</p>
                        )}
                        {unread > 0 && (
                          <span className="ml-auto flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-1.5 text-[10px] font-black text-white shadow-md shadow-pink-600/30">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 mt-8 animate-fadeIn">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/15 to-violet-500/15 border border-pink-500/20">
                <MessageSquare className="h-6 w-6 text-pink-400" />
              </span>
              <p className="text-sm font-bold text-slate-200">{t("messenger.noConversations")}</p>
              <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">{t("messenger.noConversationsHint")}</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Link href={currentUser?.role === "OWNER" ? "/?tab=portfolio" : "/?tab=jobs"} className="rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-pink-600/20">
                  {currentUser?.role === "OWNER" ? t("messenger.ctaFindTechs") : t("messenger.ctaFindJobs")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN CHAT PANEL */}
      <div data-wallpaper={wallpaperId} style={activeChat ? wallpaperById(wallpaperId).style : undefined} className={`chat-wallpaper flex-1 flex flex-col h-full overflow-hidden relative ${!activeChat ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            <div className="p-4 border-b border-white/5 bg-slate-950/70 backdrop-blur-md flex items-center justify-between gap-3 flex-none z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveChat(null)}
                  className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer mr-1 flex items-center gap-1 whitespace-nowrap text-xs font-bold transition-all border border-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" /><span className="sr-only">{locale === "vi" ? tr("Quay lại", "Back") : "Back"}</span>
                </button>
                <div className="relative flex-shrink-0">
                  {activeChat.isGroup ? (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 ring-1 ring-white/10">
                      <Users className="h-5 w-5 text-fuchsia-300" />
                    </span>
                  ) : (
                    <PresenceAvatar watch={!!activeChat.conversationId} userId={activeChat.id} src={avatarSrc(activeChat.avatarUrl, activeChat.name, activeChat.id)} alt={activeChat.name} size="h-10 w-10" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="flex min-w-0 items-center gap-1 text-sm font-bold text-slate-100">
                    <span className="truncate">{activeChat.name}</span>
                    {!activeChat.isGroup && isVerifiedRole(activeChat.role) && <VerifiedBadge className="h-4 w-4" />}
                  </h3>
                  {/* Trước đây chấm xanh "đang hoạt động" hiện cứng cho MỌI người
                      (app không theo dõi online) — bỏ, thay bằng thông tin thật. */}
                  <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-400">
                    {activeChatTyping ? (
                      <span className="flex items-center gap-1.5 font-semibold text-pink-300">
                        {tr("Đang soạn tin ", "Typing ")}<TypingDots />
                      </span>
                    ) : activeChat.isGroup ? (
                      <span>{tr("Nhóm trò chuyện", "Group chat")}</span>
                    ) : (
                      <>
                        {partnerOnline ? (
                          <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />{tr(" Đang hoạt động", " Active now")}
                          </span>
                        ) : (
                          <span>{lastActiveLabel(partnerLastActiveAt) || ROLE_VI()[activeChat.role] || tr("Thành viên", "Member")}</span>
                        )}
                        <span className="text-slate-600">·</span>
                        <Link href={`/profile/${activeChat.id}`} className="font-semibold text-pink-300 hover:text-pink-200">
                          {tr("Xem hồ sơ", "View profile")}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Trigger buttons only — the CallManager instance itself is
                  mounted once, globally, at the root layout (see
                  lib/CallManagerContext.tsx) so it survives this header
                  disappearing entirely (e.g. mobile "Back" clears activeChat
                  mid-call, or navigating away from /messages altogether). */}
              {!activeChat.isGroup && (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => callPartner && startCall(callPartner, "audio")}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title={tr("Cuộc gọi thoại bảo mật", "Secure voice call")}
                  >
                    <Phone className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => callPartner && startCall(callPartner, "video")}
                    className="p-2.5 rounded-xl border border-slate-850 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                    title={tr("Cuộc gọi video thời gian thực", "Live video call")}
                  >
                    <Video className="h-4.5 w-4.5" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowChatMenu((v) => !v)}
                      className="p-2.5 rounded-xl border border-slate-850 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-300 cursor-pointer shadow-md"
                      title={tr("Thêm tùy chọn", "More options")}
                    >
                      <MoreVertical className="h-4.5 w-4.5" />
                    </button>

                    {showChatMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                        <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fadeIn">
                          <button
                            onClick={() => { setShowChatMenu(false); setShowWallpaperPicker(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-slate-850 transition-colors"
                          >
                            <Palette className="h-4 w-4 text-pink-400" />{tr(" Hình nền đoạn chat", " Chat wallpaper")}
                          </button>
                          <button
                            onClick={() => { setShowChatMenu(false); setShowReportModal(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-slate-850 transition-colors"
                          >
                            <Flag className="h-4 w-4 text-amber-400" />{tr(" Báo cáo người dùng", " Report user")}
                          </button>
                          <button
                            onClick={handleToggleBlock}
                            disabled={blockActionLoading}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-slate-850 transition-colors disabled:opacity-50"
                          >
                            {isActiveChatBlocked ? (
                              <><ShieldCheck className="h-4 w-4" />{tr(" Bỏ chặn người dùng", " Unblock user")}</>
                            ) : (
                              <><ShieldOff className="h-4 w-4" />{tr(" Chặn người dùng", " Block user")}</>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 custom-scrollbar flex flex-col min-w-0 relative">
              <div ref={chatObserverTarget} className="h-2 w-full flex-none" />

              {loadingMoreChatMessages && (
                <div className="flex items-center justify-center py-2 text-4xs font-bold text-slate-500 gap-1.5 animate-fadeIn flex-none">
                  <Loader2 className="h-3 w-3 animate-spin text-pink-500" />
                  <span>{t("messenger.loadingHistory")}</span>
                </div>
              )}

              {/* Chưa có tin nào để hiện (hiếm — đã có cache + tải trước): khung
                  bong bóng mờ thay cho dòng chữ "đang nạp", giống Messenger. */}
              {showChatSkeleton && chatMessages.length === 0 && (
                <div className="space-y-3 py-2" aria-busy="true" aria-label={t("messenger.loadingMessages")}>
                  {[56, 40, 64, 32, 48].map((w, i) => (
                    <div key={i} className={`flex items-end gap-2 ${i % 2 ? "justify-end" : ""}`}>
                      {i % 2 === 0 && <div className="skeleton h-7 w-7 flex-shrink-0 rounded-full" />}
                      <div className={`skeleton h-9 rounded-2xl ${i % 2 ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              )}

              {chatMessages.length > 0 ? (
                chatMessages.map((msg, idx) => {
                  const isSelf = msg.senderId === currentUser?.id;
                  const senderAvatar = isSelf
                    ? avatarSrc(currentUser.avatarUrl, currentUser.name, currentUser.id)
                    : avatarSrc(
                        // Tin realtime (Pusher) không kèm avatar → chat 1-1 dùng avatar đối phương.
                        msg.sender?.avatarUrl || (!activeChat.isGroup ? activeChat.avatarUrl : ""),
                        msg.sender?.name || (!activeChat.isGroup ? activeChat.name : "U"),
                        msg.senderId
                      );
                  const animClass = freshMessageIds.has(msg.id) ? "message-slide-up" : "";

                  const prevMsg = idx > 0 ? chatMessages[idx - 1] : null;
                  const nextMsg = idx < chatMessages.length - 1 ? chatMessages[idx + 1] : null;
                  const msgDay = new Date(msg.createdAt).toDateString();
                  const showDateSeparator = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== msgDay;
                  // Gom tin liên tiếp của cùng 1 người trong 5 phút thành 1 cụm
                  // (kiểu Messenger): avatar + giờ chỉ ở tin cuối cụm, khoảng
                  // cách giữa các tin trong cụm sát lại.
                  const sameGroup = (a: MessageType | null, b: MessageType | null) =>
                    !!a && !!b && a.senderId === b.senderId && a.type !== "SYSTEM" && b.type !== "SYSTEM" &&
                    new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString() &&
                    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
                  const groupedWithPrev = sameGroup(prevMsg, msg);
                  const isLastInGroup = !sameGroup(msg, nextMsg);
                  const isLastSelf = isSelf && idx === lastSelfIndex;
                  const seenAt = activeChat.conversationId ? seenByConv[activeChat.conversationId] : undefined;
                  const isSeen = isLastSelf && !activeChat.isGroup && !!seenAt && new Date(seenAt).getTime() >= new Date(msg.createdAt).getTime();
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

                  if (msg.type === "CALL") {
                    const call = describeCall(msg.content);
                    return (
                      <React.Fragment key={msg.id || idx}>
                        {dateSeparator}
                        <div className={`my-2 flex w-full justify-center ${animClass}`}>
                          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${call.missed ? "border-rose-500/30 bg-rose-500/10" : "border-white/10 bg-slate-900/70"}`}>
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${call.missed ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                              {call.kind === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                            </span>
                            <div className="text-left">
                              <p className={`text-xs font-bold ${call.missed ? "text-rose-200" : "text-slate-100"}`}>{call.text}</p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {!activeChat.isGroup && callPartner && (
                              <button
                                type="button"
                                onClick={() => startCall(callPartner, call.kind as "audio" | "video")}
                                className="ml-1 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-3 py-1 text-[11px] font-bold text-white"
                              >
                                {tr("Gọi lại", "Call back")}
                              </button>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

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
                      <div className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative ${groupedWithPrev ? "!mt-1" : ""} ${animClass}`}>
                        {!isSelf && (isLastInGroup ? (
                          <div className="relative mb-[22px] h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                            <img src={senderAvatar} alt={msg.sender?.name || "User"} loading="lazy" className="object-cover w-full h-full rounded-full" />
                          </div>
                        ) : (
                          <div className="h-7 w-7 flex-shrink-0" aria-hidden />
                        ))}
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
                                  <span className="text-emerald-500">⏱️</span>{tr(" GPS Chấm Công Thành Công", " GPS check-in successful")}
                                </p>
                                <div className="text-3xs space-y-1 mt-1 text-emerald-300/90 leading-relaxed font-semibold">
                                  <p>{tr("✅ Đã chấm công thành công lúc 08:00 AM.", "✅ Checked in at 08:00 AM.")}</p>
                                  <p>{tr("📍 Vị trí: Trùng khớp với tọa độ Radar.", "📍 Location: matches Radar coordinates.")}</p>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words relative ${isSelf
                                  ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-pink-600/10"
                                  : "bg-slate-800 text-white rounded-2xl rounded-bl-sm border border-slate-700"
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
                                      alt={tr("Hình ảnh", "Image")}
                                      loading="lazy"
                                      className="w-full h-auto max-h-60 object-contain rounded-lg"
                                      onError={(e) => {
                                        const imgEl = e.currentTarget;
                                        imgEl.style.display = "none";
                                        const parent = imgEl.parentElement;
                                        if (parent) {
                                          const bubble = parent.parentElement;
                                          if (bubble) {
                                            bubble.style.background = "none";
                                            bubble.style.backgroundColor = "#0f172a";
                                            bubble.style.border = "1px solid #1e293b";
                                            bubble.style.padding = "6px 12px";
                                            bubble.style.boxShadow = "none";
                                            bubble.style.maxWidth = "220px";
                                            bubble.innerHTML = `<span class='flex items-center gap-1.5 text-[10px] text-slate-400 font-medium'>⚠️ ${tr("Ảnh không hiển thị được", "Image unavailable")}</span>`;
                                          }
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
                                title={tr("Nhấp để xóa cảm xúc", "Click to remove reaction")}
                              >
                                {messageReactions[msg.id].map((emoji, i) => (
                                  <span key={i} className="hover:scale-125 transition-transform duration-100">{emoji}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Giờ gửi ở tin cuối mỗi cụm; tin cuối của mình kèm Đã gửi/Đã xem. */}
                          {(isLastInGroup || isLastSelf) && (
                            <span className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-500 ${isSelf ? "self-end" : "self-start"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                              {isLastSelf && !activeChat.isGroup && !msg.isOptimistic && !msg.sendError && (
                                isSeen ? (
                                  <span className="flex items-center gap-0.5 font-semibold text-pink-300">· <CheckCheck className="h-3 w-3" />{tr(" Đã xem", " Seen")}</span>
                                ) : (
                                  <span className="flex items-center gap-0.5">· <Check className="h-3 w-3" />{tr(" Đã gửi", " Sent")}</span>
                                )
                              )}
                            </span>
                          )}

                          {isSelf && msg.sendError && (
                            <button
                              type="button"
                              onClick={() => retrySendMessage(msg)}
                              className="mt-1 flex items-center gap-1 self-end text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3" />{tr(" Gửi thất bại · Thử lại", " Failed · Retry")}
                            </button>
                          )}

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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3 animate-fadeIn">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 ring-1 ring-pink-500/30 text-2xl">👋</span>
                  <p className="text-sm font-bold text-slate-200">{t("messenger.noMessagesYet")}</p>
                  <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">{t("messenger.noMessagesHint")}</p>
                  {/* Gợi ý câu mở đầu theo vai trò — bấm để điền sẵn vào ô nhập. */}
                  <div className="mt-1 flex max-w-md flex-wrap justify-center gap-2">
                    {(currentUser?.role === "OWNER"
                      ? [tr("Chào bạn, tiệm mình đang cần thợ, bạn còn nhận việc không?", "Hi! Our salon is hiring — are you still taking work?"), tr("Bạn làm được Bột/Dip/Gel-X không?", "Can you do acrylic/dip/Gel-X?"), tr("Khi nào bạn có thể ghé tiệm thử tay nghề?", "When can you come by for a skills trial?")]
                      : [tr("Chào anh/chị, tiệm còn tuyển thợ không ạ?", "Hi, is the salon still hiring?"), tr("Cho em hỏi lương và cách chia turn ạ?", "What's the pay and how are turns split?"), tr("Tiệm có hỗ trợ chỗ ở không ạ?", "Does the salon help with housing?")]
                    ).map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setMessageText(starter)}
                        className="rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-200 hover:bg-pink-500/20 transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Bong bóng "đang soạn tin" của đối phương — realtime qua Pusher. */}
              {activeChatTyping && (
                <div className="flex items-end gap-2 animate-fadeIn" aria-live="polite">
                  <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                    <img src={avatarSrc(activeChat.avatarUrl, activeChat.name, activeChat.id)} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300">
                    <TypingDots />
                    <span className="sr-only">{tr("Đối phương đang soạn tin", "The other person is typing")}</span>
                  </div>
                </div>
              )}
            </div>

            {(showEmoji || showGifs) && (
              <div className="absolute bottom-24 left-4 right-4 bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl z-20 h-80 flex flex-col animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("emoji"); setShowEmoji(true); setShowGifs(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "emoji" ? "bg-pink-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                    >
                      😀 Emojis
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("sticker"); setShowEmoji(false); setShowGifs(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "sticker" ? "bg-pink-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                    >
                      ✨ Stickers
                    </button>
                    <button
                      type="button"
                      onClick={() => { setChatPanelTab("gif"); setShowGifs(true); setShowEmoji(false); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${chatPanelTab === "gif" ? "bg-pink-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
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

            {isActiveChatBlocked ? (
              <div className="p-4 border-t border-white/5 bg-slate-950/70 backdrop-blur-md flex-none z-10 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <ShieldOff className="h-4 w-4 text-red-400 flex-shrink-0" />{tr(" Bạn đã chặn người này.", " You blocked this person.")}
                </p>
                <button
                  onClick={handleToggleBlock}
                  disabled={blockActionLoading}
                  className="flex-shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-900 transition-colors disabled:opacity-50"
                >
                  {tr("Bỏ chặn", "Unblock")}
                </button>
              </div>
            ) : (
            <div className="p-4 border-t border-white/5 bg-slate-950/70 backdrop-blur-md flex-none z-10">
              <form onSubmit={(e) => handleSendMessage(e)} className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowEmoji(!showEmoji); setShowGifs(false); }}
                    className={`p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ${showEmoji && chatPanelTab !== "gif" ? "bg-slate-900 text-pink-400 border-pink-500/30" : ""}`}
                    title={tr("Chèn biểu tượng, nhãn dán", "Insert emoji or sticker")}
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
                    className={`px-2.5 py-1 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-all duration-300 cursor-pointer text-xs font-black font-sans leading-none flex items-center justify-center border border-slate-800 ${showEmoji && chatPanelTab === "gif" ? "bg-pink-600/20 text-pink-300 border-pink-500/50" : ""}`}
                    title={tr("Chèn ảnh động GIF", "Insert GIF")}
                  >
                    GIF
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadImage}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={tr("Đính kèm tệp tin hình ảnh", "Attach an image")}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (e.target.value.trim()) notifyTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (messageText.trim()) {
                          handleSendMessage(null);
                        }
                      }
                    }}
                    disabled={sending}
                    placeholder={t("messenger.inputPlaceholder")}
                    className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className="h-10 w-10 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center disabled:opacity-50 transition-all duration-300 cursor-pointer shadow-lg shadow-pink-500/20"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </div>
              </form>
            </div>
            )}
          </>
        ) : (
          // Màn chào khi chưa chọn hội thoại — trước đây chỉ là 1 icon + 1 dòng
          // chữ giữa khoảng trống lớn. Giờ có lối tắt theo vai trò, liên hệ
          // gần đây (người thật đã từng chat) và mẹo nhắn tin an toàn.
          <div className="flex-1 overflow-y-auto custom-scrollbar animate-fadeIn">
            <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 px-6 py-10">
              <div className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 ring-1 ring-pink-500/30 shadow-lg shadow-pink-600/10">
                  <MessageSquare className="h-7 w-7 text-pink-300" />
                </span>
                <h2 className="mt-4 text-xl font-black tracking-tight text-white">{t("messenger.selectConversation")}</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">{t("messenger.selectConversationHint")}</p>
              </div>

              {conversationRows.length > 0 && (
                <section>
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">{tr("Liên hệ gần đây", "Recent contacts")}</p>
                  <div className="flex flex-wrap gap-3">
                    {conversationRows.slice(0, 6).map(({ conv, partner, displayName }) => (
                      <button
                        key={conv.id}
                        onPointerEnter={() => prefetchChat(conv.id)}
                        onTouchStart={() => prefetchChat(conv.id)}
                        type="button"
                        onClick={() => setActiveChat({
                          id: conv.isGroup ? conv.id : partner!.id,
                          name: displayName,
                          avatarUrl: conv.isGroup ? "" : partner!.avatarUrl || "",
                          role: conv.isGroup ? "GROUP" : partner!.role,
                          isGroup: conv.isGroup,
                          isOnline: false,
                          statusText: "",
                          conversationId: conv.id,
                        })}
                        className="group flex w-16 flex-col items-center gap-1.5"
                      >
                        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/10 transition group-hover:ring-pink-500/60">
                          {conv.isGroup ? <Users className="h-5 w-5 text-fuchsia-300" /> : (
                            <img src={avatarSrc(partner!.avatarUrl, displayName, partner!.id)} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="w-full truncate text-center text-[11px] text-slate-400 group-hover:text-slate-200">{displayName}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid grid-cols-2 gap-3">
                {(currentUser?.role === "OWNER"
                  ? [
                      { href: "/?tab=portfolio", title: tr("Tìm thợ đang rảnh", "Find available techs"), desc: tr("Xem portfolio & nhắn tin ngay", "See portfolios & message now"), icon: "💅" },
                      { href: "/jobs/create", title: tr("Đăng tin tuyển thợ", "Post a job"), desc: tr("Thợ phù hợp sẽ chủ động nhắn", "Matching techs will reach out"), icon: "📢" },
                    ]
                  : [
                      { href: "/?tab=jobs", title: tr("Tìm việc gấp", "Find work fast"), desc: tr("Nhắn tiệm đang tuyển quanh bạn", "Message salons hiring near you"), icon: "🔥" },
                      { href: "/profile", title: tr("Cập nhật portfolio", "Update portfolio"), desc: tr("Ảnh đẹp được tiệm nhắn nhiều hơn", "Great photos get more salon messages"), icon: "📸" },
                    ]
                ).map((a) => (
                  <Link key={a.href} href={a.href} className="glass-card rounded-2xl p-4 transition hover:border-pink-500/40">
                    <span className="text-xl">{a.icon}</span>
                    <p className="mt-2 text-sm font-bold text-white">{a.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{a.desc}</p>
                  </Link>
                ))}
              </section>

              <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />{tr(" Nhắn tin an toàn", " Message safely")}
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
                  <li>{tr("• Thỏa thuận lương, chỗ ở, lịch làm ngay trong chat để có bằng chứng.", "• Agree on pay, housing and schedule in chat so you have a record.")}</li>
                  <li>{tr("• Không chuyển tiền đặt cọc cho bất kỳ ai.", "• Never send a deposit to anyone.")}</li>
                  <li>{tr("• Gặp nội dung lừa đảo? Bấm ⋮ → Báo cáo trong cuộc trò chuyện.", "• See a scam? Tap ⋮ → Report in the conversation.")}</li>
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>

      {showWallpaperPicker && activeChat && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowWallpaperPicker(false)}>
          <div role="dialog" aria-label={tr("Chọn hình nền đoạn chat", "Choose chat wallpaper")} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 text-base font-black text-white"><Palette className="h-5 w-5 text-pink-400" />{tr(" Hình nền đoạn chat", " Chat wallpaper")}</p>
            <p className="mt-1 text-xs text-slate-400">{tr("Chỉ đổi trên máy bạn — người kia không bị đổi theo.", "Only changes on your device — the other person isn't affected.")}</p>
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {CHAT_WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={wallpaperId === w.id}
                  aria-label={tr(w.vi, w.en)}
                  onClick={() => {
                    setWallpaperId(w.id);
                    saveWallpaper(activeKey, w.id, wallpaperForAll);
                  }}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl ring-2 transition-all ${wallpaperId === w.id ? "ring-pink-500" : "ring-white/10 group-hover:ring-white/30"}`} style={w.pattern ? { background: w.swatch, backgroundSize: "60px 60px, auto" } : { background: w.swatch }}>
                    <span className="absolute bottom-2 left-1.5 h-2 w-7 rounded-full bg-slate-700/90" />
                    <span className="absolute bottom-5 right-1.5 h-2 w-6 rounded-full bg-pink-500/90" />
                    {wallpaperId === w.id && <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-pink-500 p-0.5 text-white" />}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300">{tr(w.vi, w.en)}</span>
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={wallpaperForAll}
                onChange={(e) => {
                  setWallpaperForAll(e.target.checked);
                  if (e.target.checked) saveWallpaper(activeKey, wallpaperId, true);
                }}
                className="h-4 w-4 accent-pink-500"
              />
              {tr("Áp dụng cho mọi đoạn chat", "Use for all chats")}
            </label>
            <button type="button" onClick={() => setShowWallpaperPicker(false)} className="mt-4 min-h-[44px] w-full rounded-2xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10">{tr("Xong", "Done")}</button>
          </div>
        </div>
      )}

      {showReportModal && activeChat && (
        <ReportUserModal
          name={activeChat.name}
          reason={reportReason}
          onReasonChange={setReportReason}
          busy={blockActionLoading}
          onCancel={() => { setShowReportModal(false); setReportReason(""); }}
          onSubmit={handleSubmitReport}
        />
      )}

      {showGroupModal && (
        <CreateGroupModal
          groupName={groupName}
          onGroupNameChange={setGroupName}
          users={systemUsers}
          selectedIds={selectedUserIds}
          onToggle={(id) => setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          currentUserId={currentUser?.id}
          onClose={() => setShowGroupModal(false)}
          onCreate={handleCreateGroup}
        />
      )}

    </div>
  );
}
