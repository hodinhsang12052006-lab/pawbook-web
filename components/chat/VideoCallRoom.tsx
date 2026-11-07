"use client";

import { apiError } from "@/lib/i18n/apiError";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WifiOff, MessageCircle, RefreshCw, MicOff } from "lucide-react";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { callPlatform, checkCallMedia, mediaProblemText, zegoJoinErrorText } from "@/lib/callMedia";

// Phòng gọi 1-1 qua ZEGOCLOUD cho CẢ gọi thoại lẫn video. Trước đây gọi thoại
// dùng WebRTC tự dựng chỉ có STUN (không TURN) — mạng 4G/5G (NAT nhà mạng)
// thường không kết nối được; ZEGOCLOUD có máy chủ trung chuyển nên ổn định.
//
// Chỉ dùng MỘT thanh điều khiển: thanh có sẵn của ZEGOCLOUD (mic, camera,
// cài đặt thiết bị, cúp máy — thật sự điều khiển luồng media). Trước đây có 3
// thanh chồng lên nhau, 2 trong số đó không điều khiển được gì.
interface VideoCallRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  mode: "audio" | "video";
  /** userId (của app) của người bên kia — để nhận biết luồng media của họ. */
  peerId: string;
  /** Đối phương đã vào phòng — media 2 chiều sẵn sàng. */
  onConnected?: () => void;
  /** Mình bấm cúp máy (nút của ZEGOCLOUD). */
  onLeave?: () => void;
  /** Đối phương rời phòng (cúp máy / mất mạng). */
  onPeerLeft?: () => void;
  /** Lựa chọn lúc đang đổ chuông: vào phòng với micro / camera bật hay tắt. */
  micOn?: boolean;
  camOn?: boolean;
}

// Không vào được phòng sau ngần này → coi như kết nối thất bại.
const PEER_TIMEOUT_MS = 30_000;

/** Lỗi hiện trên màn gọi: câu chính + hướng dẫn (bật quyền…); perm = lỗi quyền micro / camera (icon micro gạch). */
type CallError = { title: string; hint?: string; perm?: boolean };
/** Máy chủ trả lỗi khi xin token (chưa cấu hình, không có quyền vào phòng…) — câu của máy chủ đã đúng ngôn ngữ, hiện nguyên. */
class TokenError extends Error {}

/** Ẩn hộp thoại "Login room Failed" của UIKit (gắn vào body trên điện thoại, vào khung phòng trên máy tính) — app tự báo lỗi. */
function hideZegoLoginAlert(mount: HTMLElement | null) {
  const RX = /Login room Failed|登录房间失败/;
  const run = () => {
    for (const el of Array.from(document.body.children) as HTMLElement[]) {
      if (el === mount || el.querySelector("[data-call-phase]")) continue;
      if (RX.test(el.textContent || "") && (el.textContent || "").length < 600) el.style.display = "none";
    }
    if (!mount) return;
    const leaf = Array.from(mount.querySelectorAll<HTMLElement>("*")).find((d) => d.children.length === 0 && RX.test(d.textContent || ""));
    let n: HTMLElement | null = leaf ?? null;
    while (n && n.parentElement && n.parentElement !== mount && (n.parentElement.textContent || "").length < 600) n = n.parentElement;
    if (n && n !== mount) n.style.display = "none";
  };
  // hộp thoại có thể hiện sau câu báo của app vài nhịp
  [0, 150, 500, 1200].forEach((ms) => setTimeout(run, ms));
}

export default function VideoCallRoom({ roomId, userId, userName, mode, peerId, onConnected, onLeave, onPeerLeft, micOn = true, camOn = true }: VideoCallRoomProps) {
  useTr(); // render lại khi đổi VI/EN
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zpRef = useRef<any>(null);
  // Node DOM riêng cho SDK (React không quản lý) — xem cleanup bên dưới.
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [callError, setCallError] = useState<CallError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Callback mới nhất mà không phải join lại phòng khi component cha re-render.
  const cbRef = useRef({ onConnected, onLeave, onPeerLeft });
  useEffect(() => {
    cbRef.current = { onConnected, onLeave, onPeerLeft };
  }, [onConnected, onLeave, onPeerLeft]);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    // StrictMode chạy effect 2 lần — cờ này chặn lần 1 (đã cleanup) join phòng.
    let cancelled = false;
    let peerSeen = false;
    // Đã đăng nhập phòng ZEGOCLOUD (LOGINED) + mã lỗi đăng nhập gần nhất
    let loggedIn = false;
    let failCode = 0;
    // Người dùng tự bấm nút cúp máy của UIKit (kể cả khi chưa đăng nhập xong phòng — mạng chậm) → cúp máy bình thường.
    let userHungUp = false;
    let peerWatcher: MutationObserver | null = null;
    let showJoinFailure: (() => void) | null = null;
    const peerTimer = setTimeout(() => {
      // lỗi cụ thể hơn (quyền, đăng nhập phòng bị từ chối…) đã hiện thì giữ nguyên
      if (!cancelled && !peerSeen) setCallError((e) => e ?? { title: tr("Không kết nối được cuộc gọi. Kiểm tra mạng rồi thử lại.", "Couldn't connect the call. Check your connection and try again.") });
    }, PEER_TIMEOUT_MS);
    const markConnected = () => {
      if (cancelled) return;
      peerSeen = true;
      clearTimeout(peerTimer);
      setCallError(null);
      cbRef.current.onConnected?.();
    };

    (async () => {
      try {
        setCallError(null);
        // Token sinh phía server (app/api/zego/token) — chỉ cấp cho đúng người
        // trong đúng phòng, secret không bao giờ nằm trong bundle JS.
        // Xin token + nạp SDK + xin quyền micro / camera SONG SONG. Quyền xin TRƯỚC khi vào phòng: bị chặn thì nói rõ + chỉ chỗ
        // bật (trước đây ZEGOCLOUD vẫn vào phòng — bên kia không nghe gì, không ai biết vì sao). App Android: lời xin này mở hộp
        // thoại quyền của Android (BridgeWebChromeClient của Capacitor) trước khi SDK cần tới.
        const wantVideo = mode === "video" && camOn;
        const [{ ZegoUIKitPrebuilt }, tokenRes, media] = await Promise.all([
          import("@zegocloud/zego-uikit-prebuilt"),
          fetch("/api/zego/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, userName }),
          }),
          checkCallMedia(wantVideo),
        ]);
        if (cancelled) return;
        if (media.problem) {
          clearTimeout(peerTimer);
          setCallError({ ...mediaProblemText(media.problem, wantVideo, callPlatform()), perm: media.problem === "denied" });
          return;
        }
        if (media.camProblem) {
          toast(tr("Không mở được máy ảnh — bạn sẽ vào cuộc gọi với máy ảnh tắt.", "Camera unavailable — joining with your camera off."), { icon: "📷", id: "pn-call-cam" });
        }
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          throw new TokenError(apiError(err, "Không lấy được token cuộc gọi.", "Couldn't get a call token."));
        }
        const { token: kitToken } = await tokenRes.json();

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        if (cancelled) {
          try { zp.destroy(); } catch {}
          return;
        }
        zpRef.current = zp;
        // Đăng nhập phòng bị ZEGOCLOUD từ chối (token / App ID sai, dự án bị tạm dừng, mạng chặn…): SDK chỉ hiện hộp thoại
        // tiếng Anh của nó và onJoinRoom vẫn bắn → trước đây phải chờ 30s mới có câu "kiểm tra mạng" (sai). Báo ngay kèm mã.
        // UIKit gặp lỗi đăng nhập thì tự rời phòng (onLeaveRoom → trước đây cúp máy cả 2 bên, màn gọi biến mất) và để lại hộp
        // thoại tiếng Anh "Login room Failed" nằm đè trang chat. Giờ: giữ màn gọi + câu báo của app (EN / VI, có mã), ẩn hộp thoại đó.
        showJoinFailure = () => {
          if (cancelled || peerSeen || userHungUp) return;
          clearTimeout(peerTimer);
          setCallError({ title: zegoJoinErrorText(failCode) });
          hideZegoLoginAlert(mountRef.current);
        };
        try {
          // d.ts của UIKit khai `express` là {} — thực tế là ZegoExpressEngine (on() thêm 1 listener, không thay listener của UIKit)
          const express = zp.express as unknown as { on?: (ev: string, cb: (room: string, reason: string, code: number) => void) => boolean } | undefined;
          express?.on?.("roomStateChanged", (_room, reason, code) => {
            if (reason === "LOGINED" || reason === "RECONNECTED") loggedIn = true;
            if (cancelled || peerSeen) return;
            if (reason === "LOGIN_FAILED" || reason === "RECONNECT_FAILED" || reason === "KICKOUT") {
              console.warn("ZEGOCLOUD room", reason, code);
              failCode = Number(code) || 0;
              showJoinFailure?.();
            }
          });
        } catch {}

        // Khung media của đối phương: id dạng "<roomId>_<peerId>[_callId]_main".
        peerWatcher = new MutationObserver(() => {
          if (mountRef.current?.querySelector(`[id^="${roomId}_${peerId}"][id$="_main"]`)) {
            peerWatcher?.disconnect();
            markConnected();
          }
        });

        // SDK render vào 1 node con tự tạo thay vì thẳng vào node của React.
        const mount = document.createElement("div");
        mount.style.width = "100%";
        mount.style.height = "100%";
        containerRef.current?.appendChild(mount);
        mountRef.current = mount;
        // Nút cúp máy của UIKit có id cố định (điện thoại / máy tính). Bắt ở pha capture: biết là NGƯỜI DÙNG rời phòng trước khi
        // SDK gọi onLeaveRoom (SDK cũng gọi onLeaveRoom khi tự bỏ cuộc vì lỗi đăng nhập).
        mount.addEventListener(
          "click",
          (e) => {
            if ((e.target as Element | null)?.closest?.("#ZegoRoomMobileLeaveButton, #ZegoRoomLeaveButton")) userHungUp = true;
          },
          true,
        );
        peerWatcher?.observe(mount, { childList: true, subtree: true });

        zp.joinRoom({
          container: mount,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: media.video,
          turnOnMicrophoneWhenJoining: micOn,
          showMyCameraToggleButton: mode === "video",
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: false,
          showTextChat: false,
          showUserList: false,
          showLayoutButton: false,
          showRoomDetailsButton: false,
          showMoreButton: false,
          showPinButton: false,
          showPreJoinView: false,
          showLeavingView: false,
          showLeaveRoomConfirmDialog: false,
          showRoomTimer: true,
          showNonVideoUser: true,
          showOnlyAudioUser: true,
          // onUserJoin CHỈ bắn cho người vào SAU mình — người vào sau không bao
          // giờ nhận sự kiện cho người đã có sẵn trong phòng. Vì vậy còn theo
          // dõi thêm DOM: khi khung media của đối phương xuất hiện là đã thông
          // (xem MutationObserver bên dưới). onJoinRoom KHÔNG dùng được — nó
          // bắn ngay cả khi đăng nhập phòng thất bại.
          onUserJoin: markConnected,
          onUserLeave: () => {
            cbRef.current.onPeerLeft?.();
          },
          onLeaveRoom: () => {
            // Chưa vào được phòng mà người dùng KHÔNG bấm cúp máy = SDK bỏ cuộc vì lỗi đăng nhập → không cúp máy im lặng; báo lỗi
            // (mã tới trễ 1 nhịp: listener của SDK chạy qua setTimeout) để người dùng chọn Thử lại / Nhắn tin.
            // Người dùng bấm cúp máy khi phòng còn đang đăng nhập (mạng chậm) → cúp máy luôn, bên kia thôi đổ chuông.
            if (!loggedIn && !peerSeen && !userHungUp) {
              setTimeout(() => showJoinFailure?.(), 400);
              return;
            }
            cbRef.current.onLeave?.();
          },
        });
      } catch (err) {
        console.error("❌ Không khởi tạo được cuộc gọi ZEGOCLOUD:", err);
        clearTimeout(peerTimer);
        if (!cancelled)
          setCallError({
            title: err instanceof TokenError && err.message ? err.message : tr("Không kết nối được dịch vụ gọi. Vui lòng thử lại hoặc chuyển sang nhắn tin.", "Couldn't reach the call service. Try again or switch to messaging."),
          });
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(peerTimer);
      peerWatcher?.disconnect();
    };
    // micOn/camOn chỉ đọc lúc vào phòng — đổi giữa chừng do thanh điều khiển của ZEGOCLOUD lo, không join lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName, mode, peerId, retryKey]);

  // Khi đóng cuộc gọi: chuyển node của SDK ra body (ẩn) TRƯỚC khi React gỡ
  // khung, huỷ phòng trong lúc DOM của SDK vẫn còn, rồi mới xoá node. Trước
  // đây SDK vẫn chạy vài tác vụ dọn dẹp bất đồng bộ sau khi khung bị gỡ và
  // văng lỗi "Cannot read properties of null (reading 'createSpan')".
  useLayoutEffect(() => {
    return () => {
      const zp = zpRef.current;
      const mount = mountRef.current;
      zpRef.current = null;
      mountRef.current = null;
      if (mount) {
        mount.style.display = "none";
        document.body.appendChild(mount);
      }
      // Huỷ hơi trễ: nếu huỷ ngay lúc SDK còn đang tự rời phòng (người dùng vừa
      // bấm cúp máy), module tracing nội bộ của SDK văng lỗi createSpan.
      setTimeout(() => {
        if (zp) {
          try { zp.destroy(); } catch {}
        }
        mount?.remove();
      }, 1500);
    };
  }, [roomId, mode, retryKey]);

  return (
    <div className="relative h-full w-full overflow-clip bg-slate-950 md:rounded-[1.75rem] md:border md:border-white/10 md:shadow-2xl md:shadow-black/50">
      <div ref={containerRef} className="h-full w-full" />

      {callError && (
        <div role="alert" data-call-error={callError.perm ? "permission" : "other"} className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 py-8 text-center backdrop-blur-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
            {callError.perm ? <MicOff className="h-6 w-6 text-rose-400" /> : <WifiOff className="h-6 w-6 text-rose-400" />}
          </div>
          <p className="max-w-xs text-[15px] font-semibold leading-snug text-slate-100">{callError.title}</p>
          {callError.hint && <p className="max-w-xs text-[13px] leading-relaxed text-slate-300">{callError.hint}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => { setCallError(null); setRetryKey((k) => k + 1); }}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-100 transition-all hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />{tr(" Thử lại", " Try again")}
            </button>
            <button
              onClick={() => cbRef.current.onLeave?.()}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />{tr(" Chuyển sang nhắn tin", " Switch to messaging")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
