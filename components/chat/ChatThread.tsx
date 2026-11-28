"use client";

// Khung tin nhắn của Messenger (tách khỏi MessagesContent): các dòng tin (MessageRow), giữ vị trí cuộn (dính đáy, bù chỗ
// khi chèn trang tin cũ, về đáy khi đổi cuộc trò chuyện), thẻ đầu cuộc trò chuyện / an toàn / ngữ cảnh, "đang soạn".
// React.memo: chỉ vẽ lại khi tin / trạng thái của CHÍNH khung tin đổi — gõ phím, mở bảng biểu tượng, menu ⋮… không đụng
// tới. Các thứ đổi theo cuộn (nút xuống tin mới nhất, viên ngày nổi, "đang tải lịch sử") là component con nhỏ đọc tín
// hiệu riêng → cuộn không vẽ lại cả trăm dòng tin.
import React, { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, ShieldCheck, X as XIcon } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { CS } from "@/lib/i18n/chatStrings";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { isGifUrl } from "@/lib/chat/gif";
import { starters } from "@/lib/chatAssist";
import { type Reaction } from "@/lib/chatReactions";
import { TypingDots, ROLE_VI, type ActiveChatType, type MessageType, mapServerMessage } from "./chatShared";
import ChatContextCard from "./ChatContextCard";
import MessageRow from "./MessageRow";

/** "smooth" trừ khi người dùng bật giảm chuyển động */
const scrollBehavior = (): ScrollBehavior => (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const SAFETY_KEY = "pn_safety_dismissed";
/** Số dòng tin vẽ ngay khi mở 1 cuộc trò chuyện (phần còn lại dựng sau) — hơn 1 màn hình cao nhất */
const TAIL = 30;
/** Số dòng tin cũ dựng thêm mỗi lượt nền (mở chat dài / trang tin cũ vừa tải) */
const STEP = 10;

export type PartnerTrust = { city?: string | null; state?: string | null; createdAt?: string; phoneVerified?: boolean };

/** Trạng thái cuộn sống lâu hơn khung tin (đóng rồi mở lại cuộc trò chuyện trên điện thoại gỡ khung này) — cha giữ. */
export type ThreadMemory = { prevChatKey: string | null; prevCount: number; animated: Set<string> };

// Tín hiệu nhỏ (giá trị + người nghe): khung tin đặt giá trị, chỉ component con đọc nó vẽ lại.
type Signal<T> = { get: () => T; set: (v: T | ((p: T) => T)) => void; subscribe: (l: () => void) => () => void };
function createSignal<T>(init: T): Signal<T> {
  let v = init;
  const ls = new Set<() => void>();
  return {
    get: () => v,
    set: (n) => {
      const nv = typeof n === "function" ? (n as (p: T) => T)(v) : n;
      if (Object.is(nv, v)) return;
      v = nv;
      ls.forEach((l) => l());
    },
    subscribe: (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
  };
}
// useState + đăng ký (không dùng useSyncExternalStore: nó luôn vẽ lại ĐỒNG BỘ ngay trong trình xử lý cuộn / IntersectionObserver
// → kéo dài đúng khung hình đang cuộn; setState ở đây được React xếp lịch như bình thường).
function useSignal<T>(s: Signal<T>): T {
  const [v, setV] = useState(s.get);
  useEffect(() => {
    setV(s.get());
    return s.subscribe(() => setV(s.get()));
  }, [s]);
  return v;
}

type Jump = { show: boolean; unseen: number };
const NO_JUMP: Jump = { show: false, unseen: 0 };

function JumpButton({ signal, onClick }: { signal: Signal<Jump>; onClick: () => void }) {
  const jump = useSignal(signal);
  if (!jump.show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={CS.jumpToLatest()}
      className="m-jump"
      style={{ bottom: "calc(var(--m-composer-h, 64px) + 12px)" }}
    >
      <ChevronDown className="h-[22px] w-[22px]" />
      {jump.unseen > 0 && <span>{jump.unseen > 99 ? "99+" : jump.unseen}</span>}
    </button>
  );
}

function LoadingMorePill({ signal, label }: { signal: Signal<boolean>; label: string }) {
  if (!useSignal(signal)) return null;
  // Nhãn nổi (cao 0, dính đỉnh) — KHÔNG chiếm chỗ, nên hiện/ẩn không đẩy chỗ đang đọc lên xuống.
  return (
    <div className="sticky top-0 z-10 !my-0 flex h-0 flex-none justify-center overflow-visible">
      <div className="mt-1 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-4xs font-bold text-slate-400 shadow-lg ring-1 ring-white/10 animate-fadeIn">
        <Loader2 className="h-3 w-3 animate-spin text-pink-500" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function LiveRegion({ signal }: { signal: Signal<string> }) {
  return <p className="sr-only" aria-live="polite" aria-atomic="true">{useSignal(signal)}</p>;
}

// Viên ngày nổi: ngày của đoạn đang đọc ở đỉnh khung (viên trong dòng tin đã cuộn qua); mờ đi sau 1,2 giây đứng yên.
function FloatDate({ scrollRef, chatId }: { scrollRef: React.RefObject<HTMLDivElement | null>; chatId: string }) {
  const [floatDate, setFloatDate] = useState<{ label: string; idle: boolean } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
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
  }, [chatId, scrollRef]);
  if (!floatDate) return null;
  return (
    <div aria-hidden className="m-float-date" data-idle={floatDate.idle ? "1" : "0"}>
      <span className="pn-date-pill">{floatDate.label}</span>
    </div>
  );
}

type RowHandlers = {
  callBack: (kind: "audio" | "video") => void;
  react: (id: string, icon: string, current?: Reaction[]) => void;
  retry: (m: MessageType) => void;
};

type Props = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  nearBottomRef: React.RefObject<boolean>;
  /** Ô chứa nút "xuống tin mới nhất" — khung soạn tin đặt biến --m-composer-h lên đây */
  jumpSlotRef: React.RefObject<HTMLDivElement | null>;
  memory: React.RefObject<ThreadMemory>;
  /** cuộc trò chuyện đang mở LÚC NÀY (trang tin cũ về muộn sau khi đã đổi chat → không chỉnh vị trí cuộn) */
  activeChatRef: React.RefObject<ActiveChatType | null>;
  chat: ActiveChatType;
  chatKey: string | null;
  messages: MessageType[];
  nextCursor: string | null;
  loading: boolean;
  currentUser: any;
  locale: string;
  t: (key: string) => string;
  seenAtMs: number;
  reactions: { [msgId: string]: Reaction[] };
  partnerTrust: PartnerTrust | null;
  /** ngày tạo cuộc trò chuyện (thẻ "Nhắn tin an toàn" chỉ hiện ở cuộc trò chuyện mới) */
  convCreatedAt: string | null;
  typing: boolean;
  rowHandlers: RowHandlers;
  onOpenMedia: (url: string) => void;
  onPrepend: (key: string, msgs: MessageType[], nextCursor: string | null) => void;
  onReport: () => void;
  onStudio: () => void;
  onSendText: (text: string) => void;
  onStarter: (text: string) => void;
};

function ChatThread({
  scrollRef, nearBottomRef, jumpSlotRef, memory, activeChatRef, chat, chatKey, messages: chatMessages, nextCursor: chatNextCursor, loading,
  currentUser, locale, t, seenAtMs, reactions, partnerTrust, convCreatedAt, typing, rowHandlers, onOpenMedia, onPrepend,
  onReport, onStudio, onSendText, onStarter,
}: Props) {
  useTr(); // render lại khi đổi VI/EN
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const [signals] = useState(() => ({ jump: createSignal<Jump>(NO_JUMP), loadingMore: createSignal(false), live: createSignal("") }));
  const jumpShownRef = useRef(false);
  const setJump = signals.jump.set;

  // Khung tin mờ chỉ hiện nếu sau 250ms vẫn chưa có gì — mở chat đã có sẵn
  // tin (cache / tải trước) thì không bao giờ thấy trạng thái "đang tải".
  const [showChatSkeleton, setShowChatSkeleton] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowChatSkeleton(false);
      return;
    }
    const tm = setTimeout(() => setShowChatSkeleton(true), 250);
    return () => clearTimeout(tm);
  }, [loading]);

  // ----- Mở cuộc trò chuyện dài: vẽ TRƯỚC đoạn cuối (TAIL dòng — hơn 1 màn hình điện thoại); các dòng cũ hơn (chưa thấy được)
  // dựng sau, mỗi lượt STEP dòng bằng việc nền, chèn lên trên và giữ nguyên chỗ đang xem. Trước đây mở lại 1 cuộc trò chuyện
  // 60–150 tin là dựng hết mọi dòng trong 1 lượt (~5 ms / dòng ở CPU chậm 4x → chạm vào hội thoại ~1 giây mới thấy).
  // Còn phần chưa dựng thì các thẻ đầu cuộc trò chuyện và việc tải trang tin cũ chờ (chúng nằm ở ĐỈNH). Dựng xong (first =
  // null) thì như cũ: trang tin cũ tải khi cuộn lên chèn 1 lượt (chia nhỏ ra nhiều lượt làm nhiều khung hình khựng hơn).
  const [win, setWin] = useState<{ key: string | null; first: string | null }>({ key: null, first: null });
  let start = 0;
  if (win.key !== chatKey) start = Math.max(0, chatMessages.length - TAIL);
  else if (win.first) start = Math.max(0, chatMessages.findIndex((m) => (m.clientId || m.id) === win.first));
  const limited = start > 0;
  const rendered = limited ? chatMessages.slice(start) : chatMessages;
  const renderOffset = start;
  const growAnchor = useRef<{ node: HTMLElement; top: number } | null>(null);
  useEffect(() => {
    if (!limited) return;
    const node = scrollRef.current?.querySelector<HTMLElement>(":scope > .m-row") ?? null;
    growAnchor.current = node ? { node, top: node.offsetTop } : null;
    const next = start - STEP > 0 ? chatMessages[start - STEP] : null;
    startTransition(() => setWin({ key: chatKey, first: next ? next.clientId || next.id : null }));
  }, [start, chatKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const a = growAnchor.current;
    growAnchor.current = null;
    const el = scrollRef.current;
    if (!a || !el) return;
    // đang ở đáy (vừa mở) → vẫn ở đáy; đã kéo lên → giữ dòng đang xem đứng yên (khung tắt overflow-anchor)
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
    else if (a.node.isConnected) el.scrollTop += a.node.offsetTop - a.top;
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatObserverTarget = useRef<HTMLDivElement>(null);
  // Bù vị trí cuộn khi chèn tin cũ lên trên: chụp chiều cao NGAY TRƯỚC khi chèn
  // + id tin đầu tiên, chỉ bù ở đúng lần render có tin cũ mới vào.
  const pendingScrollAdjustRef = useRef<{ prevScrollHeight: number; firstId: string | undefined } | null>(null);

  // -------------------------------------------------------------------------
  // Smooth infinite scroll (Telegram-style "load ahead" on scroll-to-top),
  // preserving scroll position — the container never jumps.
  // -------------------------------------------------------------------------
  const loadingMoreRef = useRef(false);
  const loadMoreChatMessages = useCallback(async () => {
    if (!chat.conversationId || !chatNextCursor || loadingMoreRef.current) return;
    const key = chat.conversationId;
    try {
      loadingMoreRef.current = true;
      signals.loadingMore.set(true);

      const res = await fetch(`/api/messages?conversationId=${key}&cursor=${chatNextCursor}`);
      if (res.ok) {
        const data = await res.json();
        const safeMsgs = (data.messages || []).map(mapServerMessage);
        const container = scrollRef.current;
        // chỉ khi vẫn đang mở đúng cuộc trò chuyện này (đổi chat giữa chừng → không để lại "đang chỉnh vị trí" cho chat mới)
        if (container && safeMsgs.length && activeChatRef.current?.conversationId === key) {
          pendingScrollAdjustRef.current = { prevScrollHeight: container.scrollHeight, firstId: chatMessagesRef.current[0]?.id };
        }
        // Việc nền: React chia nhỏ việc dựng vài chục bong bóng → cuộn không khựng.
        startTransition(() => onPrepend(key, safeMsgs, data.nextCursor || null));
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
      signals.loadingMore.set(false);
    }
  }, [chat.conversationId, chatNextCursor, onPrepend, scrollRef, activeChatRef, signals]);

  useEffect(() => {
    const el = chatObserverTarget.current;
    if (!el || !chatNextCursor || limited) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreChatMessages(); },
      // Tải trước khi người dùng còn cách đỉnh ~800px (kiểu Telegram) → cuộn lên
      // không phải đứng chờ "đang tải lịch sử".
      { root: scrollRef.current, rootMargin: "800px 0px 0px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [chatNextCursor, loadMoreChatMessages, scrollRef, limited]);

  // Track whether the user is scrolled near the bottom, to decide whether a
  // newly arrived message should auto-scroll or leave them where they are.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      nearBottomRef.current = dist < 150;
      // Nút "xuống tin mới nhất": chỉ đổi khi vượt ngưỡng (hiện > 400px, ẩn < 120px)
      if (!jumpShownRef.current && dist > 400) { jumpShownRef.current = true; setJump((j) => ({ ...j, show: true })); }
      else if (jumpShownRef.current && dist < 120) { jumpShownRef.current = false; setJump(NO_JUMP); }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Đang ở cuối đoạn chat mà ảnh / GIF / sticker / video tải xong (làm nội dung cao thêm) → giữ dính
    // đáy như Messenger. Trước đây mở cuộc trò chuyện có ảnh thì dừng lửng lơ cách đáy vài trăm px,
    // tin mới nhất bị khuất. Đang kéo lên đọc tin cũ thì không kéo xuống.
    const keepPinned = (e: Event) => {
      const tg = e.target as HTMLElement | null;
      if (!tg || !/^(IMG|VIDEO)$/.test(tg.tagName) || !nearBottomRef.current) return;
      // GIF có khung cố định theo #wh (không đổi chiều cao khi tải) và trình phát MP4 dựng / gỡ theo vị trí cuộn → không kéo xuống
      if (tg.closest(".m-gif")) return;
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
    // Gắn lại mỗi lần mở / đổi cuộc trò chuyện.
  }, [chatKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single scroll-management effect covering all three cases: restoring
  // position after prepending history, jumping to bottom on chat switch, and
  // smooth-scrolling down for a genuinely new message (own message, or the
  // user was already near the bottom).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mem = memory.current;

    // Đổi cuộc trò chuyện xét TRƯỚC: việc chỉnh vị trí của trang tin cũ (nếu còn treo) thuộc chat trước, bỏ đi — trước đây nó
    // chạy trên chat mới (tin đầu khác) → cộng nhầm scrollTop và bỏ qua bước về đáy.
    if (mem.prevChatKey !== chatKey) {
      mem.prevChatKey = chatKey;
      mem.prevCount = chatMessages.length;
      pendingScrollAdjustRef.current = null;
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true; // vừa mở cuộc trò chuyện = đang ở đáy (ảnh tải sau vẫn giữ dính đáy)
      return;
    }

    if (pendingScrollAdjustRef.current && chatMessages[0]?.id !== pendingScrollAdjustRef.current.firstId) {
      const { prevScrollHeight } = pendingScrollAdjustRef.current;
      // Giữ nguyên chỗ đang đọc (kể cả khi người dùng vẫn đang cuộn).
      el.scrollTop = el.scrollTop + (el.scrollHeight - prevScrollHeight);
      pendingScrollAdjustRef.current = null;
      mem.prevCount = chatMessages.length;
      return;
    }

    const prevCount = mem.prevCount;
    mem.prevCount = chatMessages.length;
    if (chatMessages.length <= prevCount) return;

    const lastMsg = chatMessages[chatMessages.length - 1];
    const isOwn = lastMsg?.senderId === currentUser?.id;
    if (isOwn || nearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    } else if (!isOwn) {
      setJump((j) => ({ show: true, unseen: j.unseen + (chatMessages.length - prevCount) }));
      jumpShownRef.current = true;
    }
  }, [chatMessages, chatKey, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight * 3) el.scrollTop = el.scrollHeight - el.clientHeight - 600;
    el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    jumpShownRef.current = false;
    setJump(NO_JUMP);
  }, [scrollRef, setJump]);
  useEffect(() => { jumpShownRef.current = false; setJump(NO_JUMP); }, [chatKey, setJump]);

  // Which message ids are appearing in the DOM for the first time this
  // session — only these get the entrance animation, so revisiting an
  // already-seen chat doesn't replay it for the whole history.
  const freshMessageIds = useMemo(() => {
    const fresh = new Set<string>();
    const animated = memory.current.animated;
    chatMessages.forEach((m) => {
      const k = m.clientId || m.id;
      if (!animated.has(k)) {
        fresh.add(k);
        animated.add(k);
      }
      animated.add(m.id);
    });
    return fresh;
  }, [chatMessages, memory]);

  // Vị trí tin cuối cùng của mình trong đoạn chat (gắn Đã gửi/Đã xem).
  const lastSelfIndex = useMemo(
    () => chatMessages.reduce((acc, m, i) => (m.senderId === currentUser?.id ? i : acc), -1),
    [chatMessages, currentUser?.id]
  );
  // Vùng đọc màn hình: chỉ đọc tin VỪA đến (≤ 60 giây) — không đọc tin cũ khi mở cuộc trò chuyện / tải thêm trang cũ
  const lastIncoming = chatMessages.length ? chatMessages[chatMessages.length - 1] : null;
  const lastIncomingKey = lastIncoming && lastIncoming.senderId !== currentUser?.id ? lastIncoming.clientId || lastIncoming.id : null;
  useEffect(() => {
    if (!lastIncomingKey || !lastIncoming || !freshMessageIds.has(lastIncomingKey) || Date.now() - new Date(lastIncoming.createdAt).getTime() > 60_000) return;
    const who = chat.isGroup ? lastIncoming.sender?.name ?? "" : chat.name ?? "";
    const body = lastIncoming.type === "TEXT" || !lastIncoming.type ? String(lastIncoming.content || "").slice(0, 200) : lastIncoming.type === "IMAGE" ? (isGifUrl(lastIncoming.content) ? "GIF" : "📷") : lastIncoming.type === "AUDIO" ? "🎤" : "";
    signals.live.set(`${who}: ${body}`);
  }, [lastIncomingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Props ỔN ĐỊNH cho MessageRow (React.memo): đối tượng giữ nguyên danh tính giữa các lần render.
  const rowChat = useMemo(
    () => ({ isGroup: !!chat.isGroup, avatarUrl: chat.avatarUrl, name: chat.name ?? "" }),
    [chat.isGroup, chat.avatarUrl, chat.name]
  );

  // ----- V2: thẻ "Nhắn tin an toàn" lần đầu liên hệ
  const [safetyHidden, setSafetyHidden] = useState<Record<string, true>>(() => {
    try { return JSON.parse(localStorage.getItem(SAFETY_KEY) || "{}"); } catch { return {}; }
  });
  const iSentAny = chatMessages.some((m) => m.senderId === currentUser?.id);
  const convYoung = !convCreatedAt || Date.now() - new Date(convCreatedAt).getTime() < 7 * 86_400_000;
  const showSafety =
    !chat.isGroup && chat.role !== "ADMIN" && !isVerifiedRole(chat.role) &&
    (convYoung || !iSentAny) && !safetyHidden[chatKey || ""];
  // Thẻ đầu cuộc trò chuyện cao thêm khi thông tin tin cậy / thẻ an toàn tải xong → vẫn giữ dính đáy nếu đang ở đáy
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [partnerTrust, showSafety]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismissSafety = () => {
    const k = chatKey || "";
    setSafetyHidden((prev) => {
      const next = { ...prev, [k]: true as const };
      try { localStorage.setItem(SAFETY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <>
      <LiveRegion signal={signals.live} />
      <div ref={scrollRef} className="m-scroll flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] px-3 py-4 sm:px-6 custom-scrollbar flex flex-col min-w-0 relative">
        <FloatDate scrollRef={scrollRef} chatId={chat.id} />
        <div ref={chatObserverTarget} className="h-2 w-full flex-none" />

        <LoadingMorePill signal={signals.loadingMore} label={t("messenger.loadingHistory")} />

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
        {!chat.isGroup && !chatNextCursor && !limited && chatMessages.length > 0 && (
          <div className="m-intro flex flex-none flex-col items-center gap-2 pb-4 pt-6 text-center">
            <span className="m-intro-avatar isolate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc(chat.avatarUrl, chat.name, chat.id)} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white/5" />
            </span>
            <p className="flex items-center gap-1 text-base font-black text-white">
              {chat.name}
              {isVerifiedRole(chat.role) && <VerifiedBadge className="h-4 w-4" />}
            </p>
            <p className="text-xs text-slate-400">{ROLE_VI()[chat.role] || tr("Thành viên PawNail", "PawNail member")}</p>
            {(partnerTrust?.city || partnerTrust?.state) && <p className="text-[13px] text-[var(--m-text-2)]">{[partnerTrust.city, partnerTrust.state].filter(Boolean).join(", ")}</p>}
            {partnerTrust?.createdAt && (
              <p className="text-[12px] text-[var(--m-text-3)]">
                {CS.joined(new Date(partnerTrust.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : currentUser?.market === "AU" ? "en-AU" : "en-US", { month: "short", year: "numeric" }))}
              </p>
            )}
            <Link href={`/profile/${chat.id}`} data-bubble-chrome className="mt-1 rounded-full bg-white/[0.07] px-4 py-1.5 text-xs font-bold text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] sm:hidden">
              {tr("Xem hồ sơ", "View profile")}
            </Link>
          </div>
        )}

        {showSafety && !chatNextCursor && !limited && (
          // Bong bóng chat (khung nhỏ nổi trên app khác): không thẻ an toàn to — đã hiện trong app khi mới liên hệ.
          <div className="m-safety flex-none" role="note" data-bubble-chrome>
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--m-champagne)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[var(--m-text)]">{CS.safetyTitle()}</p>
              <p className="mt-0.5">{CS.safetyBody()}</p>
              <button type="button" onClick={onReport} className="mt-1.5 min-h-8 text-[14px] font-semibold text-[var(--m-accent-ink)]">{CS.report()}</button>
            </div>
            <button type="button" onClick={dismissSafety} aria-label={CS.dismiss()} className="-mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--m-text-3)]">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {!chat.isGroup && !chatNextCursor && !limited && currentUser?.id && (
          <ChatContextCard
            meRole={currentUser.role}
            meId={currentUser.id}
            partner={{ id: chat.id, name: chat.name, role: chat.role, isGroup: chat.isGroup }}
            onStudio={onStudio}
            onSendText={onSendText}
            compact={chatMessages.length > 0}
          />
        )}

        {chatMessages.length > 0 ? (
          rendered.map((msg, i) => {
            const idx = renderOffset + i; // vị trí trong CẢ cuộc trò chuyện (dòng đầu của đoạn cuối vẫn biết tin trước nó)
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
              isLastSelf={idx === lastSelfIndex}
              seen={msg.senderId === currentUser?.id && seenAtMs > 0 && seenAtMs >= new Date(msg.createdAt).getTime()}
              reactions={reactions[msg.id] ?? msg.reactions}
              locale={locale}
              market={currentUser?.market ?? null}
              t={t}
              onCallBack={!chat.isGroup ? rowHandlers.callBack : undefined}
              onReact={rowHandlers.react}
              onRetry={rowHandlers.retry}
              onOpenMedia={onOpenMedia}
            />
            );
          })
        ) : !loading ? (
          <div className="m-empty-thread flex-1 flex flex-col items-center justify-center text-center p-6 gap-3 animate-fadeIn">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 ring-1 ring-pink-500/30 text-2xl">👋</span>
            <p className="text-sm font-bold text-slate-200">{t("messenger.noMessagesYet")}</p>
            {/* Có khách làm nail trong cuộc trò chuyện → nói về giá / lịch trống, không nói "chia turn" (chuyện giữa thợ và tiệm). */}
            <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">{currentUser?.role === "CLIENT" || chat.role === "CLIENT" ? tr("Gửi lời chào, hoặc hỏi về giá và lịch còn trống.", "Say hi, or ask about prices and openings.") : t("messenger.noMessagesHint")}</p>
            {/* Gợi ý câu mở đầu theo vai trò — bấm để điền sẵn vào ô nhập. */}
            <div className="mt-1 flex max-w-md flex-wrap justify-center gap-2">
              {/* đúng cặp vai trò: khách hỏi tiệm (lịch, giá) khác hẳn thợ hỏi việc — trước đây khách cũng thấy "tiệm còn tuyển thợ không" */}
              {starters(currentUser?.role, chat.role, tr).map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => onStarter(starter)}
                  className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-white/[0.08] hover:bg-white/[0.1] transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Bong bóng "đang soạn tin" của đối phương — realtime qua Pusher. */}
        {typing && (
          <div className="flex items-end gap-2 animate-fadeIn">
            {chat.isGroup && (
              <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                <img src={avatarSrc(chat.avatarUrl, chat.name, chat.id)} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="m-typing-bubble pn-bubble-them rounded-2xl rounded-bl-sm px-4 py-3 text-slate-300">
              <TypingDots />
              <span className="sr-only">{tr("Đối phương đang soạn tin", "The other person is typing")}</span>
            </div>
          </div>
        )}
      </div>

      {/* display: contents — không tạo hộp (nút vẫn định vị theo khung chat), chỉ giữ biến --m-composer-h do khung soạn tin
          đặt (chiều cao khung soạn tin → nút nằm ngay trên nó) mà không làm cả khung tin tính lại style. */}
      <div ref={jumpSlotRef} className="contents">
        <JumpButton signal={signals.jump} onClick={jumpToLatest} />
      </div>
    </>
  );
}

export default memo(ChatThread);
