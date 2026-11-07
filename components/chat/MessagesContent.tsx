"use client";

import { apiError } from "@/lib/i18n/apiError";
import Link from "next/link";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, startTransition } from "react";
import {
  Send, Search, MessageSquare, Loader2, Plus, Users,
  Smile, X, ArrowLeft, Check, CheckCheck, Phone, Video, MoreVertical, Flag, ShieldOff, ShieldCheck, RefreshCw,
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
import { officialAvatarUrl } from "@/lib/brand";
import { UserType, MessageType, foldVi, shortChatTime, PresenceAvatar, TypingDots, describeCall, ROLE_VI, ConversationType, ActiveChatType, MessagesContentProps, ChatBucket, chatKeyFor, mergeSorted, mapServerMessage } from "./chatShared";
import { ReportUserModal, CreateGroupModal } from "./ChatModals";
import MessageRow from "./MessageRow";
import { preloadCallSdk, preloadCallSdkWhenIdle, probeCalls } from "@/lib/callPreload";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { Pin, Palette, Image as ImageIcon, Mic, Plus as PlusIcon, Sparkles as SparklesIcon, X as XIcon, ChevronDown, SendHorizontal } from "lucide-react";
import MediaLightbox from "@/components/ui/MediaLightbox";
import { getPusherClient } from "@/lib/pusherClient";
import { CS } from "@/lib/i18n/chatStrings";
import ChatSuggestions from "./ChatSuggestions";
import ChatContextCard from "./ChatContextCard";
import ChatAssist from "./ChatAssist";
import { replyInVietnamese, starters } from "@/lib/chatAssist";
import dynamic from "next/dynamic";
// Thử mẫu PawNail (vẽ mẫu lên ảnh tay khách) — tải khi mở, không làm nặng Messenger lúc vào.
const NailStudio = dynamic(() => import("@/components/studio/NailStudio"), { ssr: false });
const HandConsult = dynamic(() => import("@/components/consult/HandConsult"), { ssr: false });
// Bảng chọn hình nền: chỉ tải khi mở.
const WallpaperSheet = dynamic(() => import("./WallpaperSheet"), { ssr: false });
import { type Reaction, toggleReaction } from "@/lib/chatReactions";
import MediaPicker from "./MediaPicker";
import VoiceRecorder from "./VoiceRecorder";
import { uploadMedia } from "@/lib/mediaUpload";
import { chatKeyOf, migrateLegacyWallpaper, resolveChoice, type WpRender } from "@/lib/chatWallpapers";
import { useWallpaperRender, useWpState } from "./useChatWallpaper";
import { mediaPreview } from "@/lib/chat/preview";
import { isGifUrl } from "@/lib/chat/gif";
import { trailingEmoji } from "@/lib/chat/emojiOnly";
import StickerSuggest from "./StickerSuggest";
import { pushRecentSticker, readMediaTab } from "@/lib/stickers/store";
import { probeGifs, useGifEnabled } from "@/lib/chat/gifAvailability";
import { guessMarketInBrowser, readMarketCookie } from "@/lib/market";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { useMounted } from "@/lib/useMounted";
import { clearConversation, nativeHandlesChatAlerts, setActiveConversation } from "@/lib/nativePush";
import ChatNotifyBanner from "./ChatNotifyBanner";
import { autoTranslates, getTranslation, requestTranslation, useMessageTranslation } from "./messageTranslation";
// Messenger V2: CSS riêng (mọi quy tắc nằm dưới .pn-msgr). Import ở đây, không ở app/messages/layout.tsx — nhánh
// đổi route sang app/[lang]/ xoá layout đó; CSS đi cùng component nên không thể bị rơi khi gộp nhánh.
import "./messenger.css";

// Ô soạn tin tự cao theo nội dung (tối đa 6 dòng = 152px rồi cuộn trong). Trình duyệt có `field-sizing: content`
// thì CSS tự lo; còn lại đặt chiều cao theo scrollHeight.
function growInput(el: HTMLTextAreaElement | null) {
  if (!el || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(152, el.scrollHeight)}px`;
}
const finePointer = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;
/** "smooth" trừ khi người dùng bật giảm chuyển động */
const scrollBehavior = (): ScrollBehavior => (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// Thông tin tin cậy THẬT của đối phương (1 lần / người / phiên): thành phố, ngày tham gia, SĐT đã xác minh.
type PartnerTrust = { city?: string | null; state?: string | null; createdAt?: string; phoneVerified?: boolean };
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
const SAFETY_KEY = "pn_safety_dismissed";

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
  const chatMessages = activeBucket?.messages ?? [];
  const chatNextCursor = activeBucket?.nextCursor ?? null;
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

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

  // Ô nhập KHÔNG điều khiển bằng state: mỗi phím gõ mà setState ở component
  // 1.900 dòng này là render lại cả danh sách tin + hội thoại → gõ bị khựng
  // trên điện thoại. Chữ nằm trong DOM (inputRef); state chỉ đổi khi ô chuyển
  // rỗng ↔ có chữ (để bật/tắt nút Gửi).
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasTextState] = useState(false);
  // Đang gõ → 3 nút (ảnh / ghi âm / GIF) thu vào 1 nút "+" cho ô nhập rộng ra (như Messenger)
  const [toolsOpen, setToolsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [consult, setConsult] = useState<{ image: string | null } | null>(null); // Soi tay tư vấn ngay trong chat
  const hasTextRef = useRef(false);
  // Chỉ gọi setState khi THẬT SỰ đổi (gọi với cùng giá trị React vẫn có thể chạy lại thân component).
  const setHasText = useCallback((v: boolean) => {
    if (hasTextRef.current === v) return;
    hasTextRef.current = v;
    setHasTextState(v);
    if (!v) setToolsOpen(false); // xoá hết chữ → hiện lại các nút ảnh / ghi âm / GIF
  }, []);
  // Gợi ý nhãn dán: ô soạn tin là đúng 1 emoji (hoặc "từ" cuối là 1 emoji) → thanh nhãn khớp phía trên ô (StickerSuggest).
  // Chỉ setState khi emoji gợi ý ĐỔI (gõ chữ thường không render lại component lớn này). Đóng (×) → ẩn cho tới khi đổi emoji.
  const [stickerHint, setStickerHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState<string | null>(null);
  const stickerHintRef = useRef<string | null>(null);
  // Cả ô là 1 emoji → hiện NGAY; chỉ "từ" cuối là emoji (đang gõ câu: "ok 😂", "😂" → "😂😂") → chờ 200ms gõ yên mới hiện,
  // thanh không bật / tắt liên tục (mỗi lần ~72px khung tin co / giãn). Ẩn thì luôn ngay (không để thanh gợi ý emoji cũ).
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateStickerHint = useCallback((v: string) => {
    const g = trailingEmoji(v);
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    const apply = () => {
      if (g === stickerHintRef.current) return;
      stickerHintRef.current = g;
      setStickerHint(g);
      if (!g) setHintDismissed(null);
    };
    if (!g || g === stickerHintRef.current || v.trim() === g) apply();
    else hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null;
      apply();
    }, 200);
  }, []);
  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);
  const setMessageText = useCallback((v: string | ((prev: string) => string)) => {
    const el = inputRef.current;
    if (!el) return;
    el.value = typeof v === "function" ? v(el.value) : v;
    setHasText(!!el.value.trim());
    updateStickerHint(el.value);
    growInput(el);
  }, [setHasText, updateStickerHint]);
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

  // Cảm xúc đã đổi trong phiên (realtime / vừa bấm) — đè lên msg.reactions tải từ máy chủ.
  const [messageReactions, setMessageReactions] = useState<{ [msgId: string]: Reaction[] }>({});

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [gifHandoff, setGifHandoff] = useState<string | undefined>(undefined); // "Tìm GIF …" từ tab Nhãn dán
  // GIF chỉ có khi máy chủ có khoá GIPHY / Tenor — chưa có thì ẩn MỌI lối vào GIF (tab, menu "+", "Tìm GIF …")
  const gifOn = useGifEnabled();
  // Thị trường cho bộ nhãn dán theo mùa: tài khoản → cookie → đoán theo trình duyệt → Mỹ
  const stickerMarket = useMemo<"US" | "AU">(() => {
    const m = currentUser?.market;
    if (m === "US" || m === "AU") return m;
    return (typeof window !== "undefined" && (readMarketCookie() ?? guessMarketInBrowser())) || "US";
  }, [currentUser?.market]);
  const [recording, setRecording] = useState(false);

  // Chặn/Báo cáo — bắt buộc theo App Store Guideline 1.2 cho app có nhắn tin
  // giữa người dùng với nhau.
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  // Tài khoản chính thức PawNail (tick xanh) — luôn ghim đầu danh sách làm kênh hỗ trợ.
  const [official, setOfficial] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/official").then((r) => (r.ok ? r.json() : null)).then((d) => d?.account && setOfficial(d.account)).catch(() => {});
  }, []);
  const [showChatMenu, setShowChatMenu] = useState(false);
  // V2: ảnh toàn màn hình, bảng đính kèm "+", lượt đồng bộ lại (mạng quay lại / mở lại app), nút xuống tin mới nhất
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const [jump, setJump] = useState<{ show: boolean; unseen: number }>({ show: false, unseen: 0 });
  // V2.1: MỘT viên ngày nổi khi cuộn (thay cho các viên sticky chồng lên nhau) + vùng đọc màn hình chỉ cho tin MỚI đến
  const [floatDate, setFloatDate] = useState<{ label: string; idle: boolean } | null>(null);
  const [liveText, setLiveText] = useState("");
  const [assistOpen, setAssistOpen] = useState(false);
  const jumpShownRef = useRef(false);
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
    setShowChatMenu(false);
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
  const chatObserverTarget = useRef<HTMLDivElement>(null);
  // ?to= ngoài danh sách systemUsers → tra hồ sơ 1 lần duy nhất mỗi partner.
  const directPartnerLookupRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevChatKeyRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  // Bù vị trí cuộn khi chèn tin cũ lên trên: chụp chiều cao NGAY TRƯỚC khi chèn
  // + id tin đầu tiên, chỉ bù ở đúng lần render có tin cũ mới vào.
  const pendingScrollAdjustRef = useRef<{ prevScrollHeight: number; firstId: string | undefined } | null>(null);
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
    updateStickerHint("");
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

      const res = await fetch(`/api/messages?conversationId=${key}&cursor=${chatNextCursor}`);
      if (res.ok) {
        const data = await res.json();
        const safeMsgs = (data.messages || []).map(mapServerMessage);
        const container = scrollContainerRef.current;
        // chỉ khi vẫn đang mở đúng cuộc trò chuyện này (đổi chat giữa chừng → không để lại "đang chỉnh vị trí" cho chat mới)
        if (container && safeMsgs.length && activeChatRef.current?.conversationId === key) {
          pendingScrollAdjustRef.current = { prevScrollHeight: container.scrollHeight, firstId: chatMessagesRef.current[0]?.id };
        }
        // Việc nền: React chia nhỏ việc dựng vài chục bong bóng → cuộn không khựng.
        startTransition(() => prependIntoBucket(key, safeMsgs, data.nextCursor || null));
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
      // Tải trước khi người dùng còn cách đỉnh ~800px (kiểu Telegram) → cuộn lên
      // không phải đứng chờ "đang tải lịch sử".
      { root: scrollContainerRef.current, rootMargin: "800px 0px 0px 0px", threshold: 0 }
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
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = dist < 150;
      // Nút "xuống tin mới nhất": chỉ setState khi vượt ngưỡng (hiện > 400px, ẩn < 120px)
      if (!jumpShownRef.current && dist > 400) { jumpShownRef.current = true; setJump((j) => ({ ...j, show: true })); }
      else if (jumpShownRef.current && dist < 120) { jumpShownRef.current = false; setJump({ show: false, unseen: 0 }); }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Đang ở cuối đoạn chat mà ảnh / GIF / sticker / video tải xong (làm nội dung cao thêm) → giữ dính
    // đáy như Messenger. Trước đây mở cuộc trò chuyện có ảnh thì dừng lửng lơ cách đáy vài trăm px,
    // tin mới nhất bị khuất. Đang kéo lên đọc tin cũ thì không kéo xuống.
    const keepPinned = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || !/^(IMG|VIDEO)$/.test(t.tagName) || !isNearBottomRef.current) return;
      // GIF có khung cố định theo #wh (không đổi chiều cao khi tải) và trình phát MP4 dựng / gỡ theo vị trí cuộn → không kéo xuống
      if (t.closest(".m-gif")) return;
      el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("load", keepPinned, true);
    el.addEventListener("loadedmetadata", keepPinned, true);
    // Bàn phím mở (WebView co lại), hàng gợi ý hiện/ẩn, ô nhập cao thêm, ảnh giải mã xong… → khung cuộn đổi cỡ.
    // Đang ở sát đáy (≤ 80px) trước khi đổi → giữ dính đáy để tin mới nhất không bị khung soạn tin che.
    let lastDist = 0;
    const track = () => { lastDist = el.scrollHeight - el.scrollTop - el.clientHeight; };
    el.addEventListener("scroll", track, { passive: true });
    // Giữ dính đáy KHÔNG phụ thuộc việc đang nạp trang tin cũ (pendingScrollAdjustRef): đang ở đáy thì kéo xuống đáy là đúng,
    // và bước giữ chỗ khi trang cũ chèn lên đầu (useLayoutEffect bên dưới) cộng thêm phần cao mới → bị kẹp ở đáy, vẫn đúng.
    // Trước đây máy lag (trang cũ nạp lâu) là các lần giữ dính đáy bị bỏ → tin cuối cao thêm nằm khuất dưới khung soạn tin.
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (lastDist <= 80) el.scrollTop = el.scrollHeight;
          track();
        })
      : null;
    ro?.observe(el);
    // Khối không phải bong bóng (thẻ đầu cuộc trò chuyện, thẻ an toàn, thẻ menu/việc, "đang soạn") tải dữ liệu sau
    // và cao thêm → theo dõi riêng các khối đó (không theo dõi từng bong bóng: tin mới vẫn cuộn mượt như cũ).
    const isBlock = (n: Node): n is Element => n instanceof Element && !n.matches(".m-row, .m-sep, .m-gap");
    Array.from(el.children).filter(isBlock).forEach((c) => ro?.observe(c));
    // 2 dòng tin CUỐI cao thêm sau khi đã hiện (bản dịch tự động về, cảm xúc mới, "Đã xem", ảnh / nhãn dán tải xong trên mạng
    // chậm…): khung tin không đổi cỡ nên RO trên không báo → đang ở đáy mà tin cuối bị khung soạn tin che dần. Bỏ qua lần báo
    // đầu tiên lúc mới theo dõi (tin vừa gửi / vừa đến vẫn cuộn mượt theo hiệu ứng ở dưới, không bị kéo giật xuống).
    const rowH = new WeakMap<Element, number>();
    let tail: Element[] = [];
    const tailRo = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          let grew = false;
          for (const e of entries) {
            const h = e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height;
            const was = rowH.get(e.target);
            rowH.set(e.target, h);
            if (was !== undefined && h > was + 0.5) grew = true; // chỉ khi CAO THÊM (thấp đi thì trình duyệt tự kẹp scrollTop)
          }
          if (grew && lastDist <= 80) el.scrollTop = el.scrollHeight;
          track();
        })
      : null;
    const watchTail = () => {
      if (!tailRo) return;
      const rows = el.querySelectorAll(":scope > .m-row");
      const next = Array.from(rows).slice(-2);
      if (next.length === tail.length && next.every((r, i) => r === tail[i])) return;
      tail.forEach((r) => { if (!next.includes(r)) tailRo.unobserve(r); });
      next.forEach((r) => {
        if (tail.includes(r)) return;
        // mốc chiều cao lấy NGAY lúc bắt đầu theo dõi (không chờ lần báo đầu của RO): máy lag, dòng có thể cao thêm trước lần
        // báo đầu → trước đây lần báo đó thành mốc, không bao giờ được tính là "cao thêm". offsetHeight (không tính transform):
        // dòng mới đang chạy hiệu ứng vào (scale .98) — đo theo khung đã co sẽ thành "cao thêm" giả, kéo giật mất cuộn mượt.
        if (!rowH.has(r)) rowH.set(r, (r as HTMLElement).offsetHeight);
        tailRo.observe(r);
      });
      tail = next;
    };
    watchTail();
    const mo = typeof MutationObserver !== "undefined"
      ? new MutationObserver((muts) => {
          for (const m of muts) m.addedNodes.forEach((n) => { if (isBlock(n)) ro?.observe(n); });
          watchTail();
        })
      : null;
    mo?.observe(el, { childList: true });
    return () => {
      mo?.disconnect();
      tailRo?.disconnect();
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("scroll", track);
      el.removeEventListener("load", keepPinned, true);
      el.removeEventListener("loadedmetadata", keepPinned, true);
      ro?.disconnect();
    };
    // Khung cuộn chỉ có khi đang mở 1 cuộc trò chuyện → gắn lại mỗi lần mở / đổi cuộc trò chuyện
    // (trước đây gắn 1 lần lúc vào trang: vào hộp thư rồi mới bấm mở thì không bao giờ gắn).
  }, [activeKey]);

  // Single scroll-management effect covering all three cases: restoring
  // position after prepending history, jumping to bottom on chat switch, and
  // smooth-scrolling down for a genuinely new message (own message, or the
  // user was already near the bottom).
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Đổi cuộc trò chuyện xét TRƯỚC: việc chỉnh vị trí của trang tin cũ (nếu còn treo) thuộc chat trước, bỏ đi — trước đây nó
    // chạy trên chat mới (tin đầu khác) → cộng nhầm scrollTop và bỏ qua bước về đáy.
    if (prevChatKeyRef.current !== activeKey) {
      prevChatKeyRef.current = activeKey;
      prevMessageCountRef.current = chatMessages.length;
      pendingScrollAdjustRef.current = null;
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true; // vừa mở cuộc trò chuyện = đang ở đáy (ảnh tải sau vẫn giữ dính đáy)
      return;
    }

    if (pendingScrollAdjustRef.current && chatMessages[0]?.id !== pendingScrollAdjustRef.current.firstId) {
      const { prevScrollHeight } = pendingScrollAdjustRef.current;
      // Giữ nguyên chỗ đang đọc (kể cả khi người dùng vẫn đang cuộn).
      el.scrollTop = el.scrollTop + (el.scrollHeight - prevScrollHeight);
      pendingScrollAdjustRef.current = null;
      prevMessageCountRef.current = chatMessages.length;
      return;
    }

    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = chatMessages.length;
    if (chatMessages.length <= prevCount) return;

    const lastMsg = chatMessages[chatMessages.length - 1];
    const isOwn = lastMsg?.senderId === currentUser?.id;
    if (isOwn || isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    } else if (!isOwn) {
      setJump((j) => ({ show: true, unseen: j.unseen + (chatMessages.length - prevCount) }));
      jumpShownRef.current = true;
    }
  }, [chatMessages, activeKey, currentUser?.id]);

  // Which message ids are appearing in the DOM for the first time this
  // session — only these get the entrance animation, so revisiting an
  // already-seen chat doesn't replay it for the whole history.
  const freshMessageIds = useMemo(() => {
    const fresh = new Set<string>();
    chatMessages.forEach((m) => {
      const k = m.clientId || m.id;
      if (!animatedMessageIdsRef.current.has(k)) {
        fresh.add(k);
        animatedMessageIdsRef.current.add(k);
      }
      animatedMessageIdsRef.current.add(m.id);
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
    channel.bind("message-recalled", handleMessageRecalled);
    channel.bind("user-typing", handleUserTyping);

    return () => {
      channel.unbind("pusher:subscription_error", handleSubscriptionError);
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-updated", handleMessageUpdated);
      channel.unbind("message-seen", handleMessageSeen);
      channel.unbind("message-recalled", handleMessageRecalled);
      channel.unbind("user-typing", handleUserTyping);
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
    if (!activeChat || (sending && !activeChat.conversationId)) return;

    const content = customContent || (inputRef.current?.value ?? "").trim();
    const type = customType || "TEXT";
    if (!content) return;

    if (!customContent) setMessageText("");
    // Gửi nhãn dán / GIF: bảng VẪN MỞ (gửi liền nhiều cái như Telegram)
    if (!opts?.keepPanel) {
      setShowEmoji(false);
      setShowGifs(false);
    }
    setAttachOpen(false);

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
    setSending(true);

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
      setSending(false);
    }
  }, [activeChat, sending, currentUser, loadData, mergeIntoBucket, removeFromBucket, rekeyBucket, setMessageText, patchBucket]);

  // Bấm "Thử lại" trên 1 tin nhắn gửi lỗi — bỏ bong bóng lỗi cũ, gửi lại y
  // nguyên nội dung như 1 lần gửi mới (tạo bong bóng optimistic mới).
  const retrySendMessage = useCallback((msg: MessageType) => {
    const key = chatKeyFor(activeChat);
    // Gửi lại đúng mã cũ (máy chủ không tạo trùng) và giữ nguyên vị trí bong bóng.
    patchBucket(key, (bucket) => ({ ...bucket, messages: bucket.messages.map((m) => (m.id === msg.id ? { ...m, sendError: false, isOptimistic: true } : m)) }));
    handleSendMessage(null, msg.content, msg.type, msg.clientId);
  }, [activeChat, patchBucket, handleSendMessage]);

  const handleCloseMediaPanel = useCallback(() => {
    setShowEmoji(false);
    setShowGifs(false);
  }, []);

  // Chạm 1 nhãn trên thanh gợi ý: gửi nhãn đó + bỏ emoji vừa gõ khỏi ô soạn tin (cả ô chỉ là emoji → ô trống; "hehe 😂" →
  // còn "hehe", không mất chữ đã gõ). Bàn phím vẫn mở (nút chặn pointerdown).
  const pickSuggestedSticker = (id: string) => {
    const el = inputRef.current;
    const g = stickerHintRef.current;
    if (el && g) {
      const t = el.value.trimEnd();
      setMessageText(t.endsWith(g) ? t.slice(0, t.length - g.length).trimEnd() : t);
    }
    if (currentUser?.id) pushRecentSticker(currentUser.id, id);
    handleSendMessage(null, id, "STICKER", undefined, { keepPanel: true });
  };

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

  // Vị trí tin cuối cùng của mình trong đoạn chat (gắn Đã gửi/Đã xem).
  const lastSelfIndex = useMemo(
    () => chatMessages.reduce((acc, m, i) => (m.senderId === currentUser?.id ? i : acc), -1),
    [chatMessages, currentUser?.id]
  );
  // Đoạn chat đã qua lại vài lượt (mỗi bên ≥ 3 tin) → hàng "Gợi ý" thu thành 1 nút nhỏ, nhường chỗ cho tin nhắn
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
  const lastIncoming = chatMessages.length ? chatMessages[chatMessages.length - 1] : null;
  const lastIncomingKey = lastIncoming && lastIncoming.senderId !== currentUser?.id ? lastIncoming.clientId || lastIncoming.id : null;
  useEffect(() => {
    // chỉ tin vừa đến (≤ 60 giây) — không đọc tin cũ khi mở cuộc trò chuyện / tải thêm trang cũ
    if (!lastIncomingKey || !lastIncoming || !freshMessageIds.has(lastIncomingKey) || Date.now() - new Date(lastIncoming.createdAt).getTime() > 60_000) return;
    const who = activeChat?.isGroup ? lastIncoming.sender?.name ?? "" : activeChat?.name ?? "";
    const body = lastIncoming.type === "TEXT" || !lastIncoming.type ? String(lastIncoming.content || "").slice(0, 200) : lastIncoming.type === "IMAGE" ? (isGifUrl(lastIncoming.content) ? "GIF" : "📷") : lastIncoming.type === "AUDIO" ? "🎤" : "";
    setLiveText(`${who}: ${body}`);
  }, [lastIncomingKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Khách đang nhắn với tiệm / thợ → ✨ là "Thử mẫu trên tay mình rồi gửi tiệm"
  const clientChat = currentUser?.role === "CLIENT" && !activeChat?.isGroup && (activeChat?.role === "TECHNICIAN" || activeChat?.role === "OWNER");
  // Tin của đối phương mà mình CHƯA trả lời (để Trợ lý PawNail gợi ý đúng câu cần trả lời). Vòng lặp dừng ngay
  // ở tin đầu tiên của mình tính từ cuối lên — rẻ, không cần useMemo; ChatAssist tự memo theo nội dung.
  let unanswered: { content: string; type: "TEXT" | "IMAGE" } | null = null;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i];
    if (m.senderId === currentUser?.id) break;
    // GIF (GIPHY / Tenor, có khi là MP4) không phải ảnh tay / mẫu móng → bỏ qua, xét tin trước đó
    if (m.type === "IMAGE" && isGifUrl(m.content)) continue;
    if (m.type === "IMAGE" || !m.type || m.type === "TEXT") { unanswered = { content: String(m.content || ""), type: m.type === "IMAGE" ? "IMAGE" : "TEXT" }; break; }
  }
  const partnerWrote = chatMessages.some((m) => m.senderId !== currentUser?.id && m.type !== "SYSTEM");
  // Props ỔN ĐỊNH cho MessageRow (React.memo): đối tượng/hàm giữ nguyên danh
  // tính giữa các lần render, gọi bản mới nhất qua ref.
  const rowChat = useMemo(
    () => ({ isGroup: !!activeChat?.isGroup, avatarUrl: activeChat?.avatarUrl, name: activeChat?.name ?? "" }),
    [activeChat?.isGroup, activeChat?.avatarUrl, activeChat?.name]
  );
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

  // ----- V2: tin cậy của đối phương (thẻ đầu cuộc trò chuyện) + thẻ "Nhắn tin an toàn" lần đầu liên hệ
  const [partnerTrust, setPartnerTrust] = useState<PartnerTrust | null>(null);
  useEffect(() => {
    setPartnerTrust(null);
    if (!activeChat || activeChat.isGroup) return;
    let alive = true;
    loadTrust(activeChat.id).then((t) => alive && setPartnerTrust(t));
    return () => { alive = false; };
  }, [activeChat?.id, activeChat?.isGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  const [safetyHidden, setSafetyHidden] = useState<Record<string, true>>(() => {
    try { return JSON.parse(localStorage.getItem(SAFETY_KEY) || "{}"); } catch { return {}; }
  });
  const activeConv = activeChat?.conversationId ? conversations.find((c) => c.id === activeChat.conversationId) : undefined;
  const iSentAny = chatMessages.some((m) => m.senderId === currentUser?.id);
  const convYoung = !activeConv || Date.now() - new Date(activeConv.createdAt).getTime() < 7 * 86_400_000;
  const showSafety =
    !!activeChat && !activeChat.isGroup && activeChat.role !== "ADMIN" && !isVerifiedRole(activeChat.role) &&
    (convYoung || !iSentAny) && !safetyHidden[activeKey || ""];
  // Thẻ đầu cuộc trò chuyện cao thêm khi thông tin tin cậy / thẻ an toàn tải xong → vẫn giữ dính đáy nếu đang ở đáy
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isNearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [partnerTrust, showSafety]);
  const dismissSafety = () => {
    const k = activeKey || "";
    setSafetyHidden((prev) => {
      const next = { ...prev, [k]: true as const };
      try { localStorage.setItem(SAFETY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
        setAttachOpen(false);
        setShowEmoji(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Bảng Emoji / Nhãn dán / GIF trên điện thoại: thêm 1 mục lịch sử khi mở → nút Back (Android / trình duyệt) đóng
  // bảng trước, không thoát cuộc trò chuyện. Đóng bằng X / Esc / chạm ra ngoài → tự bỏ mục đó.
  const panelOpen = showEmoji || showGifs;
  // Thanh gợi ý nhãn dán hiện / ẩn (và hàng gợi ý trả lời đổi theo ô trống ↔ có chữ) làm khung tin co / giãn. ResizeObserver
  // của khung tin giữ dính đáy, NHƯNG 2 lần đổi ngược nhau trong cùng 1 khung hình (xoá ô rồi gõ emoji ngay) thì nó không báo
  // gì (cỡ cuối = cỡ cũ) trong khi trình duyệt đã kéo scrollTop lùi lúc khung giãn → tin cuối bị thanh che. Đang ở sát đáy →
  // dính lại đáy ngay sau mỗi lần đổi (trước khi vẽ).
  const stripShown = !!stickerHint && stickerHint !== hintDismissed && !panelOpen && !recording;
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isNearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [stripShown, hasText]);
  const panelPushedRef = useRef(false);
  useEffect(() => {
    if (panelOpen) {
      if (panelPushedRef.current || window.matchMedia("(min-width: 768px)").matches) return;
      try {
        window.history.pushState({ ...((window.history.state || {}) as Record<string, unknown>), pnPanel: true }, "");
        panelPushedRef.current = true;
      } catch {}
    } else if (panelPushedRef.current) {
      panelPushedRef.current = false;
      if ((window.history.state as { pnPanel?: boolean } | null)?.pnPanel) window.history.back();
    }
  }, [panelOpen]);
  useEffect(() => {
    const onPop = () => {
      if (panelPushedRef.current && !(window.history.state as { pnPanel?: boolean } | null)?.pnPanel) {
        panelPushedRef.current = false;
        setShowEmoji(false);
        setShowGifs(false);
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
  // Viên ngày nổi: ngày của đoạn đang đọc ở đỉnh khung (viên trong dòng tin đã cuộn qua); mờ đi sau 1,2 giây đứng yên.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let raf = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      let label: string | null = null;
      for (const sep of el.querySelectorAll<HTMLElement>(".m-sep")) {
        if (sep.getBoundingClientRect().top - top < 8) label = sep.textContent;
        else break;
      }
      setFloatDate((p) => (label ? (p?.label === label && !p.idle ? p : { label, idle: false }) : null));
      clearTimeout(idle);
      idle = setTimeout(() => setFloatDate((p) => (p ? { ...p, idle: true } : p)), 1200);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      setFloatDate(null);
    };
  }, [activeChat?.id]);
  // Bảng đính kèm: Esc đóng + trả focus về nút "+"; mở ra thì focus mục đầu
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const attachSheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!attachOpen) return;
    attachSheetRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAttachOpen(false);
      attachBtnRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attachOpen]);
  // Gợi ý trả lời thu gọn lại khi đổi cuộc trò chuyện
  useEffect(() => setAssistOpen(false), [activeChat?.id]);
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
      avatarUrl: conv.isGroup ? "" : partner!.avatarUrl || "",
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

  // ----- V2: đồng bộ lại sau khi mất kết nối / mở lại app (tin tới lúc socket rớt không bị mất tới khi mở lại chat)
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
    let wasDown = false;
    const onState = ({ current }: { previous: string; current: string }) => {
      if (current === "connected") {
        if (lostTimer) clearTimeout(lostTimer);
        setConnLost(false);
        if (wasDown) resync();
        wasDown = false;
      } else if (current === "unavailable" || current === "disconnected" || current === "connecting") {
        wasDown = true;
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

  // ----- V2: chiều cao khung soạn tin → vị trí nút "xuống tin mới nhất"
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Khung soạn tin cao thêm (bảng Emoji / Nhãn dán / GIF nằm TRONG khung trên điện thoại, ô nhập nhiều dòng…) → khung tin
    // co lại; đang ở cuối đoạn chat thì giữ dính đáy để tin vừa gửi không bị khuất.
    const ro = new ResizeObserver(() => {
      el.parentElement?.style.setProperty("--m-composer-h", `${el.offsetHeight}px`);
      const sc = scrollContainerRef.current;
      if (sc && isNearBottomRef.current) sc.scrollTop = sc.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeChat?.id, isActiveChatBlocked]);
  const jumpToLatest = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight * 3) el.scrollTop = el.scrollHeight - el.clientHeight - 600;
    el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    jumpShownRef.current = false;
    setJump({ show: false, unseen: 0 });
  }, []);
  useEffect(() => { jumpShownRef.current = false; setJump({ show: false, unseen: 0 }); }, [activeKey]);

  // Mở 1 cuộc trò chuyện → hỏi trước GIF có dùng được không (1 lần / phiên) để menu "+" và bảng biểu tượng hiện đúng ngay.
  const hasActiveChat = !!activeChat;
  useEffect(() => {
    if (hasActiveChat) probeGifs();
  }, [hasActiveChat]);

  // Đang mở chat 1-1 → tải sẵn bộ gọi lúc rảnh để bấm gọi là đổ chuông/thông ngay.
  useEffect(() => {
    if (activeChat && !activeChat.isGroup && !bubble) {
      preloadCallSdkWhenIdle();
      probeCalls(); // gọi được chưa (1 lần / phiên) — bấm gọi khi dịch vụ chưa cấu hình thì báo ngay, không đổ chuông bên kia
    }
  }, [activeChat?.id, activeChat?.isGroup]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {conversationRows.map(({ conv, partner, displayName, lastMsg }) => {
                const isGroup = conv.isGroup;
                const avatarUrl = isGroup ? "" : partner!.avatarUrl || "";
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
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 ring-1 ring-white/10">
                        <Users className="h-5 w-5 text-fuchsia-300" />
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
              })}
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
            <div className="pn-glass-bar relative flex flex-none items-center justify-between gap-3 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 z-10">
              <div className="flex items-center gap-3">
                {!bubble && (
                <button
                  onClick={closeThread}
                  aria-label={tr("Quay lại danh sách", "Back to chats")}
                  className="m-back -ml-1 mr-0.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white md:hidden"
                >
                  <ArrowLeft className="h-4 w-4" /><span className="sr-only">{locale === "vi" ? tr("Quay lại", "Back") : "Back"}</span>
                </button>
                )}
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
                    {/* Điện thoại: chạm vào tên để xem hồ sơ (chỗ chật, ẩn chữ "Xem hồ sơ" để không đè nút gọi). */}
                    {activeChat.isGroup ? (
                      <span className="truncate">{activeChat.name}</span>
                    ) : (
                      <Link href={`/profile/${activeChat.id}`} className="truncate hover:text-pink-200">{activeChat.name}</Link>
                    )}
                    {!activeChat.isGroup && isVerifiedRole(activeChat.role) && <VerifiedBadge className="h-4 w-4" />}
                    {!activeChat.isGroup && partnerTrust?.phoneVerified && <ShieldCheck aria-label={tr(" SĐT đã xác minh", " Phone verified").trim()} className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />}
                  </h3>
                  {/* Trước đây chấm xanh "đang hoạt động" hiện cứng cho MỌI người
                      (app không theo dõi online) — bỏ, thay bằng thông tin thật. */}
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-slate-400">
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
                        ) : connLost ? (
                          <span>{CS.connecting()}</span>
                        ) : (
                          <span>{lastActiveLabel(partnerLastActiveAt) || ROLE_VI()[activeChat.role] || tr("Thành viên", "Member")}</span>
                        )}
                        <span className="hidden text-slate-600 sm:inline">·</span>
                        <Link href={`/profile/${activeChat.id}`} className="hidden font-semibold text-pink-300 hover:text-pink-200 sm:inline">
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
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={openWallpaper}
                  className="hidden h-10 w-10 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-white/[0.06] hover:text-pink-300 sm:flex"
                  title={tr("Đổi chủ đề đoạn chat", "Change chat theme")}
                  aria-label={tr("Đổi chủ đề đoạn chat", "Change chat theme")}
                >
                  <Palette className="h-5 w-5" />
                </button>
                {/* Bong bóng chat: không gọi trong cửa sổ nhỏ (cuộc gọi đến / đi thuộc app chính) */}
                {!activeChat.isGroup && !bubble && (
                  <>
                    <button
                      onPointerEnter={preloadCallSdk}
                      onClick={() => callPartner && startCall(callPartner, "audio")}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-white/[0.06] hover:text-pink-300"
                      title={tr("Cuộc gọi thoại bảo mật", "Secure voice call")}
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      onPointerEnter={preloadCallSdk}
                      onClick={() => callPartner && startCall(callPartner, "video")}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-white/[0.06] hover:text-pink-300"
                      title={tr("Cuộc gọi video thời gian thực", "Live video call")}
                    >
                      <Video className="h-[22px] w-[22px]" />
                    </button>
                  </>
                )}

                {/* ⋮ — cả chat 1-1 lẫn nhóm (nhóm: chỉ có Hình nền) */}
                <div className="relative">
                  <button
                    onClick={() => setShowChatMenu((v) => !v)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-white/[0.06] hover:text-pink-300"
                    title={tr("Thêm tùy chọn", "More options")}
                    aria-label={tr("Thêm tùy chọn", "More options")}
                    aria-haspopup="menu"
                    aria-expanded={showChatMenu}
                  >
                    <MoreVertical className="h-5 w-5" />
                    {!wpSeen && <span aria-hidden className="pn-menu-dot" />}
                  </button>

                  {showChatMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                      <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fadeIn">
                        <button
                          role="menuitem"
                          onClick={openWallpaper}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-slate-850 transition-colors"
                        >
                          <Palette className="h-4 w-4 text-pink-400" />{tr(" Hình nền đoạn chat", " Chat wallpaper")}
                        </button>
                        {!activeChat.isGroup && (
                          <>
                            <button
                              role="menuitem"
                              onClick={() => { setShowChatMenu(false); setShowReportModal(true); }}
                              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-slate-850 transition-colors"
                            >
                              <Flag className="h-4 w-4 text-amber-400" />{tr(" Báo cáo người dùng", " Report user")}
                            </button>
                            <button
                              role="menuitem"
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
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">{liveText}</p>
            <div ref={scrollContainerRef} className="m-scroll flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] px-3 py-4 sm:px-6 custom-scrollbar flex flex-col min-w-0 relative">
              {floatDate && (
                <div aria-hidden className="m-float-date" data-idle={floatDate.idle ? "1" : "0"}>
                  <span className="pn-date-pill">{floatDate.label}</span>
                </div>
              )}
              <div ref={chatObserverTarget} className="h-2 w-full flex-none" />

              {/* Nhãn nổi (cao 0, dính đỉnh) — KHÔNG chiếm chỗ, nên hiện/ẩn không đẩy
                  chỗ đang đọc lên xuống. */}
              {loadingMoreChatMessages && (
                <div className="sticky top-0 z-10 !my-0 flex h-0 flex-none justify-center overflow-visible">
                  <div className="mt-1 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-4xs font-bold text-slate-400 shadow-lg ring-1 ring-white/10 animate-fadeIn">
                    <Loader2 className="h-3 w-3 animate-spin text-pink-500" />
                    <span>{t("messenger.loadingHistory")}</span>
                  </div>
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

              {/* Đầu cuộc trò chuyện (đã cuộn tới tin đầu tiên): thẻ hồ sơ đối phương như Messenger —
                  biết đang nói chuyện với ai, và đoạn chat ngắn không còn trống trơn. */}
              {!activeChat.isGroup && !chatNextCursor && chatMessages.length > 0 && (
                <div className="m-intro flex flex-none flex-col items-center gap-2 pb-4 pt-6 text-center">
                  <span className="m-intro-avatar isolate">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarSrc(activeChat.avatarUrl, activeChat.name, activeChat.id)} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white/5" />
                  </span>
                  <p className="flex items-center gap-1 text-base font-black text-white">
                    {activeChat.name}
                    {isVerifiedRole(activeChat.role) && <VerifiedBadge className="h-4 w-4" />}
                  </p>
                  <p className="text-xs text-slate-400">{ROLE_VI()[activeChat.role] || tr("Thành viên PawNail", "PawNail member")}</p>
                  {(partnerTrust?.city || partnerTrust?.state) && <p className="text-[13px] text-[var(--m-text-2)]">{[partnerTrust.city, partnerTrust.state].filter(Boolean).join(", ")}</p>}
                  {partnerTrust?.createdAt && (
                    <p className="text-[12px] text-[var(--m-text-3)]">
                      {CS.joined(new Date(partnerTrust.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : currentUser?.market === "AU" ? "en-AU" : "en-US", { month: "short", year: "numeric" }))}
                    </p>
                  )}
                  <Link href={`/profile/${activeChat.id}`} className="mt-1 rounded-full bg-white/[0.07] px-4 py-1.5 text-xs font-bold text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] sm:hidden">
                    {tr("Xem hồ sơ", "View profile")}
                  </Link>
                </div>
              )}

              {showSafety && !chatNextCursor && (
                <div className="m-safety flex-none" role="note">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--m-champagne)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--m-text)]">{CS.safetyTitle()}</p>
                    <p className="mt-0.5">{CS.safetyBody()}</p>
                    <button type="button" onClick={() => setShowReportModal(true)} className="mt-1.5 min-h-8 text-[14px] font-semibold text-[var(--m-accent-ink)]">{CS.report()}</button>
                  </div>
                  <button type="button" onClick={dismissSafety} aria-label={CS.dismiss()} className="-mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--m-text-3)]">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!activeChat.isGroup && !chatNextCursor && currentUser?.id && (
                <ChatContextCard
                  meRole={currentUser.role}
                  meId={currentUser.id}
                  partner={{ id: activeChat.id, name: activeChat.name, role: activeChat.role, isGroup: activeChat.isGroup }}
                  onStudio={() => setStudioOpen(true)}
                  onSendText={(text) => handleSendMessage(null, text)}
                  compact={chatMessages.length > 0}
                />
              )}

              {chatMessages.length > 0 ? (
                chatMessages.map((msg, idx) => {
                  const isLastSelf = idx === lastSelfIndex;
                  return (
                    <MessageRow
                      key={msg.clientId || msg.id || idx}
                      msg={msg}
                      idx={idx}
                      prevMsg={idx > 0 ? chatMessages[idx - 1] : null}
                      nextMsg={idx < chatMessages.length - 1 ? chatMessages[idx + 1] : null}
                      currentUser={currentUser}
                      activeChat={rowChat}
                      fresh={freshMessageIds.has(msg.clientId || msg.id)}
                      isLastSelf={isLastSelf}
                      seen={msg.senderId === currentUser?.id && seenAtMs > 0 && seenAtMs >= new Date(msg.createdAt).getTime()}
                      reactions={messageReactions[msg.id] ?? msg.reactions}
                      locale={locale}
                      market={currentUser?.market ?? null}
                      t={t}
                      onCallBack={!activeChat.isGroup ? rowHandlers.callBack : undefined}
                      onReact={rowHandlers.react}
                      onRetry={rowHandlers.retry}
                      onOpenMedia={openMedia}
                    />
                  );
                })
              ) : !loadingChatMessages ? (
                <div className="m-empty-thread flex-1 flex flex-col items-center justify-center text-center p-6 gap-3 animate-fadeIn">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 ring-1 ring-pink-500/30 text-2xl">👋</span>
                  <p className="text-sm font-bold text-slate-200">{t("messenger.noMessagesYet")}</p>
                  {/* Có khách làm nail trong cuộc trò chuyện → nói về giá / lịch trống, không nói "chia turn" (chuyện giữa thợ và tiệm). */}
                  <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">{currentUser?.role === "CLIENT" || activeChat.role === "CLIENT" ? tr("Gửi lời chào, hoặc hỏi về giá và lịch còn trống.", "Say hi, or ask about prices and openings.") : t("messenger.noMessagesHint")}</p>
                  {/* Gợi ý câu mở đầu theo vai trò — bấm để điền sẵn vào ô nhập. */}
                  <div className="mt-1 flex max-w-md flex-wrap justify-center gap-2">
                    {/* đúng cặp vai trò: khách hỏi tiệm (lịch, giá) khác hẳn thợ hỏi việc — trước đây khách cũng thấy "tiệm còn tuyển thợ không" */}
                    {starters(currentUser?.role, activeChat.role, tr).map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => setMessageText(starter)}
                        className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-white/[0.08] hover:bg-white/[0.1] transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Bong bóng "đang soạn tin" của đối phương — realtime qua Pusher. */}
              {activeChatTyping && (
                <div className="flex items-end gap-2 animate-fadeIn">
                  {activeChat.isGroup && (
                    <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                      <img src={avatarSrc(activeChat.avatarUrl, activeChat.name, activeChat.id)} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="m-typing-bubble pn-bubble-them rounded-2xl rounded-bl-sm px-4 py-3 text-slate-300">
                    <TypingDots />
                    <span className="sr-only">{tr("Đối phương đang soạn tin", "The other person is typing")}</span>
                  </div>
                </div>
              )}
            </div>

            {jump.show && (
              <button
                type="button"
                onClick={jumpToLatest}
                aria-label={CS.jumpToLatest()}
                className="m-jump"
                style={{ bottom: "calc(var(--m-composer-h, 64px) + 12px)" }}
              >
                <ChevronDown className="h-[22px] w-[22px]" />
                {jump.unseen > 0 && <span>{jump.unseen > 99 ? "99+" : jump.unseen}</span>}
              </button>
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
            <div ref={composerRef} className="pn-composer relative flex-none z-10 border-t border-white/[0.06] px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4">
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
                          await handleSendMessage(null, url, "IMAGE");
                        }
                        const lines = looks.map((l, i) => `${i + 1}. ${tr(l.title.vi, l.title.en)}${clientChat ? "" : ` — ${l.priceHint}`}`);
                        await handleSendMessage(null, (clientChat
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
                        await handleSendMessage(null, text);
                        setConsult(null);
                        toast.success(tr("Đã gửi tư vấn cho khách.", "Advice sent."));
                      }}
                    />
                  </div>
                </div>
              )}
              {/* đang gõ → ẩn thanh gợi ý cho ô nhập + bàn phím đủ chỗ (bấm gợi ý xong cũng ẩn: đã dùng).
                  Chờ tin MỚI của cuộc trò chuyện nạp xong (không dùng bản lưu trên máy) — không thì thoáng hiện gợi ý theo tin cũ rồi mới đổi. */}
              {/* Bảng Emoji / Nhãn dán / GIF đang mở → ẩn hàng gợi ý (không chen giữa bảng và ô nhập, giữ chỗ cho tin nhắn) */}
              {!panelOpen && !recording && !hasText && !!activeBucket && !(activeBucket as { fromDisk?: boolean }).fromDisk && currentUser && activeChat && !activeChat.isGroup && established && !assistOpen && (
                <button type="button" onClick={() => setAssistOpen(true)} aria-expanded={false} data-assist-toggle="" className="mb-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-[var(--m-text-2)] ring-1 ring-white/[0.08]">
                  <SparklesIcon className="h-3.5 w-3.5" aria-hidden />{tr("Gợi ý", "Suggest")}
                </button>
              )}
              {!panelOpen && !recording && !hasText && !!activeBucket && !(activeBucket as { fromDisk?: boolean }).fromDisk && currentUser && activeChat && !activeChat.isGroup && (!established || assistOpen) && (
                <ChatAssist
                  me={{ id: currentUser.id, role: currentUser.role, market: currentUser.market }}
                  partner={{ id: activeChat.id, role: activeChat.role, isGroup: !!activeChat.isGroup }}
                  last={unanswered}
                  partnerWrote={partnerWrote}
                  onFill={(text) => { setMessageText(text); setToolsOpen(false); inputRef.current?.focus(); }}
                  onStudio={() => { handleCloseMediaPanel(); setStudioOpen(true); }}
                  onConsult={(image) => { handleCloseMediaPanel(); setConsult({ image }); }}
                  onPhoto={handleUploadImage}
                />
              )}
              {(showEmoji || showGifs) && currentUser?.id && (
                <MediaPicker
                  userId={currentUser.id}
                  market={stickerMarket}
                  lang={viewerLang}
                  tab={chatPanelTab}
                  gifQuery={gifHandoff}
                  onTab={(t, q) => { setChatPanelTab(t); setGifHandoff(t === "gif" ? q : undefined); setShowEmoji(true); setShowGifs(t === "gif"); }}
                  onEmoji={(e) => setMessageText((prev) => prev + e)}
                  onSticker={(id) => handleSendMessage(null, id, "STICKER", undefined, { keepPanel: true })}
                  onGif={(g) => handleSendMessage(null, g.send, "IMAGE", undefined, { keepPanel: true })}
                  onClose={handleCloseMediaPanel}
                />
              )}
              {/* Gợi ý nhãn dán theo emoji đang gõ — trong khung soạn tin (khung tin co lại, tin cuối không bị che); bảng biểu tượng
                  đang mở thì ẩn (bảng đã có tab Nhãn dán) */}
              {stripShown && stickerHint && currentUser?.id && (
                <StickerSuggest glyph={stickerHint} onPick={pickSuggestedSticker} onDismiss={() => setHintDismissed(stickerHint)} />
              )}
              {/* 1 hàng như Messenger: [😊][GIF][📎] · ô nhập bo tròn · nút gửi tròn. Trước đây nút
                  biểu tượng nằm riêng 1 hàng phía trên, tốn chỗ và nhìn rời rạc. */}
              {recording ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <VoiceRecorder
                    onCancel={() => setRecording(false)}
                    onSend={(url, secs) => { setRecording(false); handleSendMessage(null, `${url}#d=${secs}`, "AUDIO"); }}
                  />
                </div>
              ) : (
              <form onSubmit={(e) => handleSendMessage(e)} className="relative flex items-end gap-1 sm:gap-1.5">
                {/* 1 nút "+" duy nhất mở bảng đính kèm (ảnh/video, GIF, thử mẫu) — thay cho 4 nút chen chúc ở 360px */}
                <button
                  type="button"
                  ref={attachBtnRef}
                  onClick={() => { setAttachOpen((v) => !v); setShowEmoji(false); }}
                  aria-expanded={attachOpen}
                  aria-label={CS.attach(gifOn === true)}
                  title={gifOn === true ? tr("Ảnh, ghi âm, GIF", "Photo, voice, GIF") : tr("Ảnh, ghi âm", "Photo, voice")}
                  className="m-cbtn"
                >
                  <PlusIcon className={`h-6 w-6 transition-transform duration-150 motion-reduce:transition-none ${attachOpen ? "rotate-45" : ""}`} />
                </button>
                {attachOpen && (
                  <>
                    <div aria-hidden className="fixed inset-0 z-20" onClick={() => setAttachOpen(false)} />
                    <div ref={attachSheetRef} role="menu" className="m-attach-sheet">
                      <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); handleUploadImage(); }}>
                        <span><ImageIcon className="h-[22px] w-[22px]" /></span>
                        {tr("Gửi ảnh hoặc video", "Send a photo or video")}
                      </button>
                      {gifOn === true && (
                        <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); inputRef.current?.blur(); setGifHandoff(undefined); setShowEmoji(true); setChatPanelTab("gif"); setShowGifs(true); }}>
                          <span className="text-[13px] font-semibold">GIF</span>
                          {tr("Chèn ảnh động GIF", "Insert GIF")}
                        </button>
                      )}
                      {(["TECHNICIAN", "OWNER", "ADMIN"].includes(currentUser?.role) || clientChat) && !activeChat?.isGroup ? (
                        <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); handleCloseMediaPanel(); setStudioOpen(true); }}>
                          <span><SparklesIcon className="h-[22px] w-[22px]" /></span>
                          {tr("Tạo mẫu", "Try-on looks")}
                        </button>
                      ) : (
                        <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); handleCloseMediaPanel(); setRecording(true); }}>
                          <span><Mic className="h-[22px] w-[22px]" /></span>
                          {tr("Ghi âm", "Record voice")}
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div className="pn-input-wrap relative flex min-w-0 flex-1 items-end">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    defaultValue=""
                    onChange={(e) => {
                      const has = !!e.target.value.trim();
                      setHasText(has); // chỉ render lại khi ô chuyển rỗng ↔ có chữ
                      updateStickerHint(e.target.value); // … hoặc khi emoji gợi ý nhãn dán đổi
                      growInput(e.target);
                      if (has) notifyTyping();
                    }}
                    onKeyDown={(e) => {
                      // Điện thoại (chạm): Enter = xuống dòng, gửi bằng nút. Máy tính: Enter gửi, Shift+Enter xuống dòng.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) {
                        e.preventDefault();
                        if (inputRef.current?.value.trim()) handleSendMessage(null);
                      }
                    }}
                    onFocus={() => setAttachOpen(false)}
                    enterKeyHint="enter"
                    autoComplete="off"
                    // QA chọn ô nhập bằng thuộc tính này, không theo chữ gợi ý (đã đổi "Viết tin nhắn..." → "Nhắn tin").
                    data-chat-input=""
                    placeholder={t("messenger.inputPlaceholder")}
                    aria-label={t("messenger.inputPlaceholder")}
                    className="m-input"
                  />
                  <button
                    type="button"
                    data-media-toggle=""
                    aria-expanded={showEmoji}
                    onClick={() => {
                      if (showEmoji) { handleCloseMediaPanel(); return; }
                      // mở đúng tab dùng lần trước (theo người); đang gõ → ẩn bàn phím cho bảng hiện đủ
                      const saved = currentUser?.id ? readMediaTab(currentUser.id) : null;
                      // tab nhớ là GIF nhưng GIF chưa dùng được → mở Nhãn dán
                      const last = saved === "gif" && gifOn !== true ? "sticker" : saved;
                      setChatPanelTab(last ?? "emoji");
                      setGifHandoff(undefined);
                      inputRef.current?.blur();
                      setShowEmoji(true);
                      setShowGifs(last === "gif");
                      setAttachOpen(false);
                    }}
                    className={`m-cbtn m-emoji-btn ${showEmoji ? "!text-[var(--m-accent-ink)]" : ""}`}
                    title={tr("Chèn biểu tượng, nhãn dán", "Insert emoji or sticker")}
                    aria-label={tr("Biểu tượng cảm xúc", "Emoji")}
                  >
                    <Smile className="h-[22px] w-[22px]" />
                  </button>
                </div>
                {/* Ô trống → micro (ghi âm); có chữ → nút gửi (đổi qua lại bằng mờ + thu phóng 140ms) */}
                <span className="m-send" data-has={hasText ? "1" : "0"}>
                  <button
                    type="button"
                    tabIndex={hasText ? -1 : 0}
                    aria-hidden={hasText}
                    onClick={() => { handleCloseMediaPanel(); setRecording(true); }}
                    title={tr("Ghi âm tin nhắn thoại", "Record a voice message")}
                    aria-label={tr("Ghi âm", "Record voice")}
                    className="m-mic"
                  >
                    <Mic className="h-[22px] w-[22px]" />
                  </button>
                  <button
                    type="submit"
                    tabIndex={hasText ? 0 : -1}
                    aria-hidden={!hasText}
                    aria-label={tr("Gửi tin nhắn", "Send message")}
                    disabled={!hasText}
                    onPointerDown={(e) => e.preventDefault() /* giữ bàn phím mở khi bấm Gửi */}
                    className="m-send-on"
                  >
                    <SendHorizontal className="h-5 w-5" />
                  </button>
                </span>
              </form>
              )}
            </div>
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
                  onClick={() => window.location.assign(`${window.location.origin}/messages`)}
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
