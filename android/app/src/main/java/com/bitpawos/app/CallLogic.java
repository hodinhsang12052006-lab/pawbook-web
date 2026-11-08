package com.bitpawos.app;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Quyết định THUẦN (không cần thiết bị) của cuộc gọi native (versionCode 4+) — kiểm thử: CallLogicTest
 * (./gradlew :app:testDebugUnitTest).
 *  - đường âm thanh: loa trong / loa ngoài / tai nghe (CallAudio);
 *  - cảm biến tiệm cận, giữ màn hình sáng, loại foreground service (OngoingCallService);
 *  - thông báo cuộc gọi đến / kết thúc cùng tag (CallNotifications).
 */
final class CallLogic {

    private CallLogic() {}

    // ---------------------------------------------------------------------------------
    // Âm thanh
    // ---------------------------------------------------------------------------------

    static final String ROUTE_EARPIECE = "earpiece";
    static final String ROUTE_SPEAKER = "speaker";
    /** Tai nghe cắm dây / USB. */
    static final String ROUTE_HEADSET = "headset";
    static final String ROUTE_BLUETOOTH = "bluetooth";

    // android.media.AudioDeviceInfo.TYPE_* (hằng số lúc biên dịch — dùng được trong unit test JVM)
    static final int DEVICE_BUILTIN_EARPIECE = 1;
    static final int DEVICE_BUILTIN_SPEAKER = 2;
    static final int DEVICE_WIRED_HEADSET = 3;
    static final int DEVICE_WIRED_HEADPHONES = 4;
    static final int DEVICE_BLUETOOTH_SCO = 7;
    static final int DEVICE_USB_HEADSET = 22;
    static final int DEVICE_BLE_HEADSET = 26;

    /** Route của một loại thiết bị âm thanh (đầu ra), hoặc null nếu cuộc gọi không dùng loại đó. */
    static String routeOfDevice(int type) {
        switch (type) {
            case DEVICE_BUILTIN_EARPIECE:
                return ROUTE_EARPIECE;
            case DEVICE_BUILTIN_SPEAKER:
                return ROUTE_SPEAKER;
            case DEVICE_WIRED_HEADSET:
            case DEVICE_WIRED_HEADPHONES:
            case DEVICE_USB_HEADSET:
                return ROUTE_HEADSET;
            case DEVICE_BLUETOOTH_SCO:
            case DEVICE_BLE_HEADSET:
                return ROUTE_BLUETOOTH;
            default:
                return null;
        }
    }

    /**
     * Đường âm thanh thật cho lựa chọn của nút Loa (requested) hoặc mặc định (requested null / "auto"):
     *  - "speaker" → loa ngoài, kể cả khi đang cắm tai nghe (người dùng chủ động chọn);
     *  - "earpiece" (nghe riêng) → tai nghe cắm dây / USB nếu có, rồi Bluetooth, rồi loa trong; máy không có loa trong
     *    (máy tính bảng) → loa ngoài;
     *  - mặc định: gọi thoại như "earpiece" (giống cuộc gọi điện thoại); gọi video → tai nghe / Bluetooth nếu có, không
     *    thì loa ngoài.
     */
    static String chooseRoute(String requested, boolean video, boolean hasEarpiece, boolean hasHeadset, boolean hasBluetooth) {
        if (ROUTE_SPEAKER.equals(requested)) return ROUTE_SPEAKER;
        boolean privateWanted = ROUTE_EARPIECE.equals(requested) || !video;
        if (hasHeadset) return ROUTE_HEADSET;
        if (hasBluetooth) return ROUTE_BLUETOOTH;
        return privateWanted && hasEarpiece ? ROUTE_EARPIECE : ROUTE_SPEAKER;
    }

    /** Lần bấm nút Loa kế tiếp: đang loa ngoài → nghe riêng (loa trong / tai nghe), còn lại → loa ngoài. */
    static String nextRequest(String currentRoute) {
        return ROUTE_SPEAKER.equals(currentRoute) ? ROUTE_EARPIECE : ROUTE_SPEAKER;
    }

    /** Cảm biến tiệm cận (tắt màn hình khi áp máy vào tai): chỉ cuộc gọi THOẠI đang nghe bằng loa trong. */
    static boolean useProximity(boolean video, String route, boolean supported) {
        return supported && !video && ROUTE_EARPIECE.equals(route);
    }

    /** Giữ màn hình sáng (FLAG_KEEP_SCREEN_ON): cuộc gọi đang hiện video. */
    static boolean keepScreenOn(boolean video) {
        return video;
    }

    // ---------------------------------------------------------------------------------
    // Foreground service "đang trong cuộc gọi"
    // ---------------------------------------------------------------------------------

    // android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_* (API 30)
    static final int FGS_CAMERA = 0x40;
    static final int FGS_MICROPHONE = 0x80;

    /**
     * Loại foreground service cho startForeground:
     *  - -1: không chạy (chưa có quyền micro — không có cuộc gọi nào để giữ);
     *  - API < 30: 0 (startForeground không loại; giới hạn "while-in-use" của micro / camera chỉ có từ Android 11);
     *  - micro, thêm camera khi camera của CHÍNH MÌNH đang bật và đã có quyền (Android 14 ném SecurityException nếu khai
     *    camera mà chưa có quyền).
     * KHÔNG dùng phoneCall (chỉ cho app gọi điện mặc định / ConnectionService) hay mediaPlayback (không phải phát nhạc).
     */
    static int serviceTypes(int sdk, boolean micGranted, boolean cameraOn, boolean cameraGranted) {
        if (!micGranted) return -1;
        if (sdk < 30) return 0;
        return FGS_MICROPHONE | (cameraOn && cameraGranted ? FGS_CAMERA : 0);
    }

    /** Các loại sẽ thử lần lượt nếu lần trước bị từ chối (camera bị từ chối → giữ ít nhất micro). */
    static int[] serviceTypeAttempts(int types) {
        if (types <= 0) return new int[] { types };
        if ((types & FGS_CAMERA) != 0) return new int[] { types, FGS_MICROPHONE };
        return new int[] { types };
    }

    static final String STATE_CALLING = "calling";
    static final String STATE_CONNECTING = "connecting";
    static final String STATE_CONNECTED = "connected";

    static String normState(String s) {
        if (STATE_CALLING.equals(s) || STATE_CONNECTING.equals(s)) return s;
        return STATE_CONNECTED;
    }

    // ---------------------------------------------------------------------------------
    // Thông báo cuộc gọi đến / kết thúc (tin data-only "call" / "call-end", máy chủ chỉ gửi cho build ≥ 4)
    // ---------------------------------------------------------------------------------

    private static final Pattern CALL_ID = Pattern.compile("^[a-z0-9]{4,24}$");
    private static final Pattern USER_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern CALL_TOKEN = Pattern.compile("^[A-Za-z0-9_-]{8,1500}\\.[A-Za-z0-9_-]{8,200}$");

    static boolean isCallId(String s) {
        return s != null && CALL_ID.matcher(s).matches();
    }

    static boolean isUserId(String s) {
        return s != null && USER_ID.matcher(s).matches();
    }

    static boolean isCallToken(String s) {
        return s != null && CALL_TOKEN.matcher(s).matches();
    }

    static final String TAG_PREFIX = "pn-call-";

    /** Cùng tag với thông báo dạng "notification" của máy chủ (lib/calls/callPush.ts callTag) — thay nhau được. */
    static String tagFor(String callId) {
        return TAG_PREFIX + callId;
    }

    static final int IN_IGNORE = 0;
    static final int IN_RING = 1;
    static final int IN_MISSED = 2;

    /**
     * Tin "đang gọi" tới:
     *  - cuộc gọi đã kết thúc (tin kết thúc tới TRƯỚC — FCM không giữ thứ tự; hoặc đã bấm Từ chối) → bỏ qua;
     *  - tới sau exp (máy offline lâu, cuộc gọi chắc chắn đã thôi đổ chuông) → hiện ngay "Cuộc gọi nhỡ";
     *  - app đang mở ở tiền cảnh → bỏ qua (web tự đổ chuông trong app, như bản cũ);
     *  - đang trong một cuộc gọi khác (OngoingCallService) → bỏ qua: WebView đang sống báo "máy bận" cho người gọi, không
     *    đổ chuông đè lên cuộc gọi đang nói;
     *  - còn lại → đổ chuông.
     */
    static int onIncoming(long now, long exp, boolean alreadyEnded, boolean appInForeground, boolean inCall) {
        if (alreadyEnded) return IN_IGNORE;
        if (exp > 0 && now >= exp) return IN_MISSED;
        if (appInForeground || inCall) return IN_IGNORE;
        return IN_RING;
    }

    static final long RING_MIN_MS = 5_000;
    static final long RING_MAX_MS = 60_000;

    /** Thông báo đổ chuông tự gỡ (timeoutAfter) khi cuộc gọi chắc chắn đã thôi đổ chuông: exp − now, kẹp 5–60 s. */
    static long ringTimeoutMs(long now, long exp) {
        if (exp <= 0) return RING_MAX_MS;
        return Math.max(RING_MIN_MS, Math.min(RING_MAX_MS, exp - now));
    }

    static final int END_NOTHING = 0;
    static final int END_CANCEL = 1;
    static final int END_MISSED_SILENT = 2;
    static final int END_MISSED_ALERT = 3;

    /**
     * Tin kết thúc cùng tag (shown = đang có thông báo của cuộc gọi đó trong khay):
     *  - answered / declined (đã nghe / từ chối, thường là trên máy khác) → gỡ thông báo (đang đổ chuông, hoặc "nhỡ" do
     *    tin tới muộn), không hiện gì thêm;
     *  - missed → "Cuộc gọi nhỡ": IM LẶNG nếu máy vừa đổ chuông / đã hiện (người dùng đã nghe chuông), app đang mở hoặc
     *    đang trong cuộc gọi khác (máy bận); kêu 1 lần nếu chưa từng hiện gì (tin "đang gọi" không tới);
     *  - kết quả lạ → không làm gì.
     * Gỡ (cancel) TRƯỚC rồi mới đăng "nhỡ": cập nhật đè lên thông báo đang đổ chuông (FLAG_INSISTENT) không dừng tiếng
     * chuông đang lặp trên mọi bản Android.
     */
    static int onCallEnd(String outcome, boolean shown, boolean appInForeground, boolean inCall) {
        if ("answered".equals(outcome) || "declined".equals(outcome)) return shown ? END_CANCEL : END_NOTHING;
        if ("missed".equals(outcome)) return shown || appInForeground || inCall ? END_MISSED_SILENT : END_MISSED_ALERT;
        return END_NOTHING;
    }

    // ---------------------------------------------------------------------------------
    // Danh sách cuộc gọi đã kết thúc ("id:ms,id:ms" trong SharedPreferences pn_app)
    // ---------------------------------------------------------------------------------

    static final long ENDED_KEEP_MS = 10L * 60 * 1000;
    static final int ENDED_MAX = 20;

    /** Thêm callId (mới nhất ở cuối), bỏ mục quá maxAgeMs / quá max mục / hỏng. */
    static String addEnded(String stored, String callId, long now, long maxAgeMs, int max) {
        List<String> keep = new ArrayList<>();
        for (String[] e : parseEnded(stored)) {
            long at = Long.parseLong(e[1]);
            if (e[0].equals(callId) || now - at > maxAgeMs || at > now + 60_000) continue;
            keep.add(e[0] + ":" + e[1]);
        }
        if (isCallId(callId)) keep.add(callId + ":" + now);
        while (keep.size() > max) keep.remove(0);
        return String.join(",", keep);
    }

    static boolean isEnded(String stored, String callId, long now, long maxAgeMs) {
        if (!isCallId(callId)) return false;
        for (String[] e : parseEnded(stored)) {
            if (e[0].equals(callId) && now - Long.parseLong(e[1]) <= maxAgeMs) return true;
        }
        return false;
    }

    private static List<String[]> parseEnded(String stored) {
        List<String[]> out = new ArrayList<>();
        if (stored == null || stored.isEmpty()) return out;
        for (String part : stored.split(",")) {
            int c = part.indexOf(':');
            if (c <= 0) continue;
            String id = part.substring(0, c);
            String at = part.substring(c + 1);
            if (!isCallId(id) || !at.matches("\\d{1,15}")) continue;
            out.add(new String[] { id, at });
        }
        return out;
    }

    static long parseLong(String s, long def) {
        try {
            return s == null ? def : Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
