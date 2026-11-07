"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, BellOff, MessageCircle, X } from "lucide-react";
import { enablePush, getPushState } from "@/lib/pushClient";
import { getBubbleInfo, isAndroidApp, openBubbleSettings, openNotificationSettings } from "@/lib/nativePush";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// Dải mời gọn ở đầu danh sách Tin nhắn — CHỈ trong app Android (web / iPhone không bao giờ thấy):
//  - chưa bật thông báo đẩy → "Nhận thông báo tin nhắn" (bật luôn tại chỗ; lời mời chung PushPrompt im lặng ở /messages);
//  - đã chặn thông báo (hoặc chỉ tắt riêng kênh "Tin nhắn" của app) → mở Cài đặt thông báo của app;
//  - đã bật, máy Android 11+ mà bong bóng chat chưa ở "Tất cả cuộc trò chuyện" → mẹo 1 lần "Bật bong bóng chat".
// Đóng: lời mời bật thông báo hỏi lại sau 14 ngày; mẹo bong bóng chỉ hiện 1 lần.
type Kind = "push" | "denied" | "bubbles";
const KEYS: Record<Kind, string> = { push: "pn_msg_push_banner_at", denied: "pn_msg_push_denied_at", bubbles: "pn_bubble_tip_done" };
const SNOOZE_MS: Record<Kind, number> = { push: 14 * 86_400_000, denied: 30 * 86_400_000, bubbles: Infinity };

function dismissed(kind: Kind): boolean {
  try {
    const v = localStorage.getItem(KEYS[kind]);
    if (!v) return false;
    return SNOOZE_MS[kind] === Infinity || Date.now() - Number(v) < SNOOZE_MS[kind];
  } catch {
    return false;
  }
}
function remember(kind: Kind) {
  try {
    localStorage.setItem(KEYS[kind], String(Date.now()));
  } catch {}
}

async function pickKind(): Promise<Kind | null> {
  if (!isAndroidApp()) return null;
  const state = await getPushState().catch(() => "unsupported" as const);
  if (state === "off") return dismissed("push") ? null : "push";
  if (state === "denied") return dismissed("denied") ? null : "denied";
  if (state !== "on") return null;
  const info = await getBubbleInfo();
  // Quyền vẫn "granted" nhưng người dùng tắt riêng kênh "Tin nhắn" (hoặc mọi thông báo) → tin nhắn im lặng.
  if (info && (!info.messagesChannel || !info.notificationsEnabled)) return dismissed("denied") ? null : "denied";
  if (dismissed("bubbles")) return null;
  return info && info.sdk >= 30 && info.bubbles && info.bubblePref !== "all" ? "bubbles" : null;
}

export default function ChatNotifyBanner() {
  useTr(); // render lại khi đổi VI/EN
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    pickKind().then(setKind, () => setKind(null));
  }, []);

  useEffect(() => {
    if (!isAndroidApp()) return;
    refresh();
    // Quay lại từ Cài đặt Android (bật thông báo / bong bóng) → cập nhật ngay.
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  if (!kind) return null;

  const close = () => {
    remember(kind);
    setKind(null);
  };
  const act = async () => {
    if (busy) return;
    setBusy(true);
    if (kind === "push") {
      const next = await enablePush().catch(() => "off" as const);
      // Bật xong thì thôi — mẹo bong bóng để lần sau, không dồn 2 lời mời liền nhau.
      if (next === "on") setKind(null);
      else if (next === "denied") setKind("denied");
      else close();
    } else if (kind === "denied") {
      await openNotificationSettings();
    } else {
      remember("bubbles");
      await openBubbleSettings();
      setKind(null);
    }
    setBusy(false);
  };

  const copy =
    kind === "push"
      ? {
          icon: BellRing,
          title: tr("Nhận thông báo tin nhắn", "Get message notifications"),
          text: tr("Kể cả khi đã đóng PawNail.", "Even when PawNail is closed."),
          cta: busy ? tr("Đang bật…", "Turning on…") : tr("Bật", "Turn on"),
        }
      : kind === "denied"
      ? {
          icon: BellOff,
          title: tr("Thông báo đang tắt", "Notifications are off"),
          text: tr("Bật lại trong Cài đặt để không lỡ tin nhắn.", "Allow them in Settings so you don't miss messages."),
          cta: tr("Cài đặt", "Settings"),
        }
      : {
          icon: MessageCircle,
          title: tr("Bật bong bóng chat", "Turn on chat bubbles"),
          text: tr("Trả lời ngay trên mọi app, như Messenger.", "Reply from any app, like Messenger."),
          cta: tr("Bật", "Turn on"),
        };
  const Icon = copy.icon;

  return (
    <div className="m-notify" role="region" aria-label={copy.title} data-kind={kind}>
      <span className="m-notify-icon" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="m-notify-copy">
        <span className="m-notify-title">{copy.title}</span>
        <span className="m-notify-text">{copy.text}</span>
      </span>
      <button type="button" className="m-notify-cta" onClick={act} disabled={busy}>
        {copy.cta}
      </button>
      <button type="button" className="m-notify-x" onClick={close} aria-label={tr("Đóng", "Dismiss")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
