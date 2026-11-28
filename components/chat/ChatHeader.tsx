"use client";

// Thanh đầu khung chat (tách khỏi MessagesContent): người đang chat, trạng thái hoạt động / đang soạn, nút gọi, menu ⋮.
// React.memo + menu ⋮ giữ state riêng → gửi / nhận tin, gõ phím không vẽ lại thanh này.
import React, { memo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, MoreVertical, Palette, Phone, ShieldCheck, ShieldOff, Users, Video } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";
import { useIsOnline, lastActiveLabel } from "@/lib/presence";
import { preloadCallSdk } from "@/lib/callPreload";
import { useCallManager } from "@/lib/CallManagerContext";
import VerifiedBadge, { isVerifiedRole } from "@/components/ui/VerifiedBadge";
import { CS } from "@/lib/i18n/chatStrings";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { PresenceAvatar, TypingDots, ROLE_VI, type ActiveChatType } from "./chatShared";

type Props = {
  chat: ActiveChatType;
  bubble: boolean;
  locale: string;
  typing: boolean;
  connLost: boolean;
  partnerLastActiveAt: string | null;
  phoneVerified: boolean;
  /** chấm nhỏ trên nút ⋮ cho tới khi mở bảng hình nền lần đầu */
  wpSeen: boolean;
  blocked: boolean;
  blockBusy: boolean;
  onBack: () => void;
  onWallpaper: () => void;
  onReport: () => void;
  onToggleBlock: () => void;
};

function ChatHeader({ chat, bubble, locale, typing, connLost, partnerLastActiveAt, phoneVerified, wpSeen, blocked, blockBusy, onBack, onWallpaper, onReport, onToggleBlock }: Props) {
  useTr(); // render lại khi đổi VI/EN
  const [showChatMenu, setShowChatMenu] = useState(false);
  const { startCall } = useCallManager();
  // Trạng thái THẬT của đối phương đang chat.
  // Chỉ theo dõi online khi đã có cuộc trò chuyện chung (server từ chối người lạ).
  const partnerOnline = useIsOnline(!chat.isGroup && chat.conversationId ? chat.id : null);
  const call = (kind: "audio" | "video") =>
    startCall({ id: chat.id, name: chat.name, avatarUrl: chat.avatarUrl, isGroup: chat.isGroup, conversationId: chat.conversationId }, kind);
  const openWallpaper = () => {
    setShowChatMenu(false);
    onWallpaper();
  };

  return (
    <div className="pn-glass-bar relative flex flex-none items-center justify-between gap-3 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 z-10">
      <div className="flex items-center gap-3">
        {!bubble && (
        <button
          onClick={onBack}
          aria-label={tr("Quay lại danh sách", "Back to chats")}
          className="m-back -ml-1 mr-0.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white md:hidden"
        >
          <ArrowLeft className="h-4 w-4" /><span className="sr-only">{locale === "vi" ? tr("Quay lại", "Back") : "Back"}</span>
        </button>
        )}
        <div className="relative flex-shrink-0">
          {chat.isGroup ? (
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {chat.avatarUrl ? <img src={chat.avatarUrl} alt="" className="h-full w-full object-cover" data-group-avatar /> : <Users className="h-5 w-5 text-fuchsia-300" />}
            </span>
          ) : (
            <PresenceAvatar watch={!!chat.conversationId} userId={chat.id} src={avatarSrc(chat.avatarUrl, chat.name, chat.id)} alt={chat.name} size="h-10 w-10" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-1 text-sm font-bold text-slate-100">
            {/* Điện thoại: chạm vào tên để xem hồ sơ (chỗ chật, ẩn chữ "Xem hồ sơ" để không đè nút gọi). */}
            {chat.isGroup ? (
              <span className="truncate">{chat.name}</span>
            ) : (
              <Link href={`/profile/${chat.id}`} className="truncate hover:text-pink-200">{chat.name}</Link>
            )}
            {!chat.isGroup && isVerifiedRole(chat.role) && <VerifiedBadge className="h-4 w-4" />}
            {!chat.isGroup && phoneVerified && <ShieldCheck aria-label={tr(" SĐT đã xác minh", " Phone verified").trim()} className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />}
          </h3>
          {/* Trước đây chấm xanh "đang hoạt động" hiện cứng cho MỌI người
              (app không theo dõi online) — bỏ, thay bằng thông tin thật. */}
          <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-slate-400">
            {typing ? (
              <span className="flex items-center gap-1.5 font-semibold text-pink-300">
                {tr("Đang soạn tin ", "Typing ")}<TypingDots />
              </span>
            ) : chat.isGroup ? (
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
                  <span>{lastActiveLabel(partnerLastActiveAt) || ROLE_VI()[chat.role] || tr("Thành viên", "Member")}</span>
                )}
                <span className="hidden text-slate-600 sm:inline">·</span>
                <Link href={`/profile/${chat.id}`} className="hidden font-semibold text-pink-300 hover:text-pink-200 sm:inline">
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
        {!chat.isGroup && !bubble && (
          <>
            <button
              onPointerEnter={preloadCallSdk}
              onClick={() => call("audio")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-pink-400 transition-colors hover:bg-white/[0.06] hover:text-pink-300"
              title={tr("Cuộc gọi thoại bảo mật", "Secure voice call")}
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              onPointerEnter={preloadCallSdk}
              onClick={() => call("video")}
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
                {!chat.isGroup && (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => { setShowChatMenu(false); onReport(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-slate-850 transition-colors"
                    >
                      <Flag className="h-4 w-4 text-amber-400" />{tr(" Báo cáo người dùng", " Report user")}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { if (!blockBusy) setShowChatMenu(false); onToggleBlock(); }}
                      disabled={blockBusy}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-slate-850 transition-colors disabled:opacity-50"
                    >
                      {blocked ? (
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
  );
}

export default memo(ChatHeader);
