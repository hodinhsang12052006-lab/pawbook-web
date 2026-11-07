// Push notifications for 1:1 calls (pure builders — scripts/qa/fcm_payload_unit.mts checks them).
//
// Incoming call: short-lived (the ring lasts ≤ 45 s): TTL 60 s on every push service (FCM android.ttl, APNs
// apns-expiration, Web Push TTL), so a phone that was offline does not get "X is calling you" hours later. Every call
// has its OWN tag ("pn-call-<callId>") and collapse id ("call-<callId>"): a call's follow-up replaces exactly that call's
// notification, never another call's, and an undelivered incoming push is superseded by its follow-up at the push
// service (FCM collapse_key, APNs apns-collapse-id, Web Push Topic).
//
// Follow-up when the call ends without this device answering — same tag, so it REPLACES the incoming-call notification:
//   missed   (caller cancelled / nobody answered / the callee was busy) → "Missed call from X" (kept 24 h)
//   answered (answered on another device of the callee)                → "Call with X · answered on another device"
//   declined (declined on another device of the callee)                 → "Call from X · declined on another device"
// Android app (any build, incl. versionCode 3): when the app is in the background the Firebase SDK draws "notification"
// messages with NotificationManager.notify(android.notification.tag, 0) — a message with the same tag replaces the shown
// one (firebase-messaging 25.0.1 CommonNotificationBuilder.getTag / DisplayNotification). In the foreground nothing is
// drawn (no presentationOptions) and the app clears the call's notification itself (lib/calls/callNotice.ts).
// Web: worker/index.js replaces / closes by tag. versionCode 4 could cancel silently instead (data-only "call-end").
import type { PushPayload } from "@/lib/push";

export const CALL_PUSH_TTL_SEC = 60;
export const MISSED_CALL_TTL_SEC = 24 * 3600;
export const HANDLED_ELSEWHERE_TTL_SEC = 3600;

export type CallType = "audio" | "video";
export type CallEndOutcome = "missed" | "answered" | "declined";

export const callTag = (callId: string) => `pn-call-${callId}`;
/** Web Push Topic / FCM collapse_key / APNs collapse id: ≤ 32 chars of [A-Za-z0-9_-] (callId is [a-z0-9]{4,24}). */
export const callCollapseKey = (callId: string) => `call-${callId}`;

const clean = (name: string) => (name || "").replace(/\s+/g, " ").trim().slice(0, 60) || "PawNail";

export function missedCallText(callerName: string, callType: CallType) {
  const n = clean(callerName);
  return {
    vi: { title: callType === "video" ? `Cuộc gọi video nhỡ từ ${n}` : `Cuộc gọi nhỡ từ ${n}`, body: "Chạm để gọi lại." },
    en: { title: callType === "video" ? `Missed video call from ${n}` : `Missed call from ${n}`, body: "Tap to call back." },
  };
}

/** "X is calling you" — TTL 60 s, per-call tag + collapse id, Android channel "calls". */
export function incomingCallPush(o: { callId: string; callType: CallType; callerId: string; callerName: string; now?: number }): PushPayload {
  const n = clean(o.callerName);
  const now = o.now ?? Date.now();
  const missed = missedCallText(n, o.callType);
  return {
    title: o.callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến",
    body: `${n} đang gọi cho bạn — mở PawNail để trả lời`,
    url: `/messages?to=${o.callerId}`,
    tag: callTag(o.callId),
    channel: "calls",
    kind: "call",
    ttlSec: CALL_PUSH_TTL_SEC,
    collapseKey: callCollapseKey(o.callId),
    exp: now + CALL_PUSH_TTL_SEC * 1000,
    stale: missed.vi,
    en: {
      title: o.callType === "video" ? "Incoming video call" : "Incoming call",
      body: `${n} is calling you. Open PawNail to answer.`,
      stale: missed.en,
    },
  };
}

/** Follow-up that replaces the incoming-call notification of `callId` (same tag / collapse id). */
export function callEndPush(o: { callId: string; callType: CallType; callerId: string; callerName: string; outcome: CallEndOutcome }): PushPayload {
  const n = clean(o.callerName);
  const base = {
    url: `/messages?to=${o.callerId}`,
    tag: callTag(o.callId),
    // Not the high-importance "calls" channel: replacing must not ring again (default importance, no heads-up).
    channel: "general" as const,
    kind: "call-end" as const,
    collapseKey: callCollapseKey(o.callId),
  };
  if (o.outcome === "missed") {
    const t = missedCallText(n, o.callType);
    return { ...base, ...t.vi, ttlSec: MISSED_CALL_TTL_SEC, en: t.en };
  }
  if (o.outcome === "answered") {
    return {
      ...base,
      title: `Cuộc gọi với ${n}`,
      body: "Đã trả lời trên thiết bị khác.",
      ttlSec: HANDLED_ELSEWHERE_TTL_SEC,
      quiet: true,
      en: { title: `Call with ${n}`, body: "Answered on another device." },
    };
  }
  return {
    ...base,
    title: `Cuộc gọi từ ${n}`,
    body: "Đã từ chối trên thiết bị khác.",
    ttlSec: HANDLED_ELSEWHERE_TTL_SEC,
    quiet: true,
    en: { title: `Call from ${n}`, body: "Declined on another device." },
  };
}

/**
 * Which follow-up (if any) a call action triggers, and for whom.
 *  - the CALLER cancels / times out before an answer → the callee missed it;
 *  - the CALLEE answers / declines on one device → the callee's other devices;
 *  - the callee's device reports busy / cannot join (media-error) → the callee missed it.
 * Hang-ups of a connected call, "failed", "answered-elsewhere" (aimed at one device) → nothing.
 */
export function followUpFor(action: string, reason: string | null, iAmCaller: boolean): { outcome: CallEndOutcome; to: "target" | "self" } | null {
  if (iAmCaller) return action === "reject" && (reason === "cancel" || reason === "timeout") ? { outcome: "missed", to: "target" } : null;
  if (action === "accept") return { outcome: "answered", to: "self" };
  if (action === "busy") return { outcome: "missed", to: "self" };
  if (action === "reject" && reason === "decline") return { outcome: "declined", to: "self" };
  if (action === "reject" && reason === "media-error") return { outcome: "missed", to: "self" };
  return null;
}
