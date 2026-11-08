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
    /** Bộ chuyển âm thanh USB-C / DAC USB (nhiều máy báo loại này thay vì USB_HEADSET). */
    static final int DEVICE_USB_DEVICE = 11;
    static final int DEVICE_USB_HEADSET = 22;
    /** Máy trợ thính ASHA (Bluetooth LE). */
    static final int DEVICE_HEARING_AID = 23;
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
            case DEVICE_USB_DEVICE:
            case DEVICE_USB_HEADSET:
                return ROUTE_HEADSET;
            case DEVICE_BLUETOOTH_SCO:
            case DEVICE_HEARING_AID:
            case DEVICE_BLE_HEADSET:
                return ROUTE_BLUETOOTH;
            default:
                return null;
        }
    }

    /**
     * [loa trong, tai nghe cắm dây / USB, Bluetooth / máy trợ thính] dùng được cho cuộc gọi, từ danh sách loại thiết bị.
     * Bluetooth CHỈ từ Android 12 (API 31, setCommunicationDevice): máy cũ hơn liệt kê tai nghe Bluetooth (HFP) ngay khi
     * nối, nhưng setSpeakerphoneOn(false) không mở đường SCO (cần startBluetoothSco + quyền BLUETOOTH) → tiếng thật ra
     * loa trong, trong khi nút Loa ghi "Bluetooth" và cuộc gọi video bị đẩy khỏi loa ngoài.
     */
    static boolean[] availableRoutes(int sdk, int[] deviceTypes) {
        boolean[] out = new boolean[3];
        if (deviceTypes == null) return out;
        for (int type : deviceTypes) {
            String r = routeOfDevice(type);
            if (ROUTE_EARPIECE.equals(r)) out[0] = true;
            else if (ROUTE_HEADSET.equals(r)) out[1] = true;
            else if (ROUTE_BLUETOOTH.equals(r) && sdk >= 31) out[2] = true;
        }
        return out;
    }

    /**
     * Thiết bị thay đổi giữa cuộc gọi: vừa nối thêm tai nghe / Bluetooth → bỏ lựa chọn cũ của nút Loa (thiết bị mới thắng,
     * như app Điện thoại); còn lại giữ lựa chọn (chooseRoute tự bỏ thiết bị đã rút).
     */
    static String requestAfterDevicesChanged(String requested, boolean[] before, boolean[] after) {
        if (before == null || after == null) return requested;
        boolean newPrivate = (after[1] && !before[1]) || (after[2] && !before[2]);
        return newPrivate ? null : requested;
    }

    /** API < 31: đường đang dùng thật (setSpeakerphoneOn là của cả máy — mã âm thanh của WebView cũng bật / tắt nó). */
    static String legacyRoute(boolean speakerOn, boolean hasEarpiece, boolean hasHeadset) {
        if (speakerOn) return ROUTE_SPEAKER;
        if (hasHeadset) return ROUTE_HEADSET;
        return hasEarpiece ? ROUTE_EARPIECE : ROUTE_SPEAKER;
    }

    // android.media.AudioManager.MODE_* (hằng số lúc biên dịch)
    static final int AUDIO_MODE_NORMAL = 0;
    static final int AUDIO_MODE_RINGTONE = 1;
    static final int AUDIO_MODE_IN_CALL = 2;
    static final int AUDIO_MODE_IN_COMMUNICATION = 3;
    static final int AUDIO_MODE_CALL_SCREENING = 4;
    static final int AUDIO_MODE_CALL_REDIRECT = 5;
    static final int AUDIO_MODE_COMMUNICATION_REDIRECT = 6;

    /**
     * Chế độ âm thanh trả lại khi cuộc gọi kết thúc: KHÔNG BAO GIỜ trả lại một chế độ cuộc gọi / đổ chuông. Mã âm thanh
     * của WebView (Chromium) đã tự bật MODE_IN_COMMUNICATION khi getUserMedia mở micro, TRƯỚC khi web gọi
     * startOngoingCall → prevMode thường chính là MODE_IN_COMMUNICATION; trả lại nó làm app (trước Android 11: cả máy)
     * kẹt ở chế độ gọi sau cuộc gọi (phím âm lượng chỉnh âm lượng cuộc gọi, tiếng khác đi sai đường).
     */
    static int modeToRestore(int prevMode) {
        if (prevMode < 0) return AUDIO_MODE_NORMAL; // MODE_INVALID / MODE_CURRENT
        switch (prevMode) {
            case AUDIO_MODE_RINGTONE:
            case AUDIO_MODE_IN_CALL:
            case AUDIO_MODE_IN_COMMUNICATION:
            case AUDIO_MODE_CALL_SCREENING:
            case AUDIO_MODE_CALL_REDIRECT:
            case AUDIO_MODE_COMMUNICATION_REDIRECT:
                return AUDIO_MODE_NORMAL;
            default:
                return prevMode;
        }
    }

    /** Ít giây sau khi kết thúc: Chromium có thể trả lại chế độ nó đã lưu SAU end() → kiểm lại một lần. */
    static final long MODE_RECHECK_MS = 2000;

    /** Kiểm lại sau MODE_RECHECK_MS: không có cuộc gọi, vẫn ở MODE_IN_COMMUNICATION, không ai đang ghi âm → về NORMAL. */
    static boolean resetModeLater(boolean callActive, int mode, boolean recording) {
        return !callActive && mode == AUDIO_MODE_IN_COMMUNICATION && !recording;
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

    /**
     * Cảm biến tiệm cận (tắt màn hình khi áp máy vào tai): chỉ cuộc gọi THOẠI đang nghe bằng loa trong, và chỉ khi app
     * đang hiện trên màn hình (uiVisible — như app Điện thoại; đang ở app khác thì che cảm biến không được tắt màn hình).
     */
    static boolean useProximity(boolean video, String route, boolean supported, boolean uiVisible) {
        return supported && uiVisible && !video && ROUTE_EARPIECE.equals(route);
    }

    /** Giữ màn hình sáng (FLAG_KEEP_SCREEN_ON): cuộc gọi đang hiện video. */
    static boolean keepScreenOn(boolean video) {
        return video;
    }

    // ---------------------------------------------------------------------------------
    // Foreground service "đang trong cuộc gọi"
    // ---------------------------------------------------------------------------------

    // android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE (API 30)
    static final int FGS_MICROPHONE = 0x80;

    /**
     * Loại foreground service cho startForeground:
     *  - -1: không chạy (chưa có quyền micro — không có cuộc gọi nào để giữ);
     *  - API < 30: 0 (startForeground không loại; giới hạn "while-in-use" của micro chỉ có từ Android 11);
     *  - còn lại: CHỈ microphone. KHÔNG khai camera: rời app thì Android dừng camera và web tắt track video, báo bên kia
     *    "Tạm dừng video" — không bao giờ gửi hình khi người dùng không thấy app.
     * KHÔNG dùng phoneCall (chỉ cho app gọi điện mặc định / ConnectionService) hay mediaPlayback (không phải phát nhạc).
     */
    static int serviceTypes(int sdk, boolean micGranted) {
        if (!micGranted) return -1;
        if (sdk < 30) return 0;
        return FGS_MICROPHONE;
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
     * Tin "đang gọi" tới (remainingMs: còn bao lâu cuộc gọi thôi đổ chuông — ringRemainingMs):
     *  - cuộc gọi đã kết thúc (tin kết thúc tới TRƯỚC — FCM không giữ thứ tự; hoặc đã bấm Từ chối) → bỏ qua;
     *  - hết giờ đổ chuông (tin tới quá muộn) → hiện ngay "Cuộc gọi nhỡ";
     *  - app đang mở ở tiền cảnh → bỏ qua (web tự đổ chuông trong app, như bản cũ);
     *  - đang trong một cuộc gọi khác (OngoingCallService) → bỏ qua: WebView đang sống báo "máy bận" cho người gọi, không
     *    đổ chuông đè lên cuộc gọi đang nói;
     *  - còn lại → đổ chuông.
     */
    static int onIncoming(long remainingMs, boolean alreadyEnded, boolean appInForeground, boolean inCall) {
        if (alreadyEnded) return IN_IGNORE;
        if (remainingMs <= 0) return IN_MISSED;
        if (appInForeground || inCall) return IN_IGNORE;
        return IN_RING;
    }

    static final long RING_MIN_MS = 5_000;
    static final long RING_MAX_MS = 60_000;
    /** FCM giữ tin cuộc gọi tối đa 60 s (TTL): "trễ" dài hơn chừng này (hoặc âm quá) = đồng hồ máy lệch, không phải trễ thật. */
    static final long DELIVERY_MAX_MS = 65_000;
    static final long DELIVERY_EARLY_MS = 5_000;

    /**
     * Còn bao lâu cuộc gọi thôi đổ chuông. exp theo đồng hồ MÁY CHỦ, now theo đồng hồ ĐIỆN THOẠI: đồng hồ máy nhanh hơn
     * 60 s từng biến mọi cuộc gọi đến thành "Cuộc gọi nhỡ" ngay lúc người gọi vẫn đang chờ. Đo từ lúc FCM nhận tin
     * (sentTime — RemoteMessage.getSentTime(), đồng hồ máy chủ): còn lại = exp − sentTime − thời gian giao tin; thời gian
     * giao tin (now − sentTime) vô lý (âm quá 5 s, hoặc dài hơn TTL) → đồng hồ máy lệch → coi như giao ngay, đổ chuông đủ.
     * exp không rõ → RING_MAX_MS; không có sentTime → exp − now (cách cũ).
     */
    static long ringRemainingMs(long now, long sentTime, long exp) {
        if (exp <= 0) return RING_MAX_MS;
        if (sentTime <= 0) return exp - now;
        long delay = now - sentTime;
        if (delay < -DELIVERY_EARLY_MS || delay > DELIVERY_MAX_MS) delay = 0;
        return exp - sentTime - Math.max(0, delay);
    }

    /** Thông báo đổ chuông tự gỡ (timeoutAfter) khi cuộc gọi chắc chắn đã thôi đổ chuông: kẹp 5–60 s. */
    static long ringTimeoutMs(long remainingMs) {
        return Math.max(RING_MIN_MS, Math.min(RING_MAX_MS, remainingMs));
    }

    /**
     * Chuông LẶP (FLAG_INSISTENT) chỉ từ Android 8 (API 26): trước đó setTimeoutAfter không có tác dụng → mất tin kết thúc
     * là máy kêu mãi. Android 7.x kêu 1 lần (như bản 3), thông báo được gỡ bằng báo thức (CallNotifications).
     */
    static boolean insistentRing(int sdk) {
        return sdk >= 26;
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
