"use client";

import { callTag } from "./callPush";
import { clearNativeNotificationsByTag, ownNativePushToken } from "@/lib/nativePush";

/** Body field for /api/calls accept / decline: this device's native push token, so its own tray gets no follow-up. */
export function ownPushTokenField(): { pushToken?: string } {
  const t = ownNativePushToken();
  return t && t.length <= 4096 ? { pushToken: t } : {};
}

// This device answered / declined a call, or another device of the same account did (call-handled): remove the call's
// "X is calling you" notification from the tray right away — the follow-up push (lib/calls/callPush.ts) only replaces it
// when the app is in the background, and an Android app in the FOREGROUND draws nothing for a push (no
// presentationOptions), so a notification shown while the app was in the background would otherwise stay.
// Web: notifications of this origin's service worker. Native (any app build with the push plugin, incl. versionCode 3):
// PushNotifications.getDeliveredNotifications / removeDeliveredNotifications. Missed calls are NOT cleared here: their
// follow-up push turns the notification into "Missed call from X".
export function clearCallNotice(callId: string | null | undefined): void {
  if (!callId || typeof window === "undefined") return;
  const tags = [callTag(callId), "pn-call"];
  try {
    navigator.serviceWorker
      ?.getRegistration()
      .then((reg) => reg?.getNotifications())
      .then((list) => list?.filter((n) => tags.includes(n.tag)).forEach((n) => n.close()))
      .catch(() => {});
  } catch {}
  clearNativeNotificationsByTag(tags).catch(() => 0);
}
