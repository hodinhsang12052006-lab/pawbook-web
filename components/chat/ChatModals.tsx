"use client";

// Hộp thoại của trang Tin nhắn — tách khỏi MessagesContent.tsx (file chính
// quá dài). Đều là component có điều khiển: state vẫn nằm ở MessagesContent.
import React from "react";
import { Flag as FlagIcon, Loader2, Users, X } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";
import type { UserType } from "./chatShared";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export function ReportUserModal({
  name, reason, onReasonChange, busy, onCancel, onSubmit,
}: { name: string; reason: string; onReasonChange: (v: string) => void; busy: boolean; onCancel: () => void; onSubmit: () => void }) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div role="dialog" aria-modal="true" aria-label={tr(`Báo cáo ${name}`, `Report ${name}`)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 animate-scaleUp">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <FlagIcon className="h-6 w-6 text-amber-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold text-white">{tr("Báo cáo ", "Report ")}{name}</h3>
          <p className="text-sm text-slate-400">{tr("Mô tả ngắn gọn lý do báo cáo — đội ngũ sẽ xem xét sớm nhất.", "Briefly describe why — our team will review it as soon as possible.")}</p>
        </div>
        <textarea
          aria-label={tr("Lý do báo cáo", "Reason")}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          placeholder={tr("VD: Gửi nội dung quấy rối, lừa đảo...", "e.g. Harassment, scams...")}
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={busy} className="flex-1 min-h-[48px] rounded-xl border border-slate-800 text-sm font-bold text-slate-300 disabled:opacity-50">
            {tr("Hủy", "Cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={!reason.trim() || busy}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-sm font-bold text-white disabled:opacity-40 transition-all"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Gửi báo cáo", "Send report")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateGroupModal({
  groupName, onGroupNameChange, users, selectedIds, onToggle, currentUserId, onClose, onCreate,
}: {
  groupName: string;
  onGroupNameChange: (v: string) => void;
  users: UserType[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  currentUserId?: string;
  onClose: () => void;
  onCreate: () => void;
}) {
  useTr(); // render lại khi đổi VI/EN
  return (
    <div role="dialog" aria-modal="true" aria-label={tr("Tạo nhóm trò chuyện", "Create group chat")} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-pink-500" />
            {tr("Tạo nhóm trò chuyện mới", "New group chat")}
          </h3>
          <button onClick={onClose} aria-label={tr("Đóng", "Close")} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label htmlFor="group-name" className="block text-4xs font-bold text-slate-400 mb-1">{tr("TÊN NHÓM", "GROUP NAME")}</label>
            <input
              id="group-name"
              type="text"
              placeholder={tr("Nhập tên nhóm trò chuyện...", "Enter a group name...")}
              value={groupName}
              onChange={(e) => onGroupNameChange(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <p className="block text-4xs font-bold text-slate-400 mb-1.5 uppercase">{tr("Chọn thành viên", "Choose members")}</p>
            <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-850 rounded-xl p-2 bg-slate-950/40 custom-scrollbar">
              {users.length === 0 ? (
                <p className="text-center py-4 text-slate-500 text-5xs">{tr("Chưa có thành viên nào.", "No members yet.")}</p>
              ) : (
                users.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const isDisabled = user.id === currentUserId;
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition-all duration-300 ${isDisabled ? "opacity-35 cursor-not-allowed select-none" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative h-6.5 w-6.5 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={avatarSrc(user.avatarUrl, user.name, user.id)} alt="" loading="lazy" className="object-cover w-full h-full rounded-full" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="block text-3xs font-bold text-slate-200 truncate">{user.name}</span>
                            {user.isInternal && (
                              <span className="inline-flex items-center text-[7px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded-full">{tr("✓ Nội bộ", "✓ Internal")}</span>
                            )}
                          </div>
                          <span className="block text-5xs text-slate-500 truncate">{user.role}</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && onToggle(user.id)}
                        className="h-3.5 w-3.5 rounded border-slate-800 text-pink-600 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-3xs font-bold bg-slate-950 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-all duration-300">
            {tr("Hủy bỏ", "Cancel")}
          </button>
          <button onClick={onCreate} className="rounded-lg bg-pink-600 hover:bg-pink-500 px-4 py-2 text-3xs font-bold text-white transition-all duration-300 cursor-pointer">
            {tr("Tạo nhóm", "Create group")}
          </button>
        </div>
      </div>
    </div>
  );
}
