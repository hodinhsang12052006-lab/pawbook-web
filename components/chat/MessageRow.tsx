"use client";

import React from "react";
import { Check, CheckCheck, Phone, Video, RefreshCw } from "lucide-react";
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
  reactions?: string[];
  locale: string;
  t: (key: string) => string;
  onCallBack?: (kind: "audio" | "video") => void;
  onReact: (messageId: string, icon: string) => void;
  onClearReactions: (messageId: string) => void;
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
  onClearReactions,
  onRetry,
}: MessageRowProps) {
  // Thanh thả cảm xúc chỉ dựng khi chạm/rê vào tin (trước đây mỗi tin dựng sẵn
  // 6 nút ẩn → hàng trăm nút thừa, chậm khi mở/cuộn chat dài).
  const [barReady, setBarReady] = React.useState(false);
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
              <p className="text-[10px] text-slate-500">{new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            {onCallBack && (
              <button
                type="button"
                onClick={() => onCallBack(call.kind as "audio" | "video")}
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
      <div
        onPointerEnter={barReady ? undefined : () => setBarReady(true)}
        className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end gap-2 group relative ${groupedWithPrev ? "!mt-1" : ""} ${animClass}`}
      >
        {!isSelf &&
          (isLastInGroup ? (
            <div className="relative mb-[22px] h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
              <img src={senderAvatar} alt={msg.sender?.name || "User"} loading="lazy" className="object-cover w-full h-full rounded-full" />
            </div>
          ) : (
            <div className="h-7 w-7 flex-shrink-0" aria-hidden />
          ))}
        <div className="flex flex-col max-w-[70%] relative pb-1">
          {activeChat.isGroup && !isSelf && <span className="text-5xs text-slate-500 mb-0.5 ml-1">{msg.sender?.name}</span>}

          <div className="relative">
            {msg.type === "STICKER" ? (
              <div className="text-5xl my-2 select-none transform hover:scale-115 hover:-rotate-3 active:scale-95 transition-all cursor-pointer" title="Sticker">
                {msg.content}
              </div>
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
                className={`rounded-2xl px-4 py-2 text-xs leading-relaxed break-words relative ${
                  isSelf
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
                            bubble.innerHTML = `<span class='flex items-center gap-1.5 text-[10px] text-slate-400 font-medium'>⚠️ ${tr(
                              "Ảnh không hiển thị được",
                              "Image unavailable"
                            )}</span>`;
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

            {reactions && reactions.length > 0 && (
              <div
                onClick={() => onClearReactions(msg.id)}
                className={`absolute -bottom-2.5 ${
                  isSelf ? "left-2" : "right-2"
                } bg-slate-900 border border-slate-800 rounded-full px-1.5 py-0.5 text-[9px] flex items-center gap-0.5 shadow-lg z-20 select-none cursor-pointer hover:bg-slate-800 transition-colors`}
                title={tr("Nhấp để xóa cảm xúc", "Click to remove reaction")}
              >
                {reactions.map((emoji, i) => (
                  <span key={i} className="hover:scale-125 transition-transform duration-100">
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>

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

          {barReady && (
            <div
              className={`absolute -top-7 ${
                isSelf ? "right-0" : "left-0"
              } flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-lg px-2 py-0.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 backdrop-blur-sm`}
            >
              <div className="flex items-center gap-1 border-r border-slate-800 pr-1.5 mr-1.5">
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button key={emoji} onClick={() => onReact(msg.id, emoji)} className="text-xs hover:scale-130 transition-transform active:scale-95 duration-75 cursor-pointer">
                    {emoji}
                  </button>
                ))}
              </div>
              <span className="text-[8px] text-slate-500 font-mono select-none">{new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

const MessageRow = React.memo(MessageRowImpl);
export default MessageRow;
