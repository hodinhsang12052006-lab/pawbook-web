"use client";

import React from "react";
import { AlertCircle, Check, CheckCheck, Clock, Phone, PhoneMissed, Video, RefreshCw, SmilePlus, Copy, ImageOff, Play } from "lucide-react";
import VoiceMessage from "./VoiceMessage";
import toast from "react-hot-toast";
import { REACTION_EMOJIS, summarize, type Reaction } from "@/lib/chatReactions";
import { stickerStill, stickerUrl } from "@/lib/chatStickers";
import { avatarSrc } from "@/lib/avatar";
import { tr } from "@/lib/i18n/tr";
import { CS } from "@/lib/i18n/chatStrings";
import { bubbleTime, dayLabel, sameChatGroup } from "@/lib/chat/chatTime";
import { linkify } from "@/lib/chat/linkify";
import { describeCall, type MessageType } from "./chatShared";
import { detectTextLang } from "@/lib/i18n/detectLang";
import type { Locale } from "@/lib/i18n/config";
import { autoTranslates, canTranslate, requestTranslation, useMessageTranslation } from "./messageTranslation";

// Một bong bóng tin nhắn — React.memo: khi gõ phím, có tin mới, đang tải thêm
// lịch sử hay đối phương "đang soạn", CHỈ những tin thật sự đổi mới render lại
// (trước đây cả trăm bong bóng render lại mỗi lần → khựng trên điện thoại).
// Mọi callback truyền vào phải ổn định (xem rowHandlers trong MessagesContent).
//
// V2 (06/11/2026): giờ + trạng thái (đang gửi / đã gửi / đã xem) nằm TRONG bong bóng, đuôi bong bóng chỉ ở tin
// cuối cụm, cụm 5 phút (2px trong cụm, 10px giữa các cụm), không avatar trong chat 1-1, viên ngày dính đỉnh.
// Thiết kế gốc của PawNail (đuôi bong bóng vẽ bằng 1 đường SVG riêng) — không sao chép tài sản của ứng dụng khác.
export interface MessageRowProps {
  msg: MessageType;
  idx: number;
  prevMsg: MessageType | null;
  nextMsg: MessageType | null;
  currentUser: { id: string; name: string; avatarUrl?: string | null; market?: string | null };
  activeChat: { isGroup: boolean; avatarUrl?: string | null; name: string };
  fresh: boolean;
  isLastSelf: boolean;
  /** Đối phương đã xem tới tin này (mốc đã đọc ≥ giờ gửi) — boolean để memo giữ được */
  seen?: boolean;
  /** @deprecated dùng `seen` */
  seenAt?: string;
  reactions?: Reaction[];
  locale: string;
  /** Thị trường của người xem (định dạng giờ en-US "3:16 AM" / en-AU "3:16 am"). Mặc định: currentUser.market */
  market?: string | null;
  t: (key: string) => string;
  onCallBack?: (kind: "audio" | "video") => void;
  onReact: (messageId: string, icon: string, current?: Reaction[]) => void;
  onRetry: (msg: MessageType) => void;
  onOpenMedia?: (url: string) => void;
}

// "#wh=640x800" gắn lúc gửi ảnh → giữ đúng khung trước khi ảnh tải (không nhảy bố cục). Không có → 4:5.
function mediaAspect(url: string): number {
  const m = /#(?:.*&)?wh=(\d{2,5})x(\d{2,5})/.exec(url);
  if (!m) return 4 / 5;
  const r = Number(m[1]) / Number(m[2]);
  return Math.min(16 / 9, Math.max(9 / 16, r));
}

function MessageRowImpl({
  msg,
  idx,
  prevMsg,
  nextMsg,
  currentUser,
  activeChat,
  fresh,
  seen,
  reactions,
  locale,
  market: marketProp,
  t,
  onCallBack,
  onReact,
  onRetry,
  onOpenMedia,
}: MessageRowProps) {
  // Thả cảm xúc kiểu Messenger: máy tính rê vào tin → nút 🙂 cạnh bong bóng; điện thoại nhấn giữ tin.
  // Thanh cảm xúc chỉ dựng khi mở (không dựng sẵn cho hàng trăm tin).
  const [picker, setPicker] = React.useState(false);
  const [mediaBroken, setMediaBroken] = React.useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);
  const pressStart = React.useRef<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    if (!picker) return;
    const close = (e: PointerEvent) => { if (!rowRef.current?.contains(e.target as Node)) setPicker(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [picker]);
  const isSelf = msg.senderId === currentUser?.id;
  const market = marketProp ?? currentUser?.market;
  const viewer: Locale = locale === "vi" ? "vi" : "en";
  // Dịch tin của người kia: người xem tiếng Anh nhận tin tiếng Việt → tự dịch (nút "Show original");
  // người xem tiếng Việt nhận tin tiếng Anh → nút "Xem bản dịch".
  const isText = (msg.type === "TEXT" || !msg.type) && !msg.isOptimistic;
  const translatable = isText && !isSelf && canTranslate(msg.content, viewer);
  const autoTx = translatable && autoTranslates(msg.content, viewer);
  const [showOriginal, setShowOriginal] = React.useState(false);
  const tx = useMessageTranslation(msg.id, msg.content, viewer, { enabled: translatable, auto: autoTx });
  const group = activeChat.isGroup;
  const animClass = fresh ? (isSelf ? "pn-in-me" : "pn-in-them") : "";

  const msgDay = new Date(msg.createdAt).toDateString();
  const showDateSeparator = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== msgDay;
  const groupedWithPrev = !showDateSeparator && sameChatGroup(prevMsg, msg);
  const isLastInGroup = !sameChatGroup(msg, nextMsg) || (!!nextMsg && new Date(nextMsg.createdAt).toDateString() !== msgDay);
  const canReact = !msg.isOptimistic && !msg.sendError && !String(msg.id).startsWith("temp");
  const sum = summarize(reactions, currentUser?.id ?? "");
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null; pressStart.current = null; };
  const pressHandlers = canReact
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === "mouse") return;
          longPressed.current = false;
          pressStart.current = { x: e.clientX, y: e.clientY };
          pressTimer.current = setTimeout(() => { longPressed.current = true; setPicker(true); navigator.vibrate?.(8); }, 380);
        },
        onPointerUp: clearPress,
        onPointerMove: (e: React.PointerEvent) => {
          const s = pressStart.current;
          if (s && Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 6) clearPress();
        },
        onPointerCancel: clearPress,
        onContextMenu: (e: React.MouseEvent) => { if (longPressed.current || pressTimer.current) e.preventDefault(); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.shiftKey && e.key === "F10") { e.preventDefault(); setPicker(true); } },
      }
    : {};
  const react = (e: string) => { onReact(msg.id, e, reactions); setPicker(false); };
  const copy = () => {
    navigator.clipboard?.writeText(msg.content).then(() => toast.success(tr("Đã sao chép", "Copied")), () => {});
    setPicker(false);
  };
  const reactBtn = canReact ? (
    <button
      type="button"
      onClick={() => setPicker((v) => !v)}
      aria-label={tr("Thả cảm xúc", "React")}
      className="hidden h-8 w-8 flex-shrink-0 items-center justify-center self-center rounded-full text-slate-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-slate-200 focus-visible:opacity-100 group-hover:opacity-100 md:flex"
    >
      <SmilePlus className="h-[18px] w-[18px]" />
    </button>
  ) : null;
  // Tin chỉ có 1–3 emoji → hiện TO, không bong bóng (như Messenger/iMessage).
  const emojiCount = [...(msg.content || "").matchAll(/\p{Extended_Pictographic}/gu)].length;
  const emojiOnly =
    (msg.type === "TEXT" || !msg.type) &&
    /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍|\s)+$/u.test(msg.content || "") &&
    emojiCount <= 3;
  const time = bubbleTime(msg.createdAt, market);
  const status: "pending" | "failed" | "seen" | "sent" | null = !isSelf
    ? null
    : msg.sendError
    ? "failed"
    : msg.isOptimistic
    ? "pending"
    : seen && !group
    ? "seen"
    : "sent";
  const statusLabel = status === "pending" ? CS.sending() : status === "failed" ? CS.notSent() : status === "seen" ? CS.seen() : status === "sent" ? CS.sent() : "";
  const srLabel = `${isSelf ? CS.you() : msg.sender?.name || activeChat.name}, ${time}${statusLabel ? `, ${statusLabel}` : ""}`;
  const tick =
    status === "pending" ? <Clock aria-hidden className="m-pending h-3 w-3" /> : status === "seen" ? <CheckCheck aria-hidden className="m-seen h-3.5 w-3.5" /> : status === "sent" ? <Check aria-hidden className="h-3.5 w-3.5" /> : null;
  const meta = (
    <span className="m-meta" aria-hidden>
      {time}
      {tick}
    </span>
  );

  const dateSeparator = showDateSeparator ? (
    <div key={`sep-${msg.id || idx}`} className="m-sep">
      <span className="pn-date-pill">{dayLabel(msg.createdAt, t("messenger.today"), t("messenger.yesterday"), market)}</span>
    </div>
  ) : !!prevMsg && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 30 * 60_000 ? (
    // Cùng ngày nhưng cách tin trước > 30 phút → nhãn giờ nhỏ ở giữa (không dính).
    <div key={`gap-${msg.id || idx}`} className="m-gap">{time}</div>
  ) : null;

  if (msg.type === "CALL") {
    // Nhật ký cuộc gọi: bong bóng gọn nằm ĐÚNG phía người gọi.
    const call = describeCall(msg.content);
    return (
      <React.Fragment key={msg.id || idx}>
        {dateSeparator}
        <div className={`m-row flex w-full ${isSelf ? "justify-end" : "justify-start"} ${group && !isSelf ? "pl-9" : ""} ${animClass}`}>
          <div className="m-call w-[240px] max-w-[80%] overflow-hidden rounded-[18px]">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${call.missed ? "bg-rose-500/15 text-rose-300" : "bg-white/10 text-slate-200"}`}>
                {call.kind === "video" ? <Video className="h-[18px] w-[18px]" /> : call.missed ? <PhoneMissed className="h-[18px] w-[18px]" /> : <Phone className="h-[18px] w-[18px]" />}
              </span>
              <div className="min-w-0 text-left">
                <p className={`truncate text-[15px] font-semibold ${call.missed ? "text-rose-300" : "text-slate-100"}`}>{call.text}</p>
                <p className="text-[12px] text-[var(--m-in-meta)] tabular-nums">{time}</p>
              </div>
            </div>
            {onCallBack && (
              <button
                type="button"
                onClick={() => onCallBack(call.kind as "audio" | "video")}
                className="flex h-11 w-full items-center justify-center border-t border-white/5 text-center text-[14px] font-semibold text-[var(--m-accent-ink)] transition-colors hover:bg-white/5"
              >
                {tr("Gọi lại", "Call back")}
              </button>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }

  if (msg.type === "SYSTEM" || msg.type === "ATTENDANCE") {
    // Tin hệ thống (và bản ghi chấm công cũ): đúng nội dung đã lưu, không chữ cố định, không biểu tượng robot.
    return (
      <React.Fragment key={msg.id || idx}>
        {dateSeparator}
        <div className={`m-row m-system ${animClass}`}>
          <span>{msg.content}</span>
        </div>
      </React.Fragment>
    );
  }

  const isMedia = msg.type === "IMAGE" || msg.type === "VIDEO";
  const bare = emojiOnly || msg.type === "STICKER";
  const tail = isLastInGroup && !bare && !isMedia && msg.type !== "AUDIO";
  // Góc bo theo vị trí trong cụm (phía người gửi): đầu cụm 18/6, giữa 6/6, cuối 6/4 + đuôi, lẻ 18/4 + đuôi.
  const corner = isSelf
    ? `${groupedWithPrev ? "m-tr-tight" : ""} ${isLastInGroup ? "m-br-tail" : "m-br-tight"}`
    : `${groupedWithPrev ? "m-tl-tight" : ""} ${isLastInGroup ? "m-bl-tail" : "m-bl-tight"}`;
  const showGroupAvatar = group && !isSelf;
  const senderAvatar = showGroupAvatar && isLastInGroup ? avatarSrc(msg.sender?.avatarUrl, msg.sender?.name || "U", msg.senderId) : null;

  let body: React.ReactNode;
  if (emojiOnly) {
    body = (
      <div className="m-bare">
        <div className={`select-none leading-none ${emojiCount === 1 ? "text-[44px]" : "text-[36px]"}`} aria-label={msg.content}>{msg.content}</div>
        <span className="m-meta-pill" aria-hidden>{time}{tick}</span>
      </div>
    );
  } else if (msg.type === "STICKER") {
    body = (
      <div className="m-bare">
        {/* Sticker hoạt hình (Noto Emoji Animation, Google · CC BY 4.0) — chưa tải được thì hiện emoji to. */}
        <StickerView emoji={msg.content} animate={fresh} />
        <span className="m-meta-pill" aria-hidden>{time}{tick}</span>
      </div>
    );
  } else if (isMedia) {
    const ratio = mediaAspect(msg.content);
    body = (
      <div className={`m-media ${corner}`} style={{ aspectRatio: String(ratio) }}>
        {mediaBroken ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[13px] text-slate-400">
            <ImageOff className="h-6 w-6" />
            {tr("Ảnh không hiển thị được", "Image unavailable")}
          </span>
        ) : msg.type === "IMAGE" ? (
          // Plain <img>: nội dung từ nhiều host ngoài (Tenor GIF, Cloudinary) — next/image sẽ chặn host lạ.
          <button type="button" onClick={() => onOpenMedia?.(msg.content)} aria-label={CS.openImage()} className="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={msg.content} alt={tr("Hình ảnh", "Image")} loading="lazy" decoding="async" onError={() => setMediaBroken(true)} className="h-full w-full object-cover" />
          </button>
        ) : (
          <button type="button" onClick={() => onOpenMedia?.(msg.content)} aria-label={CS.openImage()} className="relative block h-full w-full bg-black">
            <video src={msg.content} playsInline muted preload="metadata" onError={() => setMediaBroken(true)} className="pointer-events-none h-full w-full object-cover" />
            <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(12_8_14/0.55)] text-white">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </button>
        )}
        <span className="m-meta-pill m-meta-over" aria-hidden>{time}{tick}</span>
      </div>
    );
  } else if (msg.type === "AUDIO") {
    body = (
      <div className={`m-bubble ${isSelf ? "m-out" : "m-in"} ${corner} m-audio`}>
        <VoiceMessage src={msg.content} self={isSelf} />
        {meta}
      </div>
    );
  } else {
    const showTx = tx?.status === "done" && !!tx.text && !showOriginal;
    const shown = showTx ? tx!.text! : msg.content;
    const srcLang = detectTextLang(msg.content);
    // Giờ nằm trong bong bóng (góc dưới phải): chừa chỗ ở dòng CUỐI — dòng chữ, hoặc dòng "Xem bản dịch" nếu có.
    const spacer = <span className={`m-meta-spacer ${isSelf ? "m-spacer-out" : ""}`} aria-hidden />;
    body = (
      <div className={`m-bubble ${isSelf ? "m-out" : "m-in"} ${corner} ${tail ? "m-tail" : ""}`}>
        <p className="m-text" lang={showTx ? viewer : srcLang ?? undefined}>
          {linkify(shown, "m-link")}
          {!translatable && spacer}
        </p>
        {translatable && (
          <p className="m-tx">
            {tx?.status === "loading" ? (
              <span>{tr("Đang dịch…", "Translating…")}</span>
            ) : tx?.status === "done" ? (
              <>
                {showTx && <span>{srcLang === "vi" ? tr("Dịch từ tiếng Việt", "Translated from Vietnamese") : tr("Dịch từ tiếng Anh", "Translated from English")}</span>}
                {showTx && <span aria-hidden>·</span>}
                <button type="button" onClick={() => setShowOriginal((v) => !v)}>
                  {showTx ? tr("Xem bản gốc", "Show original") : tr("Xem bản dịch", "See translation")}
                </button>
              </>
            ) : tx?.status === "failed" ? (
              <span>{tr("Chưa dịch được tin này.", "Translation isn't available for this message.")}</span>
            ) : (
              <button type="button" onClick={() => requestTranslation(msg.id, viewer)}>
                {tr("Xem bản dịch", "See translation")}
              </button>
            )}
            {spacer}
          </p>
        )}
        {meta}
      </div>
    );
  }

  return (
    <React.Fragment key={msg.id || idx}>
      {dateSeparator}
      <div
        ref={rowRef}
        data-mid={msg.id}
        className={`m-row group relative flex items-end ${isSelf ? "justify-end" : "justify-start"} ${groupedWithPrev ? "m-grouped" : ""} ${sum.total > 0 ? "m-has-react" : ""} ${picker ? "z-30" : ""} ${animClass}`}
      >
        {isSelf && reactBtn}
        {showGroupAvatar &&
          (senderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={senderAvatar} alt="" loading="lazy" className="mr-2 h-7 w-7 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <div className="mr-2 h-7 w-7 flex-shrink-0" aria-hidden />
          ))}
        {isSelf && msg.sendError && (
          <button type="button" onClick={() => onRetry(msg)} aria-label={tr(" Gửi thất bại · Thử lại", " Failed · Retry").trim()} className="mr-1 flex h-11 w-8 flex-shrink-0 items-center justify-center text-red-400">
            <AlertCircle className="h-5 w-5" />
          </button>
        )}
        <div className={`m-col relative flex flex-col ${isSelf ? "items-end" : "items-start"} ${group ? "m-col-group" : ""}`}>
          {group && !isSelf && !groupedWithPrev && <span className="m-sender">{msg.sender?.name}</span>}

          <div className="relative select-none [-webkit-touch-callout:none] sm:select-text" tabIndex={canReact ? 0 : undefined} {...pressHandlers}>
            <span className="sr-only">{srLabel}</span>
            {picker && (
              <div
                role="menu"
                aria-label={tr("Chọn cảm xúc", "Pick a reaction")}
                className={`m-react-bar absolute bottom-full z-40 mb-2 flex items-center gap-0.5 rounded-full px-1.5 py-1 ${isSelf ? "right-0" : "left-0"}`}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="menuitemradio"
                    onClick={() => react(e)}
                    aria-label={e}
                    aria-checked={sum.mine === e}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-[26px] leading-none transition-transform duration-150 active:scale-95 ${sum.mine === e ? "bg-white/15" : ""}`}
                  >
                    {e}
                  </button>
                ))}
                {(msg.type === "TEXT" || !msg.type) && (
                  <>
                    <span className="mx-1 h-6 w-px bg-white/10" />
                    <button type="button" role="menuitem" onClick={copy} aria-label={tr("Sao chép", "Copy")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
                      <Copy className="h-[18px] w-[18px]" />
                    </button>
                  </>
                )}
              </div>
            )}
            {body}
          </div>

          {sum.total > 0 && (
            <button
              type="button"
              onClick={() => (sum.mine ? react(sum.mine) : canReact && setPicker(true))}
              title={sum.mine ? tr("Bấm để gỡ cảm xúc của bạn", "Tap to remove your reaction") : tr("Thả cảm xúc", "React")}
              className={`m-react-chip ${sum.mine ? "m-react-mine" : ""} ${isSelf ? "mr-2" : "ml-2"}`}
            >
              {sum.top.slice(0, 3).map((e) => <span key={e}>{e}</span>)}
              {sum.total > 1 && <span className="ml-0.5 text-[12px] font-semibold text-slate-300 tabular-nums">{sum.total}</span>}
            </button>
          )}

          {isSelf && msg.sendError && (
            <button
              type="button"
              onClick={() => onRetry(msg)}
              className="mt-1 flex min-h-6 items-center gap-1 text-[12px] font-semibold text-red-300 transition-colors hover:text-red-200"
            >
              <RefreshCw className="h-3 w-3" />
              {tr(" Gửi thất bại · Thử lại", " Failed · Retry")}
            </button>
          )}
        </div>
        {!isSelf && reactBtn}
      </div>
    </React.Fragment>
  );
}

function StickerView({ emoji, animate }: { emoji: string; animate: boolean }) {
  // Ảnh tĩnh Noto (vài KB) cho mọi sticker trong lịch sử; chỉ sticker VỪA tới (hoặc khi chạm vào) mới tải bản
  // hoạt hình (~0,5MB/cái) — trước đây mở 1 đoạn chat 10 sticker là tải ~5MB. Giảm chuyển động: luôn ảnh tĩnh.
  const [play, setPlay] = React.useState(animate);
  const [animReady, setAnimReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const still = stickerStill(emoji);
  const url = stickerUrl(emoji);
  React.useEffect(() => {
    if (!url || !play) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const img = new Image();
    img.onload = () => setAnimReady(true);
    img.src = url;
  }, [url, play]);
  if (!url || !still || failed) return <div className="my-1 select-none text-[64px] leading-none">{emoji}</div>;
  return (
    <button type="button" onClick={() => setPlay(true)} aria-label={emoji} className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={animReady ? url : still} alt={emoji} width={120} height={120} decoding="async" draggable={false} onError={() => setFailed(true)} className="my-1 h-[120px] w-[120px] select-none" />
    </button>
  );
}

const MessageRow = React.memo(MessageRowImpl);
export default MessageRow;
