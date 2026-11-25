// Web ↔ phần cuộc gọi native của app Android (versionCode 4+, android/.../PawNailNativePlugin.java):
//   - startOngoingCall / updateOngoingCall / stopOngoingCall: foreground service "đang trong cuộc gọi" (micro / camera chạy
//     tiếp khi rời app hay tắt màn hình), giữ màn hình sáng khi gọi video, cảm biến tiệm cận khi nghe bằng loa trong;
//   - setAudioRoute / getAudioState + sự kiện "callAudio": nút Loa (loa trong ↔ loa ngoài; tai nghe / Bluetooth tự được
//     ưu tiên; cắm / rút tai nghe giữa cuộc gọi → app chọn lại đường và báo trạng thái mới);
//   - takeCallAction + sự kiện "callAction": nút Kết thúc của thông báo đang gọi, nút Trả lời / Từ chối của thông báo
//     cuộc gọi đến.
// DÒ TỪNG HÀM trong danh sách plugin mà app tiêm vào trang (window.Capacitor.PluginHeaders) — bản app cũ (≤ 3) không có
// các hàm này: mọi hàm ở đây thành no-op / null và CallManager giữ hành vi cũ (báo "rời app", nút loa setSinkId…). Gọi
// hàm không có trên bản cũ làm Capacitor ném "not implemented" — không bao giờ được để lỗi đó lọt ra.
// Hàm thuần (nhận plugin + headers qua tham số) — scripts/qa/native_call_unit.mts kiểm thử bằng plugin giả.

export type AudioRoute = "earpiece" | "speaker" | "headset" | "bluetooth";
export interface NativeAudioState {
  /** chế độ âm thanh cuộc gọi đang bật (đã startOngoingCall) */
  active: boolean;
  route: AudioRoute | null;
  /** máy có loa trong (điện thoại; máy tính bảng thường không) */
  earpiece: boolean;
  headset: boolean;
  bluetooth: boolean;
}
export type OngoingState = "calling" | "connecting" | "connected";
export interface OngoingCallParams {
  peerName: string;
  /** bố cục video (giữ màn hình sáng) */
  video: boolean;
  /** camera của CHÍNH MÌNH đang bật (foreground service khai thêm loại camera) */
  camera: boolean;
  state: OngoingState;
  /** lúc thông (ms) — đồng hồ trên thông báo */
  since?: number | null;
}
export interface OngoingResult {
  /** foreground service thật sự chạy (micro được giữ khi rời app) */
  started: boolean;
  audio: NativeAudioState | null;
}
export interface CallAction {
  action: "hangup" | "answer" | "declined";
  callId?: string;
}

type Raw = Record<string, unknown> | null | undefined;
export interface NativeCallPluginLike {
  startOngoingCall(o: OngoingCallParams): Promise<Raw>;
  updateOngoingCall(o: OngoingCallParams): Promise<Raw>;
  stopOngoingCall(): Promise<unknown>;
  setAudioRoute(o: { route: "speaker" | "earpiece" | "auto" }): Promise<Raw>;
  getAudioState(): Promise<Raw>;
  takeCallAction(): Promise<Raw>;
  addListener(event: "callAction" | "callAudio", cb: (data: Raw) => void): Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
}
export interface PluginHeader {
  name: string;
  methods?: { name: string }[];
}

export const NATIVE_CALL_METHODS = ["startOngoingCall", "updateOngoingCall", "stopOngoingCall", "setAudioRoute", "getAudioState", "takeCallAction"] as const;
const CALL_ID_RE = /^[a-z0-9]{4,24}$/;
const ROUTES: AudioRoute[] = ["earpiece", "speaker", "headset", "bluetooth"];
const STATES: OngoingState[] = ["calling", "connecting", "connected"];

export function normAudioState(raw: unknown): NativeAudioState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const route = ROUTES.includes(r.route as AudioRoute) ? (r.route as AudioRoute) : null;
  return { active: r.active === true, route, earpiece: r.earpiece === true, headset: r.headset === true, bluetooth: r.bluetooth === true };
}

export function normCallAction(raw: unknown): CallAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.action === "hangup") return { action: "hangup" };
  if ((r.action === "answer" || r.action === "declined") && typeof r.callId === "string" && CALL_ID_RE.test(r.callId)) return { action: r.action, callId: r.callId };
  return null;
}

/** Tham số gửi xuống app: tên gọn (≤ 80), trạng thái hợp lệ, since số nguyên dương hoặc bỏ. */
export function normOngoingParams(p: OngoingCallParams): OngoingCallParams {
  const since = typeof p.since === "number" && Number.isFinite(p.since) && p.since > 0 ? Math.trunc(p.since) : undefined;
  return {
    peerName: String(p.peerName ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    video: !!p.video,
    camera: !!p.camera,
    state: STATES.includes(p.state) ? p.state : "connected",
    ...(since ? { since } : {}),
  };
}

/** Nút Loa: đang loa ngoài → nghe riêng (loa trong / tai nghe), còn lại → loa ngoài. */
export const nextAudioRequest = (route: AudioRoute | null): "speaker" | "earpiece" => (route === "speaker" ? "earpiece" : "speaker");

/** Có gì để chuyển: máy có loa trong hoặc đang nối tai nghe / Bluetooth (máy tính bảng không tai nghe → không). */
export const canSwitchNativeAudio = (s: NativeAudioState | null): boolean => !!s && s.active && (s.earpiece || s.headset || s.bluetooth);

export function createNativeCallBridge(deps: {
  isAndroidApp: () => boolean;
  headers: () => PluginHeader[] | null | undefined;
  plugin: () => NativeCallPluginLike | null;
  pluginName?: string;
}) {
  const name = deps.pluginName ?? "PawNailNative";
  const has = (method: string): boolean => {
    try {
      if (!deps.isAndroidApp()) return false;
      const h = deps.headers()?.find((x) => x?.name === name);
      return !!h?.methods?.some((m) => m?.name === method);
    } catch {
      return false;
    }
  };
  const supported = () => NATIVE_CALL_METHODS.every(has);
  const plugin = () => (supported() ? deps.plugin() : null);
  /** addListener an toàn: bản cũ / lỗi → no-op; huỷ trước khi addListener xong vẫn gỡ được. */
  const listen = <T,>(event: "callAction" | "callAudio", norm: (raw: unknown) => T | null, cb: (x: T) => void): (() => void) => {
    const pl = plugin();
    if (!pl) return () => {};
    let removed = false;
    let handle: { remove: () => Promise<void> | void } | null = null;
    try {
      const res = pl.addListener(event, (data) => {
        if (removed) return;
        const x = norm(data);
        if (x) cb(x);
      });
      Promise.resolve(res)
        .then((h) => {
          handle = h;
          if (removed) void Promise.resolve(h?.remove?.()).catch(() => {});
        })
        .catch(() => {});
    } catch {
      return () => {};
    }
    return () => {
      removed = true;
      if (handle) void Promise.resolve(handle.remove?.()).catch(() => {});
    };
  };
  const ongoing = async (method: "startOngoingCall" | "updateOngoingCall", p: OngoingCallParams): Promise<OngoingResult> => {
    const pl = plugin();
    if (!pl) return { started: false, audio: null };
    try {
      const r = (await pl[method](normOngoingParams(p))) as Record<string, unknown> | null;
      return { started: r?.started === true, audio: normAudioState(r?.audio) };
    } catch {
      return { started: false, audio: null };
    }
  };

  return {
    /** App Android có đủ các hàm cuộc gọi native (versionCode 4+). */
    supported,
    start: (p: OngoingCallParams) => ongoing("startOngoingCall", p),
    update: (p: OngoingCallParams) => ongoing("updateOngoingCall", p),
    async stop(): Promise<void> {
      const pl = plugin();
      if (!pl) return;
      try {
        await pl.stopOngoingCall();
      } catch {}
    },
    async setRoute(route: "speaker" | "earpiece" | "auto"): Promise<NativeAudioState | null> {
      const pl = plugin();
      if (!pl) return null;
      try {
        return normAudioState(await pl.setAudioRoute({ route }));
      } catch {
        return null;
      }
    },
    async audioState(): Promise<(NativeAudioState & { ongoing: boolean }) | null> {
      const pl = plugin();
      if (!pl) return null;
      try {
        const r = await pl.getAudioState();
        const s = normAudioState(r);
        return s ? { ...s, ongoing: (r as Record<string, unknown>)?.ongoing === true } : null;
      } catch {
        return null;
      }
    },
    /** Hành động đang chờ từ thông báo (mở nguội bằng nút Trả lời) — lấy 1 lần. */
    async takeAction(): Promise<CallAction | null> {
      const pl = plugin();
      if (!pl) return null;
      try {
        return normCallAction(await pl.takeCallAction());
      } catch {
        return null;
      }
    },
    /** Nghe sự kiện "callAction" của app; trả hàm huỷ. Bản cũ: không làm gì. */
    onAction: (cb: (a: CallAction) => void): (() => void) => listen("callAction", normCallAction, cb),
    /** Nghe sự kiện "callAudio" (đường âm thanh đổi vì cắm / rút / nối thiết bị giữa cuộc gọi); trả hàm huỷ. */
    onAudio: (cb: (s: NativeAudioState) => void): (() => void) => listen("callAudio", normAudioState, cb),
  };
}

export type NativeCallBridge = ReturnType<typeof createNativeCallBridge>;
