"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WifiOff, MessageCircle, RefreshCw } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

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
}

// Không vào được phòng sau ngần này → coi như kết nối thất bại.
const PEER_TIMEOUT_MS = 30_000;

export default function VideoCallRoom({ roomId, userId, userName, mode, peerId, onConnected, onLeave, onPeerLeft }: VideoCallRoomProps) {
  useTr(); // render lại khi đổi VI/EN
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zpRef = useRef<any>(null);
  // Node DOM riêng cho SDK (React không quản lý) — xem cleanup bên dưới.
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
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
    let peerWatcher: MutationObserver | null = null;
    const peerTimer = setTimeout(() => {
      if (!cancelled && !peerSeen) setCallError(tr("Không kết nối được cuộc gọi. Kiểm tra mạng rồi thử lại.", "Couldn't connect the call. Check your connection and try again."));
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
        // Xin token SONG SONG với việc nạp SDK (trước đây làm lần lượt).
        const [{ ZegoUIKitPrebuilt }, tokenRes] = await Promise.all([
          import("@zegocloud/zego-uikit-prebuilt"),
          fetch("/api/zego/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, userName }),
          }),
        ]);
        if (cancelled) return;
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          throw new Error(err.error || tr("Không lấy được token cuộc gọi.", "Couldn't get a call token."));
        }
        const { token: kitToken } = await tokenRes.json();

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        if (cancelled) {
          try { zp.destroy(); } catch {}
          return;
        }
        zpRef.current = zp;

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
        peerWatcher?.observe(mount, { childList: true, subtree: true });

        zp.joinRoom({
          container: mount,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: mode === "video",
          turnOnMicrophoneWhenJoining: true,
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
            cbRef.current.onLeave?.();
          },
        });
      } catch (err) {
        console.error("❌ Không khởi tạo được cuộc gọi ZEGOCLOUD:", err);
        if (!cancelled) setCallError(tr("Không kết nối được dịch vụ gọi. Vui lòng thử lại hoặc chuyển sang nhắn tin.", "Couldn't reach the call service. Try again or switch to messaging."));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(peerTimer);
      peerWatcher?.disconnect();
    };
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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-8 text-center backdrop-blur-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
            <WifiOff className="h-6 w-6 text-rose-400" />
          </div>
          <p className="max-w-xs text-sm font-semibold text-slate-100">{callError}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => { setCallError(null); setRetryKey((k) => k + 1); }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-100 transition-all hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />{tr(" Thử lại", " Try again")}
            </button>
            <button
              onClick={() => cbRef.current.onLeave?.()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />{tr(" Chuyển sang nhắn tin", " Switch to messaging")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
