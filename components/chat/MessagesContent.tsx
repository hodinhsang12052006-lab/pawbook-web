"use client";

import { apiError } from "@/lib/i18n/apiError";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, MessageSquare, Loader2, Plus, Users, Check, CheckCheck, ShieldOff, ShieldCheck } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { localeHref } from "@/lib/i18n/localeHref";
import toast from "react-hot-toast";
import { acquireUserChannel, releaseUserChannel } from "@/lib/pusherUserChannel";
import { playSound } from "@/lib/sounds";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useCallManager } from "@/lib/CallManagerContext";
import { avatarSrc } from "@/lib/avatar";
import { officialAvatarUrl } from "@/lib/brand";
import { UserType, MessageType, foldVi, shortChatTime, PresenceAvatar, TypingDots, describeCall, ROLE_VI, ConversationType, ActiveChatType, MessagesContentProps, ChatBucket, chatKeyFor, mergeSorted, mapServerMessage } from "./chatShared";
import { ReportUserModal, CreateGroupModal } from "./ChatModals";
import { preloadCallSdkWhenIdle } from "@/lib/callPreload";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { Pin, Sparkles as SparklesIcon, X as XIcon } from "lucide-react";
import MediaLightbox from "@/components/ui/MediaLightbox";
import { getPusherClient } from "@/lib/pusherClient";
import { CS } from "@/lib/i18n/chatStrings";
import ChatSuggestions from "./ChatSuggestions";
import { replyInVietnamese } from "@/lib/chatAssist";
// Khung chat chia 3 phần memo, mỗi phần giữ state riêng: gõ phím chỉ vẽ lại khung soạn tin; tin mới / gửi tin chỉ vẽ lại
// khung tin (trước đây cả màn hình ~2.600 dòng vẽ lại ở mỗi lần đổi — chat_perf: gửi ~700 ms ở CPU chậm 4x).
import ChatHeader from "./ChatHeader";
import ChatThread, { type PartnerTrust, type ThreadMemory } from "./ChatThread";
import ChatComposer, { type ComposerApi, type SendFn, type Unanswered } from "./ChatComposer";
import dynamic from "next/dynamic";
// Thử mẫu PawNail (vẽ mẫu lên ảnh tay khách) — tải khi mở, không làm nặng Messenger lúc vào.
const NailStudio = dynamic(() => import("@/components/studio/NailStudio"), { ssr: false });
const HandConsult = dynamic(() => import("@/components/consult/HandConsult"), { ssr: false });
// Bảng chọn hình nền: chỉ tải khi mở.
const WallpaperSheet = dynamic(() => import("./WallpaperSheet"), { ssr: false });
import { type Reaction, toggleReaction } from "@/lib/chatReactions";
import { uploadMedia } from "@/lib/mediaUpload";
import { chatKeyOf, migrateLegacyWallpaper, resolveChoice, type WpRender } from "@/lib/chatWallpapers";
import { useWallpaperRender, useWpState } from "./useChatWallpaper";
import { mediaPreview } from "@/lib/chat/preview";
import { isGifUrl } from "@/lib/chat/gif";
import { probeGifs } from "@/lib/chat/gifAvailability";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useMounted } from "@/lib/useMounted";
import { clearConversation, nativeHandlesChatAlerts, setActiveConversation } from "@/lib/nativePush";
import ChatNotifyBanner from "./ChatNotifyBanner";
import { detectTextLang } from "@/lib/i18n/detectLang";
import { autoTranslates, getTranslation, markViewerReadsVi, requestTranslation, useMessageTranslation, useTranslationVersion } from "./messageTranslation";
// Messenger V2: CSS riêng (mọi quy tắc nằm dưới .pn-msgr). Import ở đây, không ở app/messages/layout.tsx — nhánh
// đổi route sang app/[lang]/ xoá layout đó; CSS đi cùng component nên không thể bị rơi khi gộp nhánh.
import "./messenger.css";

// Chưa có tin: CÙNG 1 mảng rỗng (mảng mới mỗi lần render làm khung tin memo vẽ lại vô ích)
const NO_MESSAGES: MessageType[] = [];

// Thông tin tin cậy THẬT của đối phương (1 lần / người / phiên): thành phố, ngày tham gia, SĐT đã xác minh.
const trustCache = new Map<string, Promise<PartnerTrust | null>>();
function loadTrust(id: string): Promise<PartnerTrust | null> {
  if (!trustCache.has(id)) {
    trustCache.set(
      id,
      fetch(`/api/profile?id=${encodeURIComponent(id)}&trust=1`)
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => (u && !u.error ? { city: u.city, state: u.state, createdAt: u.createdAt, phoneVerified: u.phoneVerified === true } : null))
        .catch(() => null)
    );
  }
  return trustCache.get(id)!;
}

export default function MessagesContent({
  initialSessionUser,
  initialConversations,
  initialMessages,
  initialSystemUsers,
  bubble = false,
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
  const chatMessages = activeBucket?.messages ?? NO_MESSAGES;
  const chatNextCursor = activeBucket?.nextCursor ?? null;
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

  const [loadingChatMessages, setLoadingChatMessages] = useState(false);

  // Ô nhập KHÔNG điều khiển bằng state: chữ nằm trong DOM (inputRef), mọi trạng thái của khung soạn tin (ô rỗng ↔ có chữ,
  // gợi ý nhãn dán, bảng biểu tượng…) nằm trong ChatComposer. Component này chỉ đọc chữ lúc gửi và điều khiển khung qua
  // composerApi (điền câu gợi ý / bản nháp, xoá sau khi gửi) — không bao giờ vẽ lại vì gõ phím.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerApi = useRef<ComposerApi>(null);
  const setMessageText = useCallback((v: string) => composerApi.current?.setText(v), []);
  const [studioOpen, setStudioOpen] = useState(false);
  const [consult, setConsult] = useState<{ image: string | null } | null>(null); // Soi tay tư vấn ngay trong chat
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
  // Giờ máy chủ của tin cuối cùng người kia gửi, theo từng cuộc trò chuyện: bỏ sự kiện "đang gõ" cũ hơn (handleUserTyping).
  const lastPeerMsgAtRef = useRef<Record<string, number>>({});
  const lastTypingSentRef = useRef(0);
  // ref, không phải state: chỉ dùng để chặn gửi trùng tin ĐẦU TIÊN (chưa có hội thoại) — đổi nó không cần vẽ lại gì
  // (trước đây mỗi lần gửi vẽ lại cả màn hình thêm 2 lần: sending = true / false).
  const sendingRef = useRef(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Cảm xúc đã đổi trong phiên (realtime / vừa bấm) — đè lên msg.reactions tải từ máy chủ.
  const [messageReactions, setMessageReactions] = useState<{ [msgId: string]: Reaction[] }>({});

  // Chặn/Báo cáo — bắt buộc theo App Store Guideline 1.2 cho app có nhắn tin
  // giữa người dùng với nhau.
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  // Tài khoản chính thức PawNail (tick xanh) — luôn ghim đầu danh sách làm kênh hỗ trợ.
  const [official, setOfficial] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/official").then((r) => (r.ok ? r.json() : null)).then((d) => d?.account && setOfficial(d.account)).catch(() => {});
  }, []);
  // V2: ảnh toàn màn hình, lượt đồng bộ lại (mạng quay lại / mở lại app)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  // Hình nền khung chat — riêng từng cuộc trò chuyện (ChatKey "u:<người kia>" / "g:<nhóm>"), lưu trên máy theo người
  // (lib/chatWallpapers.ts). Đọc ĐỒNG BỘ → mở chat là đúng nền ngay (không nháy nền mặc định). Bảng chọn xem trước trực
  // tiếp trên khung chat (wpPreview) và chỉ lưu khi bấm Áp dụng.
  const wpState = useWpState(currentUser?.id);
  const wpChoice = activeChat ? resolveChoice(wpState, chatKeyOf(activeChat), activeChat.conversationId) : "default";
  const wpCommitted = useWallpaperRender(currentUser?.id, wpState, wpChoice);
  const [wpPreview, setWpPreview] = useState<WpRender | null>(null);
  const wp = wpPreview ?? wpCommitted;
  // chấm nhỏ trên nút ⋮ cho tới khi mở bảng hình nền lần đầu
  const [wpSeen, setWpSeen] = useState(true);
  useEffect(() => {
    try {
      setWpSeen(!!localStorage.getItem(`pn_wp_seen:${currentUser?.id}`));
    } catch {}
  }, [currentUser?.id]);
  useEffect(() => {
    const el = document.documentElement;
    el.toggleAttribute("data-chat-open", !!activeChat);
    return () => el.removeAttribute("data-chat-open");
  }, [activeChat]);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const openWallpaper = useCallback(() => {
    setShowWallpaperPicker(true);
    setWpSeen(true);
  }, []);
  const closeWallpaper = useCallback(() => setShowWallpaperPicker(false), []);
  // Chuyển 1 lần lựa chọn cũ (pn_chat_wp, không theo người) sang khoá mới theo người.
  const hasConversations = conversations.length > 0;
  useEffect(() => {
    if (currentUser?.id) migrateLegacyWallpaper(currentUser.id, conversations);
  }, [currentUser?.id, hasConversations]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [blockActionLoading, setBlockActionLoading] = useState(false);

  const { startCall } = useCallManager();
  // ?to= ngoài danh sách systemUsers → tra hồ sơ 1 lần duy nhất mỗi partner.
  const directPartnerLookupRef = useRef<string | null>(null);
  // Khung cuộn tin (ChatThread gắn vào) + "đang ở sát đáy" — dùng chung giữa khung tin, khung soạn tin (giữ dính đáy khi
  // khung soạn cao thêm) và việc đánh dấu đã xem khi mở lại app.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  // Ô chứa nút "xuống tin mới nhất" (ChatThread) — khung soạn tin đặt chiều cao của nó lên đây (biến CSS).
  const jumpSlotRef = useRef<HTMLDivElement>(null);
  // Mốc cuộn + các tin đã chạy hiệu ứng xuất hiện: sống suốt phiên (khung tin bị gỡ khi đóng chat trên điện thoại).
  const threadMemory = useRef<ThreadMemory>({ prevChatKey: null, prevCount: 0, animated: new Set() });
  // Bảng biểu tượng trên điện thoại có mục lịch sử riêng (ChatComposer ghi) — closeThread cần biết để lùi đúng số mục.
  const panelPushedRef = useRef(false);

  // Live mirror of activeChat for the Pusher handler below, which is bound
  // once per session (deps: [currentUser?.id] only) and would otherwise read
  // a frozen activeChat from whenever it first bound.
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // (Đổi cuộc trò chuyện → ChatComposer tự xoá chữ đang soạn + đóng bảng biểu tượng; không remount component này —
  // làm vậy sẽ gỡ kênh Pusher.)

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
        router.replace(localeHref("/auth/login"));
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
        groupAvatarUrl: conv.groupAvatarUrl || null,
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
    const wasBlocked = blockedUserIds.has(activeChat.id);
    try {
      const res = await fetch(`/api/block${wasBlocked ? `?userId=${activeChat.id}` : ""}`, {
        method: wasBlocked ? "DELETE" : "POST",
        headers: wasBlocked ? undefined : { "Content-Type": "application/json" },
        body: wasBlocked ? undefined : JSON.stringify({ userId: activeChat.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(apiError(data, "Không thể cập nhật trạng thái chặn.", "Couldn't update block status."));
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
        toast.error(apiError(data, "Không thể gửi báo cáo.", "Couldn't send the report."));
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
    // this must only re-run when the active chat itself changes (or a catch-up sync is requested).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id, syncTick]);

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
        const sentAt = Date.parse(repliedAt);
        if (Number.isFinite(sentAt) && sentAt > (lastPeerMsgAtRef.current[m.conversationId] || 0)) lastPeerMsgAtRef.current[m.conversationId] = sentAt;
        clearTimeout(typingTimersRef.current[m.conversationId]);
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
        // Tin đến ngay trong khung chat đang mở — tiếng "bóp" nhẹ như Messenger. Trang bị ẩn mà app Android (hoặc bong
        // bóng đã thu lại) tự báo bằng thông báo native → không kêu thêm lần nữa.
        if (m.senderId !== currentUser.id && !(document.hidden && (bubble || nativeHandlesChatAlerts()))) {
          playSound(document.hidden ? "message" : "messageInChat");
        }
        const key = chatKeyFor(liveActiveChat);
        if (!liveActiveChat.conversationId && m.conversationId) {
          rekeyBucket(key, m.conversationId);
          setActiveChat((prev) => (prev && prev.id === liveActiveChat.id ? { ...prev, conversationId: m.conversationId } : prev));
          mergeIntoBucket(m.conversationId, [safeNewMsg]);
        } else {
          mergeIntoBucket(key, [safeNewMsg]);
        }
      } else if (m.senderId !== currentUser.id) {
        // Tin nhắn thuộc 1 cuộc hội thoại KHÁC cuộc đang mở — vẫn đang ở
        // /messages nên UnreadMessagesContext tự bỏ qua (coi như "đang đọc
        // tin nhắn"), nhưng người dùng thực ra không nhìn thấy tin này, nên
        // tự phát âm thanh ở đây thay vì im lặng bỏ qua hoàn toàn. Bong bóng chat: tin của cuộc khác do app chính lo;
        // trang ẩn trong app Android có thông báo native → không kêu trùng.
        if (!bubble && !(document.hidden && nativeHandlesChatAlerts())) playSound("message");
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
      if (Array.isArray(data.reactions)) setMessageReactions((prev) => ({ ...prev, [targetId]: data.reactions }));
    };

    // Máy chủ đã bắn tin trước khi ghi DB (để tới nhanh) mà ghi DB lỗi → gỡ tin vừa hiện.
    const handleMessageRecalled = (data: any) => {
      if (!data?.id || !data?.conversationId) return;
      removeFromBucket(data.conversationId, (msg: any) => msg.id === data.id);
    };

    const handleMessageSeen = (data: any) => {
      if (!data?.conversationId || !data?.seenAt) return;
      setSeenByConv((prev) => ({ ...prev, [data.conversationId]: data.seenAt }));
    };

    const handleUserTyping = (data: any) => {
      if (!data?.conversationId || data.userId === currentUser.id) return;
      const convId = data.conversationId as string;
      // "Đang gõ" gửi TRƯỚC tin vừa tới nhưng tới sau (máy chủ đọc DB chậm hơn đường gửi tin) → bỏ, không hiện lại
      // "Đang soạn tin…" thêm 4,5 giây sau khi tin đã tới.
      if (typeof data.at === "number" && data.at <= (lastPeerMsgAtRef.current[convId] || 0)) return;
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

    // Tin tới trong lúc kênh CHƯA đăng ký lại (socket vừa nối lại nhưng /api/pusher/auth lỗi → lib/pusherResilience.ts
    // thử lại sau 1–30 s) không bao giờ tới qua Pusher → mỗi lần kênh đăng ký lại xong thì tải lại danh sách + khung chat
    // đang mở. Lần đăng ký ĐẦU (lúc mở trang) bỏ qua: trang vừa tự tải dữ liệu rồi.
    let primed = !!channel.subscribed;
    const handleResubscribed = () => {
      if (primed) {
        setSyncTick((n) => n + 1);
        loadData(true);
      }
      primed = true;
    };

    channel.bind("new-message", handleNewMessage);
    channel.bind("message-updated", handleMessageUpdated);
    channel.bind("message-seen", handleMessageSeen);
    channel.bind("message-recalled", handleMessageRecalled);
    channel.bind("user-typing", handleUserTyping);
    channel.bind("pusher:subscription_succeeded", handleResubscribed);

    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-updated", handleMessageUpdated);
      channel.unbind("message-seen", handleMessageSeen);
      channel.unbind("message-recalled", handleMessageRecalled);
      channel.unbind("user-typing", handleUserTyping);
      channel.unbind("pusher:subscription_succeeded", handleResubscribed);
      releaseUserChannel(currentUser.id);
    };
  }, [currentUser?.id, rekeyBucket, mergeIntoBucket, removeFromBucket, loadData, markSeen, bubble]);

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
  const handleSendMessage = useCallback(async (e: React.FormEvent | null, customContent?: string, customType?: string, reuseClientId?: string, opts?: { keepPanel?: boolean }) => {
    if (e) e.preventDefault();
    // Gửi liên tiếp như Zalo/Telegram: không chờ tin trước xong. Chỉ chặn khi
    // cuộc trò chuyện chưa tồn tại (tin đầu tiên tạo hội thoại → tránh tạo trùng).
    if (!activeChat || (sendingRef.current && !activeChat.conversationId)) return;

    const content = customContent || (inputRef.current?.value ?? "").trim();
    const type = customType || "TEXT";
    if (!content) return;

    // Xoá ô soạn tin (tin gõ tay) + đóng bảng biểu tượng (gửi nhãn dán / GIF: bảng VẪN MỞ) + bảng "+". Khung soạn tin
    // vẽ lại SAU bong bóng tin (việc nền) — lần vẽ ngay bây giờ chỉ là khung tin.
    composerApi.current?.onSending({ clearText: !customContent, keepPanel: !!opts?.keepPanel });

    const sendKey = chatKeyFor(activeChat)!;
    const clientId = reuseClientId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    const tempId = `temp_${clientId}`;
    const lastAt = chatMessagesRef.current.length ? new Date(chatMessagesRef.current[chatMessagesRef.current.length - 1].createdAt).getTime() + 1 : 0;
    const optimisticMessage: MessageType = {
      id: tempId,
      clientId,
      content,
      type,
      senderId: currentUser.id,
      receiverId: activeChat.isGroup ? "" : activeChat.id,
      createdAt: new Date(Math.max(Date.now(), lastAt)).toISOString(),
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
    sendingRef.current = true;

    try {
      const isGroup = activeChat.isGroup;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content, type, clientId,
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
        const safeNewMsg = { ...mapServerMessage({ ...m, sender: currentUser }), clientId };

        const finalKey = m.conversationId || sendKey;
        if (finalKey !== sendKey) rekeyBucket(sendKey, finalKey);
        // Cùng clientId → mergeSorted thay bong bóng tạm NGAY TẠI CHỖ (giữ phần tử DOM, không chạy lại hiệu ứng).
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
        toast.error(apiError(errData, "Gửi tin nhắn thất bại.", "Message failed to send."));
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
      sendingRef.current = false;
    }
  }, [activeChat, currentUser, loadData, mergeIntoBucket, rekeyBucket, patchBucket]);

  // Bấm "Thử lại" trên 1 tin nhắn gửi lỗi — bỏ bong bóng lỗi cũ, gửi lại y
  // nguyên nội dung như 1 lần gửi mới (tạo bong bóng optimistic mới).
  const retrySendMessage = useCallback((msg: MessageType) => {
    const key = chatKeyFor(activeChat);
    // Gửi lại đúng mã cũ (máy chủ không tạo trùng) và giữ nguyên vị trí bong bóng.
    patchBucket(key, (bucket) => ({ ...bucket, messages: bucket.messages.map((m) => (m.id === msg.id ? { ...m, sendError: false, isOptimistic: true } : m)) }));
    handleSendMessage(null, msg.content, msg.type, msg.clientId);
  }, [activeChat, patchBucket, handleSendMessage]);


  // Thả / đổi / gỡ cảm xúc: hiện ngay (đoán trước như máy chủ), rồi lấy bản đã lưu từ máy chủ.
  const handleAddReaction = useCallback(async (messageId: string, icon: string, current?: Reaction[]) => {
    if (!messageId || !activeChat || !currentUser || messageId.startsWith("temp")) return;
    setMessageReactions((prev) => ({ ...prev, [messageId]: toggleReaction(prev[messageId] ?? current, currentUser.id, icon) }));
    try {
      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji: icon }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.reactions)) setMessageReactions((prev) => ({ ...prev, [messageId]: data.reactions }));
      else setMessageReactions((prev) => ({ ...prev, [messageId]: current ?? [] }));
    } catch {
      setMessageReactions((prev) => ({ ...prev, [messageId]: current ?? [] }));
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
        toast.error(apiError(data, "Tạo nhóm thất bại.", "Couldn't create the group."), { id: toastId });
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
    fileInput.accept = "image/*,video/*";
    fileInput.onchange = async () => {
      const rawFile = fileInput.files?.[0];
      if (!rawFile) return;
      const isVideo = rawFile.type.startsWith("video/");
      const toastId = toast.loading(isVideo ? tr("Đang tải video…", "Uploading video…") : tr("Đang gửi ảnh…", "Sending photo…"));
      try {
        const url = await uploadMedia(rawFile, (pct) => isVideo && toast.loading(tr(`Đang tải video… ${pct}%`, `Uploading video… ${pct}%`), { id: toastId }));
        toast.dismiss(toastId);
        handleSendMessage(null, url, isVideo ? "VIDEO" : "IMAGE");
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : tr("Lỗi mạng khi tải lên.", "Network error while uploading."), { id: toastId });
      }
    };
    fileInput.click();
  }, [activeChat, handleSendMessage]);

  // Tin soạn sẵn (VD bấm "Muốn làm mẫu này" trong Menu): { to, text } trong sessionStorage → mở đúng
  // cuộc trò chuyện với người đó là điền sẵn vào ô nhập (người dùng tự bấm gửi).
  useEffect(() => {
    if (!activeChat?.id) return;
    try {
      const raw = sessionStorage.getItem("pn_chat_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as { to?: string; text?: string };
      if (d.to !== activeChat.id || !d.text) return;
      sessionStorage.removeItem("pn_chat_draft");
      setMessageText(String(d.text).slice(0, 1000));
      inputRef.current?.focus();
    } catch {}
  }, [activeChat?.id, setMessageText]);

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
  // Xem trước tin cuối ở danh sách: người xem tiếng Anh + tin tiếng Việt của người kia → hiện bản dịch
  // (dùng chung bản dịch với bong bóng chat). Chỉ xin dịch cho ~12 hội thoại đầu.
  const mounted = useMounted();
  const viewerLang = locale === "vi" ? "vi" : "en";
  useMessageTranslation("", "", viewerLang, { enabled: false, auto: false }); // đăng ký render lại khi có bản dịch
  const txVersion = useTranslationVersion();
  useEffect(() => {
    conversationRows.slice(0, 12).forEach(({ lastMsg }) => {
      if (lastMsg && lastMsg.type === "TEXT" && lastMsg.senderId !== currentUser?.id && autoTranslates(lastMsg.body, viewerLang)) requestTranslation(lastMsg.id, viewerLang);
    });
  }, [conversationRows, viewerLang, currentUser?.id]);
  const hasOfficialConv = !!official && conversations.some((c) => !c.isGroup && c.participants.some((p) => p.id === official.id));
  const showOfficialStub = !!official && official.id !== currentUser?.id && !hasOfficialConv && !listQuery.trim();
  const openOfficialChat = () =>
    official &&
    setActiveChat({ id: official.id, name: official.name, avatarUrl: officialAvatarUrl(official.avatarUrl), role: "ADMIN", isGroup: false, isOnline: false, statusText: "" });

  // ----- Dữ liệu cho hàng gợi ý trả lời (ChatAssist trong khung soạn tin): chỉ truyền GIÁ TRỊ (boolean / chuỗi) → gửi /
  // nhận tin bình thường không vẽ lại khung soạn tin.
  // Đoạn chat đã qua lại vài lượt (mỗi bên ≥ 3 tin) → hàng "Gợi ý" thu thành 1 nút nhỏ, nhường chỗ cho tin nhắn
  // Mình nhắn tiếng Việt → mình đọc được tiếng Việt: không tự dịch tin tiếng Việt của người khác sang tiếng Anh nữa.
  // Đánh dấu NGAY lúc vẽ (các dòng tin bên dưới xin dịch trong effect của chúng — chạy trước effect của component cha).
  const iWriteVi = useMemo(() => chatMessages.some((m) => m.senderId === currentUser?.id && m.type === "TEXT" && detectTextLang(m.content) === "vi"), [chatMessages, currentUser?.id]);
  if (iWriteVi) markViewerReadsVi(true);
  const established = useMemo(() => {
    let mine = 0, theirs = 0;
    for (const m of chatMessages) {
      if (m.type === "CALL") continue;
      if (m.senderId === currentUser?.id) mine++;
      else theirs++;
      if (mine >= 3 && theirs >= 3) return true;
    }
    return false;
  }, [chatMessages, currentUser?.id]);
  // Tin của đối phương mà mình CHƯA trả lời (để Trợ lý PawNail gợi ý đúng câu cần trả lời). Vòng lặp dừng ngay
  // ở tin đầu tiên của mình tính từ cuối lên — rẻ; đối tượng giữ danh tính theo nội dung (memo của khung soạn tin).
  let unansweredType: "TEXT" | "IMAGE" | null = null;
  let unansweredContent = "";
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i];
    if (m.senderId === currentUser?.id) break;
    // GIF (GIPHY / Tenor, có khi là MP4) không phải ảnh tay / mẫu móng → bỏ qua, xét tin trước đó
    if (m.type === "IMAGE" && isGifUrl(m.content)) continue;
    if (m.type === "IMAGE" || !m.type || m.type === "TEXT") { unansweredContent = String(m.content || ""); unansweredType = m.type === "IMAGE" ? "IMAGE" : "TEXT"; break; }
  }
  const unanswered = useMemo<Unanswered>(
    () => (unansweredType ? { content: unansweredContent, type: unansweredType } : null),
    [unansweredType, unansweredContent]
  );
  const partnerWrote = chatMessages.some((m) => m.senderId !== currentUser?.id && m.type !== "SYSTEM");
  // Chờ tin MỚI của cuộc trò chuyện nạp xong (không dùng bản lưu trên máy) mới hiện hàng gợi ý
  const assistReady = !!activeBucket && !(activeBucket as { fromDisk?: boolean }).fromDisk;

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

  // Khách đang nhắn với tiệm / thợ → ✨ là "Thử mẫu trên tay mình rồi gửi tiệm"
  const clientChat = currentUser?.role === "CLIENT" && !activeChat?.isGroup && (activeChat?.role === "TECHNICIAN" || activeChat?.role === "OWNER");
  // Props ỔN ĐỊNH cho MessageRow (React.memo): đối tượng/hàm giữ nguyên danh
  // tính giữa các lần render, gọi bản mới nhất qua ref.
  const openMedia = useCallback((url: string) => {
    const urls = chatMessagesRef.current.filter((m) => m.type === "IMAGE" || m.type === "VIDEO").map((m) => m.content);
    const i = Math.max(0, urls.indexOf(url));
    setLightbox({ urls: urls.length ? urls : [url], index: i });
  }, []);
  const rowLatest = useRef({ callPartner, startCall, handleAddReaction, retrySendMessage });
  rowLatest.current = { callPartner, startCall, handleAddReaction, retrySendMessage };
  const rowHandlers = useMemo(() => ({
    callBack: (kind: "audio" | "video") => {
      const { callPartner: p, startCall: go } = rowLatest.current;
      if (p) go(p, kind);
    },
    react: (id: string, icon: string, current?: Reaction[]) => rowLatest.current.handleAddReaction(id, icon, current),
    retry: (m: MessageType) => rowLatest.current.retrySendMessage(m),
  }), []);

  // ----- V2: tin cậy của đối phương (thẻ đầu cuộc trò chuyện + dấu SĐT đã xác minh trên thanh đầu)
  const [partnerTrust, setPartnerTrust] = useState<PartnerTrust | null>(null);
  useEffect(() => {
    setPartnerTrust(null);
    if (!activeChat || activeChat.isGroup) return;
    let alive = true;
    loadTrust(activeChat.id).then((t) => alive && setPartnerTrust(t));
    return () => { alive = false; };
  }, [activeChat?.id, activeChat?.isGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thẻ "Nhắn tin an toàn" chỉ hiện ở cuộc trò chuyện mới (ChatThread tự tính theo ngày tạo)
  const convCreatedAt = (activeChat?.conversationId ? conversations.find((c) => c.id === activeChat.conversationId)?.createdAt : undefined) ?? null;

  // ----- V2: mốc "đã xem" dạng số (MessageRow nhận boolean → memo giữ được)
  const seenAtMs = activeChat?.conversationId && seenByConv[activeChat.conversationId] ? new Date(seenByConv[activeChat.conversationId]).getTime() : 0;

  // ----- V2: không gợi ý lại người đã có trong danh sách
  const suggestExclude = useMemo(() => {
    const ids = new Set<string>(currentUser?.id ? [currentUser.id] : []);
    for (const c of conversations) for (const p of c.participants) ids.add(p.id);
    return Array.from(ids);
  }, [conversations, currentUser?.id]);

  // ----- V2: nút Back của Android / trình duyệt đóng cuộc trò chuyện (về danh sách) thay vì rời /messages.
  // Mở 1 cuộc trò chuyện trên điện thoại → thêm 1 mục lịch sử (pushState gốc, không tải lại RSC); Back → popstate → đóng.
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!activeChat || bubble) return; // bong bóng chat: không có danh sách để quay lại
    if (window.matchMedia("(min-width: 768px)").matches || pushedRef.current) return;
    const q = activeChat.conversationId ? `c=${encodeURIComponent(activeChat.conversationId)}` : `to=${encodeURIComponent(activeChat.id)}`;
    try {
      const { pnChat, ...base } = (window.history.state || {}) as { pnChat?: boolean } & Record<string, unknown>;
      // Trang dựng lại trên đúng mục chat mình đã push trước đó (mở chat → xem hồ sơ → Back): mục trước nó đã là danh
      // sách → chỉ ghi nhận, KHÔNG replace + push thêm (từng sinh 2 mục /messages: rời Tin nhắn phải bấm Back 2 lần).
      if (pnChat) {
        pushedRef.current = true;
        return;
      }
      // vào thẳng bằng ?to= / ?c= → đưa mục hiện tại về /messages trước, để Back không mở lại chính cuộc trò chuyện đó
      if (/[?&](to|c)=/.test(window.location.search)) window.history.replaceState(base, "", "/messages");
      window.history.pushState({ ...base, pnChat: true }, "", `/messages?${q}`);
      pushedRef.current = true;
    } catch {}
  }, [activeChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => {
      if (pushedRef.current && !(window.history.state && window.history.state.pnChat)) {
        pushedRef.current = false;
        setActiveChat(null);
        composerApi.current?.closeSheets();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const closeThread = useCallback(() => {
    if (pushedRef.current && panelPushedRef.current) {
      // bảng đang mở có mục lịch sử riêng → lùi 2 mục (bảng + cuộc trò chuyện)
      panelPushedRef.current = false;
      window.history.go(-2);
    } else if (pushedRef.current) window.history.back();
    else setActiveChat(null);
  }, []);
  // ?c=<conversationId> → mở đúng cuộc trò chuyện đó (link chia sẻ / quay lại trang / bấm thông báo / bong bóng chat).
  // Bấm thông báo của cuộc trò chuyện B khi đang mở A → chuyển sang B (trước đây bỏ qua khi đã có chat đang mở). Chưa có
  // trong danh sách đã tải (trang chỉ tải 50 cuộc) → tải riêng cuộc đó rồi mở.
  const directConvId = searchParams.get("c");
  const directConvDoneRef = useRef<string | null>(null);
  const directConvFetchRef = useRef<string | null>(null);
  // id cuộc trò chuyện ?c= không tải được (không còn quyền / không tồn tại) — so với id hiện tại nên tự hết khi đổi id.
  const [missingConvId, setMissingConvId] = useState<string | null>(null);
  // Bong bóng chat luôn mở 1 cuộc trò chuyện (?c=): thiếu id, không tải được, hoặc chat 1-1 mà người kia đã xoá tài
  // khoản → màn lỗi có nút mở app (bong bóng không có danh sách để quay về), không để vòng quay chạy mãi.
  const directConvNoPartner = useMemo(() => {
    if (!bubble || !directConvId) return false;
    const conv = conversations.find((c) => c.id === directConvId);
    return !!conv && !conv.isGroup && !conv.participants.some((p) => p.id !== currentUser?.id);
  }, [bubble, directConvId, conversations, currentUser?.id]);
  const bubbleMissing = bubble && (!directConvId || missingConvId === directConvId || directConvNoPartner);
  // Bấm lại thông báo của cùng cuộc trò chuyện (điều hướng mềm từ app Android: window.__pawnailOpenUrl, URL có thể
  // không đổi) → mở lại dù trước đó đã xử lý id này.
  const [directConvNonce, setDirectConvNonce] = useState(0);
  useEffect(() => {
    // Rời ?c= (Back về danh sách) → lần sau cùng id vẫn được mở lại.
    if (!directConvId) {
      directConvDoneRef.current = null;
      directConvFetchRef.current = null;
    }
  }, [directConvId]);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const path = (e as CustomEvent<unknown>).detail;
      if (typeof path !== "string") return;
      let id: string | null = null;
      try {
        id = new URL(path, window.location.origin).searchParams.get("c");
      } catch {}
      if (!id) return;
      directConvDoneRef.current = null;
      directConvFetchRef.current = null;
      setDirectConvNonce((n) => n + 1);
    };
    window.addEventListener("pn-open-url", onOpen);
    return () => window.removeEventListener("pn-open-url", onOpen);
  }, []);
  useEffect(() => {
    if (!directConvId || directConvDoneRef.current === directConvId) return;
    // Chính component vừa ghi ?c=<id> của chat đang mở (pushState trên điện thoại) → chỉ ghi nhận.
    if (activeChat?.conversationId === directConvId) {
      directConvDoneRef.current = directConvId;
      return;
    }
    const conv = conversations.find((c) => c.id === directConvId);
    if (!conv) {
      if (directConvFetchRef.current === directConvId) return;
      directConvFetchRef.current = directConvId;
      fetch(`/api/conversations?id=${encodeURIComponent(directConvId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const c = d?.conversation as ConversationType | undefined;
          if (c?.id === directConvId) setConversations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
          else setMissingConvId(directConvId);
        })
        .catch(() => setMissingConvId(directConvId));
      return;
    }
    directConvDoneRef.current = directConvId;
    const partner = conv.isGroup ? null : conv.participants.find((p) => p.id !== currentUser?.id);
    if (!conv.isGroup && !partner) return; // người kia đã xoá tài khoản (bong bóng: directConvNoPartner → màn lỗi)
    setActiveChat({
      id: conv.isGroup ? conv.id : partner!.id,
      name: conv.isGroup ? conv.name || tr("Nhóm trò chuyện", "Group chat") : partner!.name,
      avatarUrl: conv.isGroup ? conv.groupAvatarUrl || "" : partner!.avatarUrl || "",
      role: conv.isGroup ? "GROUP" : partner!.role,
      isGroup: conv.isGroup,
      isOnline: false,
      statusText: "",
      conversationId: conv.id,
    });
  }, [directConvId, directConvNonce, conversations, activeChat, currentUser?.id]);

  // App Android (versionCode 3+) tự vẽ thông báo chat: báo cuộc trò chuyện đang mở + đang nhìn thấy → app không báo
  // tin của chính cuộc đó (đã thấy trên màn hình) và gỡ thông báo cũ của nó. Ẩn app / đóng chat / rời trang → null.
  // No-op trên web / iPhone / bản app cũ (lib/nativePush.ts).
  const activeConvId = activeChat?.conversationId ?? null;
  useEffect(() => {
    if (bubble) return; // bong bóng chat: app native tự biết cuộc trò chuyện của bong bóng
    const sync = () => {
      const visible = document.visibilityState === "visible";
      setActiveConversation(visible ? activeConvId : null);
      if (visible && activeConvId) clearConversation(activeConvId);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      setActiveConversation(null);
    };
  }, [activeConvId, bubble]);

  // Bong bóng chat: link ra khỏi khung chat (hồ sơ, việc làm…) → tải trang THẬT để app native chuyển sang app chính
  // (điều hướng phía client của Next.js không đi qua WebView nên app không bắt được). Bắt ở pha capture trên window —
  // trước cả trình xử lý của <Link>.
  useEffect(() => {
    if (!bubble) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      let u: URL;
      try {
        u = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (u.origin !== window.location.origin || /^\/(vi\/)?messages\/?$/.test(u.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(u.href);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [bubble]);

  // ----- V2: đồng bộ lại khi mở lại app / có mạng lại (tin tới lúc socket rớt không bị mất tới khi mở lại chat).
  // Socket nối lại: KHÔNG đồng bộ ở "connected" (lúc đó kênh riêng chưa đăng ký lại → tin tới giữa chừng vẫn mất) — việc
  // đó làm ở "pusher:subscription_succeeded" của kênh (effect kênh realtime phía trên).
  const [connLost, setConnLost] = useState(false);
  useEffect(() => {
    const resync = () => {
      setSyncTick((n) => n + 1);
      loadData(true);
    };
    const onVis = () => { if (document.visibilityState === "visible") resync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", resync);
    const pusher = getPusherClient();
    let lostTimer: ReturnType<typeof setTimeout> | null = null;
    const onState = ({ current }: { previous: string; current: string }) => {
      if (current === "connected") {
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = null;
        setConnLost(false);
      } else if (current === "unavailable" || current === "disconnected" || current === "connecting") {
        if (!lostTimer) lostTimer = setTimeout(() => { setConnLost(true); lostTimer = null; }, 2000);
      }
    };
    pusher?.connection.bind("state_change", onState);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", resync);
      pusher?.connection.unbind("state_change", onState);
      if (lostTimer) clearTimeout(lostTimer);
    };
  }, [loadData]);
  // Mở lại app / quay lại tab khi đang ở đáy cuộc trò chuyện → đánh dấu đã xem
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && activeChatRef.current?.conversationId && isNearBottomRef.current) markSeen(activeChatRef.current.conversationId);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markSeen]);

  // ----- Hàm ỔN ĐỊNH cho khung tin / khung soạn tin (React.memo): gọi bản mới nhất qua ref → 2 khung đó không vẽ lại chỉ
  // vì các hàm này được tạo lại (activeChat / danh sách hội thoại đổi).
  const latest = useRef({ handleSendMessage, handleUploadImage, notifyTyping });
  latest.current = { handleSendMessage, handleUploadImage, notifyTyping };
  const send = useCallback<SendFn>((content, type, reuseClientId, opts) => latest.current.handleSendMessage(null, content, type, reuseClientId, opts), []);
  const sendText = useCallback((text: string) => { latest.current.handleSendMessage(null, text); }, []);
  const uploadPhoto = useCallback(() => latest.current.handleUploadImage(), []);
  const typingPing = useCallback(() => latest.current.notifyTyping(), []);
  const openStudio = useCallback(() => setStudioOpen(true), []);
  const openConsult = useCallback((image: string | null) => setConsult({ image }), []);
  const openReport = useCallback(() => setShowReportModal(true), []);
  const fillStarter = useCallback((text: string) => composerApi.current?.setText(text), []);
  // Hộp thoại Thử mẫu / Soi tay (vẫn nằm trong khung soạn tin như trước) — chỉ dựng lại khi đang mở.
  const composerOverlay = useMemo(() => (!studioOpen && !consult) || !activeChat ? null : (
    <>
      {studioOpen && activeChat && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setStudioOpen(false)}>
          <div role="dialog" aria-label={clientChat ? tr("Thử mẫu PawNail — thử mẫu trên tay bạn", "PawNail Try-On — looks on your hand") : tr("Thử mẫu PawNail — tạo mẫu trên tay khách", "PawNail Try-On — looks on the client's hand")} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-base font-black text-white"><SparklesIcon className="h-5 w-5 text-pink-300" />{clientChat ? tr("Thử mẫu trên tay bạn", "Try looks on your hand") : tr("Tạo mẫu trên tay khách", "Try-on looks")}</p>
              <button type="button" onClick={() => setStudioOpen(false)} aria-label={tr("Đóng", "Close")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-300"><XIcon className="h-4 w-4" /></button>
            </div>
            <NailStudio
              market={currentUser?.market === "AU" ? "AU" : "US"}
              // Thợ: ảnh KHÁCH gửi · Khách: ảnh tay của CHÍNH MÌNH đã gửi (hoặc chụp mới trong Studio)
              photos={chatMessages.filter((m) => m.type === "IMAGE" && (clientChat ? m.senderId === currentUser?.id : m.senderId !== currentUser?.id) && /^(https:\/\/|data:image\/)/.test(m.content) && !isGifUrl(m.content)).map((m) => m.content).reverse()}
              sendLabel={clientChat ? tr("Gửi cho tiệm", "Send to the salon") : tr("Gửi cho khách", "Send to client")}
              onSend={async ({ blobs, looks }) => {
                for (let i = 0; i < blobs.length; i++) {
                  const url = await uploadMedia(new File([blobs[i]], `pawnail-studio-${i + 1}.jpg`, { type: "image/jpeg" }));
                  await send(url, "IMAGE");
                }
                const lines = looks.map((l, i) => `${i + 1}. ${tr(l.title.vi, l.title.en)}${clientChat ? "" : ` — ${l.priceHint}`}`);
                await send((clientChat
                  ? [tr(`✨ Em thử ${looks.length} mẫu trên tay mình (PawNail):`, `✨ I tried ${looks.length} looks on my hand (PawNail):`), ...lines, tr("Tiệm làm được mẫu này không ạ? Giá bao nhiêu và khi nào còn lịch ạ?", "Can you do one of these? How much, and when do you have an opening?")]
                  : [tr(`✨ ${looks.length} mẫu thử trên tay chị/anh (PawNail):`, `✨ ${looks.length} try-on looks on your hand (PawNail):`), ...lines, tr("Chị/anh thích mẫu nào nhắn em nhé — giá chính xác theo menu tiệm.", "Tell me which one you like — exact price per our menu.")]
                ).join("\n"));
                setStudioOpen(false);
                toast.success(clientChat ? tr("Đã gửi mẫu cho tiệm.", "Sent to the salon.") : tr("Đã gửi mẫu cho khách.", "Looks sent."));
              }}
            />
          </div>
        </div>
      )}
      {consult && activeChat && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setConsult(null)}>
          <div role="dialog" aria-label={tr("Soi tay tư vấn cho khách", "Hand consult for the client")} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="chat-consult">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-base font-black text-white"><SparklesIcon className="h-5 w-5 text-pink-300" />{tr("Soi tay tư vấn", "Hand consult")}</p>
              <button type="button" onClick={() => setConsult(null)} aria-label={tr("Đóng", "Close")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-300"><XIcon className="h-4 w-4" /></button>
            </div>
            <HandConsult
              embedded
              chatImage={consult.image ?? undefined}
              vi={unanswered?.type === "TEXT" ? replyInVietnamese(unanswered.content, locale === "vi") : locale === "vi"}
              onShare={async (text) => {
                await send(text);
                setConsult(null);
                toast.success(tr("Đã gửi tư vấn cho khách.", "Advice sent."));
              }}
            />
          </div>
        </div>
      )}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ảnh trong cuộc trò chuyện chỉ cần khi đang mở Thử mẫu
  ), [studioOpen, consult, activeChat, studioOpen ? chatMessages : null, clientChat, currentUser, unanswered, locale, send]);

  // Mở 1 cuộc trò chuyện → hỏi trước GIF có dùng được không (1 lần / phiên) để menu "+" và bảng biểu tượng hiện đúng ngay.
  const hasActiveChat = !!activeChat;
  useEffect(() => {
    if (hasActiveChat) probeGifs();
  }, [hasActiveChat]);

  // Đang mở chat 1-1 → tải sẵn bộ gọi lúc rảnh để bấm gọi là đổ chuông/thông ngay.
  useEffect(() => {
    if (activeChat && !activeChat.isGroup && !bubble) {
      preloadCallSdkWhenIdle();
    }
  }, [activeChat?.id, activeChat?.isGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Danh sách cuộc trò chuyện (cột trái — ẩn trên điện thoại khi đang mở 1 chat) chỉ vẽ lại khi dữ liệu CỦA NÓ đổi.
  // Trước đây mỗi phím gõ / tin gửi / đổi trạng thái khung chat vẽ lại cả danh sách (chat_perf: gửi ~700 ms ở CPU chậm 4x).
  const conversationList = useMemo(() =>
    conversationRows.map(({ conv, partner, displayName, lastMsg }) => {
      const isGroup = conv.isGroup;
      const avatarUrl = isGroup ? conv.groupAvatarUrl || "" : partner!.avatarUrl || "";
      const isActive = activeChat?.conversationId === conv.id;
      const fromMe = lastMsg?.senderId === currentUser?.id;
      const unread = isActive ? 0 : conv.unreadCount || 0;
      const isTyping = typingByConv[conv.id] !== undefined;
      const txPreview = lastMsg && lastMsg.type === "TEXT" && !fromMe ? getTranslation(lastMsg.id, viewerLang) : undefined;
      const preview = lastMsg
        ? `${fromMe ? tr("Bạn: ", "You: ") : ""}${mediaPreview(lastMsg.type, lastMsg.body) ?? (lastMsg.type === "CALL" ? `📞 ${describeCall(lastMsg.body).text}` : txPreview?.status === "done" && txPreview.text ? txPreview.text : txPreview?.status === "loading" ? tr("Đang dịch…", "Translating…") : lastMsg.body)}`
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
          className={`m-conv relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors duration-150 ${isActive ? "pn-conv-active" : unread > 0 ? "bg-white/[0.035] hover:bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
        >
          {isGroup ? (
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {conv.groupAvatarUrl ? <img src={conv.groupAvatarUrl} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-fuchsia-300" />}
            </span>
          ) : (
            <PresenceAvatar userId={partner!.id} src={avatarSrc(avatarUrl, displayName, partner!.id)} alt={displayName} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={`m-name flex min-w-0 items-center gap-1 text-[13px] ${unread > 0 ? "font-black text-white" : "font-bold text-slate-100"}`}>
                <span className="truncate">{displayName}</span>
                {!isGroup && isVerifiedRole(partner!.role) && <VerifiedBadge className="h-3.5 w-3.5" />}
                {!isGroup && partner!.id === official?.id && <Pin className="h-3 w-3 flex-shrink-0 rotate-45 text-slate-500" aria-label={tr("Đã ghim", "Pinned")} />}
                {!isGroup && (
                <span className={`flex-shrink-0 rounded px-1.5 py-px text-[9px] font-bold ${isVerifiedRole(partner!.role) ? "bg-sky-500/15 text-sky-300" : "bg-slate-800/80 text-slate-400"}`}>{isVerifiedRole(partner!.role) ? tr("Chính thức", "Official") : ROLE_VI()[partner!.role] || tr("Thành viên", "Member")}</span>
                )}
              </p>
              {lastMsg && <span className={`m-time flex-shrink-0 ${unread > 0 ? "m-time-unread" : ""}`}>{mounted ? shortChatTime(lastMsg.createdAt, currentUser?.market) : ""}</span>}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              {fromMe && !isTyping && lastMsg && !isGroup && (
                seenByConv[conv.id] && new Date(seenByConv[conv.id]).getTime() >= new Date(lastMsg.createdAt).getTime()
                  ? <CheckCheck aria-label={CS.seen()} className="m-own-tick m-seen h-4 w-4 flex-shrink-0" />
                  : <Check aria-label={CS.sent()} className="m-own-tick h-4 w-4 flex-shrink-0" />
              )}
              {isTyping ? (
                <p className="m-typing flex items-center gap-1.5 truncate">
                  {tr("Đang soạn tin ", "Typing ")}<TypingDots />
                </p>
              ) : (
                <p className={`m-preview min-w-0 flex-1 truncate ${unread > 0 ? "m-preview-unread" : ""}`}>{preview}</p>
              )}
              {unread > 0 && (
                <span className="m-badge ml-auto flex flex-shrink-0 items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
          </div>
        </button>
      );
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tr()/CS/mediaPreview đọc ngôn ngữ hiện tại: viewerLang đã nằm trong deps
  , [conversationRows, activeChat?.conversationId, currentUser?.id, currentUser?.market, typingByConv, seenByConv, viewerLang, txVersion, official?.id, mounted, prefetchChat]);

  return (
    <div className="pn-msgr flex w-full h-full overflow-hidden">
      {/* LEFT COLUMN: CONVERSATION LIST */}
      <div className={`m-list relative isolate w-full md:w-[30%] border-r border-white/[0.06] flex flex-col h-full overflow-hidden ${bubble ? "hidden" : activeChat ? "hidden md:flex" : "flex"}`}>
        <div className="pn-list-hero p-4 pb-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            <h2 className="bg-gradient-to-r from-white via-pink-100 to-fuchsia-200 bg-clip-text text-xl font-black tracking-tight text-transparent">{t("messenger.title")}</h2>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">{t("messenger.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 rounded-xl bg-pink-600/10 hover:bg-pink-600/20 border border-pink-500/20 text-pink-400 hover:text-pink-300 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shadow-sm shadow-pink-500/5"
              title={tr("Tạo nhóm chat mới", "New group chat")}
            >
              <Plus className="h-4 w-4" /> {t("messenger.newGroup")}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="m-search flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={t("messenger.searchPlaceholder")}
              aria-label={tr("Tìm cuộc trò chuyện", "Search conversations")}
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {!bubble && <ChatNotifyBanner />}

          {showOfficialStub && (
            <div className="border-b border-slate-850/60 p-2">
              <button
                type="button"
                onClick={openOfficialChat}
                aria-current={activeChat?.id === official!.id ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all ${activeChat?.id === official!.id ? "bg-gradient-to-r from-sky-600/20 to-blue-600/10 ring-1 ring-sky-500/30" : "hover:bg-white/[0.04]"}`}
              >
                <PresenceAvatar watch={false} userId={official!.id} src={officialAvatarUrl(official!.avatarUrl)} alt={official!.name} />
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
            <div className="flex-1" aria-busy="true" aria-label={t("messenger.loadingConversations")}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="m-skel">
                  <div className="skeleton h-[52px] w-[52px] flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-2/5 rounded" />
                    <div className="skeleton h-3 w-3/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length > 0 ? (
            <div className="m-list-scroll flex-1 overflow-y-auto custom-scrollbar">
              {conversationRows.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-500">{tr("Không tìm thấy cuộc trò chuyện nào khớp “", "No conversations match “")}{listQuery}&rdquo;.</p>
              )}
              {conversationList}
              {conversations.length < 4 && !listQuery && <ChatSuggestions role={currentUser?.role ?? null} market={currentUser?.market ?? null} excludeIds={suggestExclude} />}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 mt-8 animate-fadeIn">
              <span className="m-empty-art flex items-center justify-center">
                <MessageSquare className="h-8 w-8" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-bold text-slate-200">{t("messenger.noConversations")}</p>
              <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">{t("messenger.noConversationsHint")}</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Link href={currentUser?.role === "OWNER" ? "/?tab=portfolio" : currentUser?.role === "CLIENT" ? "/salons" : "/?tab=jobs"} className="rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-pink-600/20">
                  {currentUser?.role === "OWNER" ? t("messenger.ctaFindTechs") : currentUser?.role === "CLIENT" ? tr("Tìm tiệm gần bạn", "Find a salon near you") : t("messenger.ctaFindJobs")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN CHAT PANEL */}
      <div data-wallpaper={activeChat ? wp.id : undefined} data-wp-tone={activeChat ? wp.tone : undefined} style={activeChat ? wp.style : undefined} className={`chat-wallpaper isolate flex-1 flex flex-col h-full overflow-hidden relative ${!activeChat && !bubble ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            <ChatHeader
              chat={activeChat}
              bubble={bubble}
              locale={locale}
              typing={activeChatTyping}
              connLost={connLost}
              partnerLastActiveAt={partnerLastActiveAt}
              phoneVerified={!!partnerTrust?.phoneVerified}
              wpSeen={wpSeen}
              blocked={isActiveChatBlocked}
              blockBusy={blockActionLoading}
              onBack={closeThread}
              onWallpaper={openWallpaper}
              onReport={openReport}
              onToggleBlock={handleToggleBlock}
            />

            <ChatThread
              scrollRef={scrollContainerRef}
              nearBottomRef={isNearBottomRef}
              jumpSlotRef={jumpSlotRef}
              memory={threadMemory}
              activeChatRef={activeChatRef}
              chat={activeChat}
              chatKey={activeKey}
              messages={chatMessages}
              nextCursor={chatNextCursor}
              loading={loadingChatMessages}
              currentUser={currentUser}
              locale={locale}
              t={t}
              seenAtMs={seenAtMs}
              reactions={messageReactions}
              partnerTrust={partnerTrust}
              convCreatedAt={convCreatedAt}
              typing={activeChatTyping}
              rowHandlers={rowHandlers}
              onOpenMedia={openMedia}
              onPrepend={prependIntoBucket}
              onReport={openReport}
              onStudio={openStudio}
              onSendText={sendText}
              onStarter={fillStarter}
            />

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
              <ChatComposer
                apiRef={composerApi}
                inputRef={inputRef}
                scrollRef={scrollContainerRef}
                nearBottomRef={isNearBottomRef}
                jumpSlotRef={jumpSlotRef}
                panelPushedRef={panelPushedRef}
                chat={activeChat}
                currentUser={currentUser}
                viewerLang={viewerLang}
                t={t}
                assistReady={assistReady}
                established={established}
                unanswered={unanswered}
                partnerWrote={partnerWrote}
                onSend={send}
                onPhoto={uploadPhoto}
                onTyping={typingPing}
                onStudio={openStudio}
                onConsult={openConsult}
                overlay={composerOverlay}
              />
            )}
          </>
        ) : bubble ? (
          // Bong bóng chat đang tải cuộc trò chuyện (hoặc không còn quyền xem / URL thiếu ?c=) — không có danh sách để
          // chọn nên không bao giờ để vòng quay chạy mãi.
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" aria-busy={!bubbleMissing}>
            {bubbleMissing ? (
              <>
                <MessageSquare className="h-8 w-8 text-pink-300" strokeWidth={1.5} />
                <p className="text-sm font-bold text-slate-200">{tr("Không mở được cuộc trò chuyện này", "Couldn't open this conversation")}</p>
                <button
                  type="button"
                  // Tải trang THẬT (không router.push) — app native chỉ thấy điều hướng thật và chuyển sang app chính.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  onClick={() => window.location.assign(`${window.location.origin}${localeHref("/messages")}`)}
                  className="min-h-[44px] rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-bold text-white"
                >
                  {tr("Mở PawNail", "Open PawNail")}
                </button>
              </>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-pink-300" aria-label={tr("Đang tải", "Loading")} />
            )}
          </div>
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
                          avatarUrl: conv.isGroup ? conv.groupAvatarUrl || "" : partner!.avatarUrl || "",
                          role: conv.isGroup ? "GROUP" : partner!.role,
                          isGroup: conv.isGroup,
                          isOnline: false,
                          statusText: "",
                          conversationId: conv.id,
                        })}
                        className="group flex w-16 flex-col items-center gap-1.5"
                      >
                        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/10 transition group-hover:ring-pink-500/60">
                          {conv.isGroup ? (conv.groupAvatarUrl ? <img src={conv.groupAvatarUrl} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-fuchsia-300" />) : (
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
                      { href: "/?tab=portfolio", title: tr("Tìm thợ sẵn sàng", "Find available techs"), desc: tr("Xem tay nghề và nhắn tin", "See portfolios and message"), icon: "💅" },
                      { href: "/jobs/create", title: tr("Đăng tin tuyển thợ", "Post a job"), desc: tr("Thợ có thể gọi hoặc nhắn tin trực tiếp cho bạn", "Techs can call or message you directly"), icon: "📢" },
                    ]
                  : [
                      { href: "/?tab=jobs", title: tr("Xem việc làm", "Explore jobs"), desc: tr("Nhắn tin cho tiệm đang tuyển quanh bạn", "Message salons hiring near you"), icon: "💼" },
                      { href: "/profile", title: tr("Cập nhật ảnh tay nghề", "Update your portfolio"), desc: tr("Tiệm xem được tay nghề của bạn trước khi nhắn tin", "Salons see your work before they message you"), icon: "📸" },
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

      {showWallpaperPicker && activeChat && currentUser?.id && (
        <WallpaperSheet
          userId={currentUser.id}
          chat={{ id: activeChat.id, isGroup: activeChat.isGroup, conversationId: activeChat.conversationId ?? null, name: activeChat.name }}
          sampleSender={
            activeChat.isGroup
              ? conversations.find((c) => c.id === activeChat.conversationId)?.participants.find((p) => p.id !== currentUser.id)?.name || activeChat.name
              : activeChat.name
          }
          state={wpState}
          market={currentUser?.market ?? null}
          onPreview={setWpPreview}
          onClose={closeWallpaper}
        />
      )}

      {lightbox && (
        <MediaLightbox urls={lightbox.urls} index={lightbox.index} onIndex={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))} onClose={() => setLightbox(null)} />
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
