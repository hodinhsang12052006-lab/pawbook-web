import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import prisma from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";
import { CALL_ID_RE, CALL_TOKEN_TTL_MS, newCallId, signCallToken, verifyCallToken, type CallClaims } from "@/lib/calls/callToken";
import { LEG_RE, chunkSerialized, isSeq, validateSignalData, type SignalEvent } from "@/lib/calls/signalWire";

// Signaling relay for 1:1 WebRTC calls (media itself goes peer-to-peer or through TURN — never through here).
// Every event lands on the other person's private Pusher channel "private-chat-<id>" (only its owner can subscribe,
// see app/api/pusher/auth). `fromId` is always set by the SERVER from the session, never by the client.
//
// actions:
//   offer  {targetId, callType, callId?, leg}       → "incoming-call" (+ push "pn-call"); returns {callId, callToken}
//   ring   {targetId, callId, callToken, leg}        → "incoming-call" again, no push (caller re-rings every few
//                                                      seconds so a phone that opens PawNail from the push still rings)
//   accept {targetId, callId, callToken, leg, socketId?} → "call-accepted" to the caller + "call-handled" to the
//                                                      callee's OTHER devices (they stop ringing)
//   answering {targetId, callId, callToken, leg}     → "call-answering" to the caller: the callee tapped Answer but its
//                                                      camera/mic prompt is still open — the caller stops its ring timeout
//   reject {targetId, callId, callToken, reason, leg?, toLeg?} → "call-rejected" {fromLeg, toLeg} (decline / cancel /
//                                                      hang-up / timeout / …). fromLeg lets the caller ignore a stale
//                                                      device of the callee once it is talking to another one; toLeg
//                                                      ("answered-elsewhere") stops exactly one device of the callee.
//   busy   {targetId, callId, callToken, leg?}       → "call-busy" {fromLeg}
//   signal {targetId, callId, callToken, fromLeg, toLeg, seq, kind: sdp|ice|ctl, data} → "call-signal" parts
// Every action except offer needs the call token minted by the offer: it binds caller, callee and callId, so a
// stranger cannot inject hang-ups or SDP into somebody else's call.
const ACTIONS = new Set(["offer", "ring", "answering", "accept", "reject", "busy", "signal"]);
const REJECT_REASONS = new Set(["decline", "cancel", "hangup", "timeout", "media-error", "failed", "busy", "answered-elsewhere"]);
// The caller re-rings for at most ~45 s; a token older than this can no longer ring anybody (a modified client could
// otherwise keep ringing a callee for the token's whole 3 h life without any push trail).
const RING_WINDOW_MS = 50_000;
// Answer must come while it can still ring (+ the time a first-time camera/mic prompt may take after "answering").
const ACCEPT_WINDOW_MS = 120_000;
const MAX_BODY = 64 * 1024;
const MINUTE = 60_000;
const SOCKET_ID_RE = /^\d{1,20}\.\d{1,20}$/;

type Json = Record<string, unknown>;
const err = (status: number, vi: string, en: string) => NextResponse.json({ error: vi, errorEn: en }, { status });

// LOCAL QA ONLY (scripts/qa/call_test.mjs places dozens of calls a minute): CALL_RATE_ALLOW_TEST=1 raises every
// limit ×20. Ignored on Vercel — never set it there.
const RATE_SCALE = process.env.CALL_RATE_ALLOW_TEST === "1" && !process.env.VERCEL && !process.env.VERCEL_ENV ? 20 : 1;

function limited(key: string, limit: number, windowMs = MINUTE): boolean {
  if (isRateLimited(key, limit * RATE_SCALE, windowMs)) return true;
  recordAttempt(key, windowMs);
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return err(401, "Bạn cần đăng nhập.", "Please sign in.");

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BODY) return err(413, "Dữ liệu cuộc gọi quá lớn.", "Call data too large.");
    const raw = await req.text();
    if (raw.length > MAX_BODY) return err(413, "Dữ liệu cuộc gọi quá lớn.", "Call data too large.");
    let body: Json;
    try {
      body = JSON.parse(raw);
    } catch {
      return err(400, "Yêu cầu không hợp lệ.", "Invalid request.");
    }
    if (!body || typeof body !== "object") return err(400, "Yêu cầu không hợp lệ.", "Invalid request.");

    const action = body.action;
    const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
    if (typeof action !== "string" || !ACTIONS.has(action) || !targetId || targetId.length > 64) {
      return err(400, "Thiếu hoặc sai thông tin cuộc gọi.", "Missing or invalid call fields.");
    }
    if (targetId === userId) return err(400, "Không thể tự gọi cho chính mình.", "You can't call yourself.");

    // Luật chặn 2 chiều cho MỌI action (trước đây chỉ "offer" → kẻ bị chặn vẫn bắn được hang-up vào cuộc gọi khác).
    const blockExists = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedUserId: targetId },
          { blockerId: targetId, blockedUserId: userId },
        ],
      },
      select: { id: true },
    });
    if (blockExists) return err(403, "Không thể gọi — một trong hai người đã chặn.", "You can't call this person.");

    const pusher = getPusherServer();
    if (!pusher) return err(503, "Cuộc gọi tạm thời không khả dụng.", "Calls are temporarily unavailable.");
    const target = chatChannelName(targetId);
    const own = chatChannelName(userId);
    const socketId = typeof body.socketId === "string" && SOCKET_ID_RE.test(body.socketId) ? body.socketId : undefined;
    // The caller's device ("leg"): the callee sends its WebRTC signals to exactly that tab / phone.
    const leg = typeof body.leg === "string" && LEG_RE.test(body.leg) ? body.leg : null;
    const toLeg = typeof body.toLeg === "string" && LEG_RE.test(body.toLeg) ? body.toLeg : null;

    // ---------- offer (start ringing) ----------
    if (action === "offer") {
      if (limited(`call-offer:${userId}`, 12) || limited(`call-offer:${userId}:${targetId}`, 6)) {
        return err(429, "Bạn gọi quá nhiều lần, thử lại sau ít phút.", "Too many calls. Try again in a minute.");
      }
      const [callee, caller] = await Promise.all([
        prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
      ]);
      if (!callee) return err(404, "Không tìm thấy người nhận.", "That person wasn't found.");
      const callType = body.callType === "video" ? "video" : "audio";
      const callId = typeof body.callId === "string" && CALL_ID_RE.test(body.callId) ? body.callId : newCallId();
      const callToken = signCallToken({ callerId: userId, calleeId: targetId, callId, callType });
      if (!callToken) return err(503, "Cuộc gọi tạm thời không khả dụng.", "Calls are temporarily unavailable.");
      const callerName = caller?.name || session.user?.name || "User";
      await pusher.trigger(target, "incoming-call", {
        fromId: userId,
        callerId: userId,
        callerName,
        callerAvatar: caller?.avatarUrl || null,
        callType,
        callId,
        callToken,
        callerLeg: leg,
      });
      // Cuộc gọi luôn 1-1 → ?to=<người gọi> đúng. Kênh Android "calls" (ưu tiên cao). after(): không bị Vercel cắt giữa chừng.
      const push = {
        title: callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến",
        body: `${callerName} đang gọi cho bạn — mở PawNail để trả lời`,
        url: `/messages?to=${userId}`,
        tag: "pn-call",
        channel: "calls" as const,
        en: { title: callType === "video" ? "Incoming video call" : "Incoming call", body: `${callerName} is calling you. Open PawNail to answer.` },
      };
      after(() => sendPush(targetId, push).catch(() => 0));
      return NextResponse.json({ success: true, callId, callToken });
    }

    // ---------- every other action needs the call token ----------
    const callId = body.callId;
    const claims: CallClaims | null = verifyCallToken(body.callToken, { userId, targetId, callId });
    if (!claims) return err(403, "Cuộc gọi không hợp lệ hoặc đã kết thúc.", "This call is no longer valid.");
    const iAmCaller = claims.c === userId;
    const issuedAt = claims.x - CALL_TOKEN_TTL_MS;

    if (action === "signal") {
      if (limited(`call-signal:${userId}`, 240)) return err(429, "Quá nhiều tín hiệu cuộc gọi.", "Too many call signals.");
      const { fromLeg, toLeg, seq, kind } = body;
      if (typeof fromLeg !== "string" || !LEG_RE.test(fromLeg) || typeof toLeg !== "string" || !LEG_RE.test(toLeg) || !isSeq(seq)) {
        return err(400, "Tín hiệu cuộc gọi không hợp lệ.", "Invalid call signal.");
      }
      const v = validateSignalData(kind, body.data);
      if (!v.ok) return v.status === 413 ? err(413, "Dữ liệu cuộc gọi quá lớn.", "Call data too large.") : err(400, "Tín hiệu cuộc gọi không hợp lệ.", "Invalid call signal.");
      const parts = chunkSerialized(JSON.stringify(v.data));
      if (!parts) return err(413, "Dữ liệu cuộc gọi quá lớn.", "Call data too large.");
      const events = parts.map((d, part) => {
        const data: SignalEvent = { fromId: userId, callId: claims.i, fromLeg, toLeg, seq, kind: kind as SignalEvent["kind"], part, parts: parts.length, d };
        return { channel: target, name: "call-signal", data };
      });
      if (events.length === 1) await pusher.trigger(target, "call-signal", events[0].data);
      else await pusher.triggerBatch(events);
      return NextResponse.json({ success: true, parts: parts.length });
    }

    if (action === "ring") {
      if (!iAmCaller || Date.now() > issuedAt + RING_WINDOW_MS) return err(403, "Cuộc gọi không hợp lệ hoặc đã kết thúc.", "This call is no longer valid.");
      if (limited(`call-ring:${userId}`, 20)) return err(429, "Bạn gọi quá nhiều lần, thử lại sau ít phút.", "Too many calls. Try again in a minute.");
      const caller = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } });
      await pusher.trigger(target, "incoming-call", {
        fromId: userId,
        callerId: userId,
        callerName: caller?.name || session.user?.name || "User",
        callerAvatar: caller?.avatarUrl || null,
        callType: claims.t,
        callId: claims.i,
        callToken: body.callToken,
        callerLeg: leg,
        ring: true,
      });
      return NextResponse.json({ success: true });
    }

    if (limited(`call-ctl:${userId}`, 60)) return err(429, "Thao tác quá nhanh, thử lại sau.", "Too many requests. Try again later.");

    // "Stop ringing" on my OTHER devices is best effort: the call itself must not fail because of it.
    const handledElsewhere = (how: string) =>
      pusher.trigger(own, "call-handled", { fromId: userId, callId: claims.i, how }, socketId ? { socket_id: socketId } : undefined).catch((e: unknown) => {
        console.warn("call-handled trigger failed:", e instanceof Error ? e.message : e);
      });

    if (action === "answering") {
      if (iAmCaller || !leg || Date.now() > issuedAt + ACCEPT_WINDOW_MS) return err(403, "Cuộc gọi không hợp lệ hoặc đã kết thúc.", "This call is no longer valid.");
      await pusher.trigger(target, "call-answering", { fromId: userId, callId: claims.i, leg });
      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      if (iAmCaller || Date.now() > issuedAt + ACCEPT_WINDOW_MS) return err(403, "Cuộc gọi không hợp lệ hoặc đã kết thúc.", "This call is no longer valid.");
      if (!leg) return err(400, "Thiếu hoặc sai thông tin cuộc gọi.", "Missing or invalid call fields.");
      // Only call-accepted decides the answer: if it fails the callee is told; call-handled is best effort.
      await Promise.all([
        pusher.trigger(target, "call-accepted", { fromId: userId, callId: claims.i, leg }),
        // Các máy KHÁC của chính mình ngừng đổ chuông (máy vừa nghe bị loại trừ bằng socket_id).
        handledElsewhere("accepted"),
      ]);
      return NextResponse.json({ success: true });
    }

    if (action === "reject" || action === "busy") {
      const reason = action === "busy" ? "busy" : typeof body.reason === "string" && REJECT_REASONS.has(body.reason) ? body.reason : "hangup";
      const jobs: Promise<unknown>[] = [
        action === "busy"
          ? pusher.trigger(target, "call-busy", { fromId: userId, callId: claims.i, fromLeg: leg })
          : pusher.trigger(target, "call-rejected", { fromId: userId, callId: claims.i, reason, fromLeg: leg, toLeg }),
      ];
      // Người nhận từ chối / báo bận trên 1 máy → các máy khác của họ cũng ngừng đổ chuông.
      if (!iAmCaller && (reason === "decline" || reason === "busy" || reason === "media-error")) jobs.push(handledElsewhere(reason));
      await Promise.all(jobs);
      return NextResponse.json({ success: true });
    }

    return err(400, "Thiếu hoặc sai thông tin cuộc gọi.", "Missing or invalid call fields.");
  } catch (error) {
    console.error("Calls API error:", error instanceof Error ? error.message : error);
    return err(502, "Không gửi được tín hiệu cuộc gọi. Thử lại.", "Couldn't reach the call service. Try again.");
  }
}
