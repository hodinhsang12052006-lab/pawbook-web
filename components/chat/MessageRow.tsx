"use client";

import React from "react";
import { Check, CheckCheck, Phone, PhoneMissed, Video, RefreshCw, SmilePlus, Copy } from "lucide-react";
import VoiceMessage from "./VoiceMessage";
import toast from "react-hot-toast";
import { REACTION_EMOJIS, summarize, type Reaction } from "@/lib/chatReactions";
import { stickerUrl } from "@/lib/chatStickers";
import { avatarSrc } from "@/lib/avatar";
import { tr } from "@/lib/i18n/tr";
import { describeCall, type MessageType } from "./chatShared";

// Một bong bóng tin nhắn — React.memo: khi gõ phím, có tin mới, đang tải thêm
// lịch sử hay đối phương "đang soạn", CHỈ những tin thật sự đổi mới render lại
// (trước đây cả trăm bong bóng render lại mỗi lần → khựng trên điện thoại).
// Mọi callback truyền vào phải ổn định (xem rowHandlers trong MessagesContent).
export interface MessageRowProps {
  msg: MessageType;
  idx: number;
  prevMsg: MessageType | null;
  nextMsg: MessageType | null;
  currentUser: { id: string; name: string; avatarUrl?: string | null };
  activeChat: { isGroup: boolean; avatarUrl?: string | null; name: string };
  fresh: boolean;
  isLastSelf: boolean;
  seenAt?: string;
  reactions?: Reaction[];
  locale: string;
  t: (key: string) => string;
  onCallBack?: (kind: "audio" | "video") => void;
  onReact: (messageId: string, icon: string, current?: Reaction[]) => void;
  onRetry: (msg: MessageType) => void;
}

function MessageRowImpl({
  msg,
  idx,
  prevMsg,
  nextMsg,
  currentUser,
  activeChat,
  fresh,
  isLastSelf,
  seenAt,
  reactions,
  locale,
  t,
  onCallBack,
  onReact,
  onRetry,
}: MessageRowProps) {
  // Thả cảm xúc kiểu Messenger: máy tính rê vào tin → nút 🙂 cạnh bong bóng; điện thoại nhấn giữ tin.
  // Thanh cảm xúc chỉ dựng khi mở (không dựng sẵn cho hàng trăm tin).
  const [picker, setPicker] = React.useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);
  React.useEffect(() => {
    if (!picker) return;
    const close = (e: PointerEvent) => { if (!rowRef.current?.contains(e.target as Node)) setPicker(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [picker]);
  const isSelf = msg.senderId === currentUser?.id;
  const senderAvatar = isSelf
    ? avatarSrc(currentUser.avatarUrl, currentUser.name, currentUser.id)
    : avatarSrc(
        // Tin realtime (Pusher) không kèm avatar → chat 1-1 dùng avatar đối phương.
        msg.sender?.avatarUrl || (!activeChat.isGroup ? activeChat.avatarUrl : ""),
        msg.sender?.name || (!activeChat.isGroup ? activeChat.name : "U"),
        msg.senderId
      );
  const animClass = fresh ? "message-slide-up" : "";

  const msgDay = new Date(msg.createdAt).toDateString();
  const showDateSeparator = !prevMsg || new Date(prevMsg.createdAt).toDateString() !== msgDay;
  // Gom tin liên tiếp của cùng 1 người trong 5 phút thành 1 cụm
  // (kiểu Messenger): avatar + giờ chỉ ở tin cuối cụm, khoảng
  // cách giữa các tin trong cụm sát lại.
  const sameGroup = (a: MessageType | null, b: MessageType | null) =>
    !!a &&
    !!b &&
    a.senderId === b.senderId &&
    a.type !== "SYSTEM" &&
    b.type !== "SYSTEM" &&
    new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString() &&
    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
  const groupedWithPrev = sameGroup(prevMsg, msg);
  const isLastInGroup = !sameGroup(msg, nextMsg);
  const canReact = !msg.isOptimistic && !msg.sendError && !String(msg.id).startsWith("temp");
  const sum = summarize(reactions, currentUser?.id ?? "");
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null; };
  const pressHandlers = canReact
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === "mouse") return;
          longPressed.current = false;
          pressTimer.current = setTimeout(() => { longPressed.current = true; setPicker(true); navigator.vibrate?.(8); }, 420);
        },
        onPointerUp: clearPress,
        onPointerMove: (e: React.PointerEvent) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearPress(); },
        onPointerCancel: clearPress,
        onContextMenu: (e: React.MouseEvent) => { if (longPressed.current || pressTimer.current) e.preventDefault(); },
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
      className="mb-6 hidden h-8 w-8 flex-shrink-0 items-center justify-center self-center rounded-full text-slate-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-slate-200 focus-visible:opacity-100 group-hover:opacity-100 md:flex"
    >
      <SmilePlus className="h-[18px] w-[18px]" />
    </button>
  ) : null;
  // Tin chỉ có 1–3 emoji → hiện TO, không bong bóng (như Messenger/iMessage).
  const emojiOnly =
    (msg.type === "TEXT" || !msg.type) &&
    /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D|\s)+$/u.test(msg.content || "") &&
    [...(msg.content || "").matchAll(/\p{Extended_Pictographic}/gu)].length <= 3;
  // Bo góc theo cụm: tin nối tiếp cùng người thì góc phía người gửi bo nhỏ lại (liền khối như Messenger).
  const corner = isSelf
    ? `${groupedWithPrev ? "rounded-tr-md" : ""} ${!isLastInGroup ? "rounded-br-md" : ""}`
    : `${groupedWithPrev ? "rounded-tl-md" : ""} ${!isLastInGroup ? "rounded-bl-md" : ""}`;
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
    <div key={`sep-${msg.id || idx}`} className="my-5 flex w-full items-center justify-center">
      <span className="text-[11px] font-semibold text-slate-500">{dateSeparatorLabel}</span>
    </div>
  ) : null;

  if (msg.type === "CALL") {
    // Nhật ký cuộc gọi như Messenger: bong bóng gọn nằm ĐÚNG phía người gọi (trước đây là thẻ hồng
    // to giữa màn hình — 2 cuộc nhỡ liền nhau thành 2 khối to, rất rối).
    const call = describeCall(msg.content);
    const time = new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return (
      <React.Fragment key={msg.id || idx}>
        {dateSeparator}
        <div className={`flex w-full ${isSelf ? "justify-end" : "justify-start pl-9"} ${groupedWithPrev ? "!mt-1" : ""} ${animClass}`}>
          <div className="w-[230px] max-w-[78%] overflow-hidden rounded-[20px] bg-slate-800/90">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${call.missed ? "bg-rose-500/15 text-rose-400" : "bg-white/10 text-slate-200"}`}>
                {call.kind === "video" ? <Video className="h-[18px] w-[18px]" /> : call.missed ? <PhoneMissed className="h-[18px] w-[18px]" /> : <Phone className="h-[18px] w-[18px]" />}
              </span>
              <div className="min-w-0 text-left">
                <p className={`truncate text-sm font-semibold ${call.missed ? "text-rose-300" : "text-slate-100"}`}>{call.text}</p>
                <p className="text-xs text-slate-400">{time}</p>
              </div>
            </div>
            {onCallBack && (
              <button
                type="button"
                onClick={() => onCallBack(call.kind as "audio" | "video")}
                className="w-full border-t border-white/5 py-2 text-center text-[13px] font-semibold text-pink-300 transition-colors hover:bg-white/5 hover:text-pink-200"
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
      <div
        ref={rowRef}
        className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative ${groupedWithPrev ? "!mt-1" : ""} ${picker ? "z-30" : ""} ${animClass}`}
      >
        {isSelf && reactBtn}
        {!isSelf &&
          (isLastInGroup ? (
            <div className="relative mb-[22px] h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
              <img src={senderAvatar} alt={msg.sender?.name || "User"} loading="lazy" className="object-cover w-full h-full rounded-full" />
            </div>
          ) : (
            <div className="h-7 w-7 flex-shrink-0" aria-hidden />
          ))}
        <div className="relative flex max-w-[78%] flex-col pb-1 sm:max-w-[65%]">
          {activeChat.isGroup && !isSelf && <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender?.name}</span>}

          <div className="relative select-none [-webkit-touch-callout:none] sm:select-text" {...pressHandlers}>
            {picker && (
              <div
                role="menu"
                aria-label={tr("Chọn cảm xúc", "Pick a reaction")}
                className={`absolute bottom-full z-40 mb-2 flex items-center gap-0.5 rounded-full bg-slate-900/95 px-1.5 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-md animate-fadeIn ${isSelf ? "right-0" : "left-0"}`}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="menuitemradio"
                    onClick={() => react(e)}
                    aria-label={e}
                    aria-checked={sum.mine === e}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-[26px] leading-none transition-transform duration-150 hover:-translate-y-1 hover:scale-125 active:scale-95 ${sum.mine === e ? "bg-white/15" : ""}`}
                  >
                    {e}
                  </button>
                ))}
                {(msg.type === "TEXT" || !msg.type) && (
                  <>
                    <span className="mx-1 h-6 w-px bg-white/10" />
                    <button type="button" role="menuitem" onClick={copy} aria-label={tr("Sao chép", "Copy")} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
                      <Copy className="h-[18px] w-[18px]" />
                    </button>
                  </>
                )}
              </div>
            )}
            {emojiOnly ? (
              <div className="select-none py-1 text-[2.75rem] leading-none" aria-label={msg.content}>{msg.content}</div>
            ) : msg.type === "STICKER" ? (
              // Sticker hoạt hình (Noto Emoji Animation, Google · CC BY 4.0) — chưa tải được thì hiện emoji to.
              <StickerView emoji={msg.content} />
            ) : msg.type === "ATTENDANCE" ? (
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2 min-w-[260px] text-emerald-300 font-sans shadow-lg text-left">
                <p className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="text-emerald-500">⏱️</span>
                  {tr(" GPS Chấm Công Thành Công", " GPS check-in successful")}
                </p>
                <div className="text-3xs space-y-1 mt-1 text-emerald-300/90 leading-relaxed font-semibold">
                  <p>{tr("✅ Đã chấm công thành công lúc 08:00 AM.", "✅ Checked in at 08:00 AM.")}</p>
                  <p>{tr("📍 Vị trí: Trùng khớp với tọa độ Radar.", "📍 Location: matches Radar coordinates.")}</p>
                </div>
              </div>
            ) : (
              <div
                className={`relative break-words rounded-[20px] px-3.5 py-2 text-[15px] leading-snug sm:text-sm ${corner} ${
                  isSelf
                    ? "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-sm shadow-pink-600/20"
                    : "bg-slate-800/90 text-slate-50"
                } ${msg.type === "IMAGE" || msg.type === "VIDEO" || msg.type === "AUDIO" ? "!bg-none !bg-transparent !p-0 !shadow-none" : ""}`}
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
                            bubble.innerHTML = `<span class='flex items-center gap-1.5 text-[10px] text-slate-400 font-medium'>⚠️ ${tr(
                              "Ảnh không hiển thị được",
                              "Image unavailable"
                            )}</span>`;
                          }
                        }
                      }}
                    />
                  </div>
                ) : msg.type === "AUDIO" ? (
                  <VoiceMessage src={msg.content} self={isSelf} />
                ) : msg.type === "VIDEO" ? (
                  <video src={msg.content} controls playsInline preload="metadata" className="block max-h-80 w-64 max-w-full rounded-2xl bg-black" />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            )}

          </div>

          {sum.total > 0 && (
            <button
              type="button"
              onClick={() => (sum.mine ? react(sum.mine) : canReact && setPicker(true))}
              title={sum.mine ? tr("Bấm để gỡ cảm xúc của bạn", "Tap to remove your reaction") : tr("Thả cảm xúc", "React")}
              className={`relative z-10 -mt-2 inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[13px] leading-none shadow-md shadow-black/40 ring-1 transition-transform active:scale-95 ${sum.mine ? "ring-pink-500/60" : "ring-white/10"} ${isSelf ? "mr-2 self-end" : "ml-2 self-start"}`}
            >
              {sum.top.slice(0, 3).map((e) => <span key={e}>{e}</span>)}
              {sum.total > 1 && <span className="ml-0.5 text-[11px] font-bold text-slate-300">{sum.total}</span>}
            </button>
          )}

          {/* Giờ gửi ở tin cuối mỗi cụm; tin cuối của mình kèm Đã gửi/Đã xem. */}
          {(isLastInGroup || isLastSelf) && (
            <span className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-500 ${isSelf ? "self-end" : "self-start"}`}>
              {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              {isLastSelf &&
                !activeChat.isGroup &&
                !msg.isOptimistic &&
                !msg.sendError &&
                (isSeen ? (
                  <span className="flex items-center gap-0.5 font-semibold text-pink-300">
                    · <CheckCheck className="h-3 w-3" />
                    {tr(" Đã xem", " Seen")}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    · <Check className="h-3 w-3" />
                    {tr(" Đã gửi", " Sent")}
                  </span>
                ))}
            </span>
          )}

          {isSelf && msg.sendError && (
            <button
              type="button"
              onClick={() => onRetry(msg)}
              className="mt-1 flex items-center gap-1 self-end text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
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

function StickerView({ emoji }: { emoji: string }) {
  const [failed, setFailed] = React.useState(false);
  const url = stickerUrl(emoji);
  if (!url || failed) return <div className="my-1 select-none text-[64px] leading-none">{emoji}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={emoji} width={120} height={120} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className="my-1 h-[120px] w-[120px] select-none" />;
}

const MessageRow = React.memo(MessageRowImpl);
export default MessageRow;
