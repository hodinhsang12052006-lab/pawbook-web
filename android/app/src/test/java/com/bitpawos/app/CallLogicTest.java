package com.bitpawos.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.pm.ServiceInfo;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import org.junit.Test;

/**
 * Logic thuần của cuộc gọi native (versionCode 4): đường âm thanh, cảm biến tiệm cận, loại foreground service, quyết
 * định với tin "đang gọi" / tin kết thúc cùng tag, danh sách cuộc gọi đã kết thúc.
 * ./gradlew :app:testDebugUnitTest
 */
public class CallLogicTest {

    // ---------- hằng số phải khớp Android (inline lúc biên dịch từ android.jar) ----------

    @Test
    public void constantsMatchTheFramework() {
        assertEquals(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE, CallLogic.DEVICE_BUILTIN_EARPIECE);
        assertEquals(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, CallLogic.DEVICE_BUILTIN_SPEAKER);
        assertEquals(AudioDeviceInfo.TYPE_WIRED_HEADSET, CallLogic.DEVICE_WIRED_HEADSET);
        assertEquals(AudioDeviceInfo.TYPE_WIRED_HEADPHONES, CallLogic.DEVICE_WIRED_HEADPHONES);
        assertEquals(AudioDeviceInfo.TYPE_BLUETOOTH_SCO, CallLogic.DEVICE_BLUETOOTH_SCO);
        assertEquals(AudioDeviceInfo.TYPE_USB_DEVICE, CallLogic.DEVICE_USB_DEVICE);
        assertEquals(AudioDeviceInfo.TYPE_USB_HEADSET, CallLogic.DEVICE_USB_HEADSET);
        assertEquals(AudioDeviceInfo.TYPE_HEARING_AID, CallLogic.DEVICE_HEARING_AID);
        assertEquals(AudioDeviceInfo.TYPE_BLE_HEADSET, CallLogic.DEVICE_BLE_HEADSET);
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, CallLogic.FGS_MICROPHONE);
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.AUDIO_MODE_NORMAL);
        assertEquals(AudioManager.MODE_RINGTONE, CallLogic.AUDIO_MODE_RINGTONE);
        assertEquals(AudioManager.MODE_IN_CALL, CallLogic.AUDIO_MODE_IN_CALL);
        assertEquals(AudioManager.MODE_IN_COMMUNICATION, CallLogic.AUDIO_MODE_IN_COMMUNICATION);
        assertEquals(AudioManager.MODE_CALL_SCREENING, CallLogic.AUDIO_MODE_CALL_SCREENING);
        assertEquals(AudioManager.MODE_CALL_REDIRECT, CallLogic.AUDIO_MODE_CALL_REDIRECT);
        assertEquals(AudioManager.MODE_COMMUNICATION_REDIRECT, CallLogic.AUDIO_MODE_COMMUNICATION_REDIRECT);
    }

    // ---------- âm thanh ----------

    @Test
    public void deviceTypesMapToRoutes() {
        assertEquals("earpiece", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE));
        assertEquals("speaker", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_WIRED_HEADSET));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_WIRED_HEADPHONES));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_USB_HEADSET));
        // bộ chuyển USB-C / DAC USB: nghe riêng như tai nghe (không bị loa trong / loa ngoài giành mất)
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_USB_DEVICE));
        assertEquals("bluetooth", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BLUETOOTH_SCO));
        assertEquals("bluetooth", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BLE_HEADSET));
        // máy trợ thính ASHA: thiết bị nghe riêng như Bluetooth
        assertEquals("bluetooth", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_HEARING_AID));
        // A2DP (nghe nhạc) / HDMI / loa "an toàn" không dùng cho cuộc gọi
        assertEquals(null, CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP));
        assertEquals(null, CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_HDMI));
        assertEquals(null, CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE));
    }

    @Test
    public void defaultRouteVoiceUsesEarpieceVideoUsesSpeaker() {
        // điện thoại, không tai nghe
        assertEquals("earpiece", CallLogic.chooseRoute(null, false, true, false, false));
        assertEquals("speaker", CallLogic.chooseRoute(null, true, true, false, false));
        assertEquals("earpiece", CallLogic.chooseRoute("auto", false, true, false, false));
        // máy tính bảng (không có loa trong): thoại cũng ra loa ngoài
        assertEquals("speaker", CallLogic.chooseRoute(null, false, false, false, false));
        assertEquals("speaker", CallLogic.chooseRoute("earpiece", false, false, false, false));
    }

    @Test
    public void headsetsWinUnlessSpeakerIsChosen() {
        assertEquals("headset", CallLogic.chooseRoute(null, false, true, true, false));
        assertEquals("headset", CallLogic.chooseRoute(null, true, true, true, true));
        assertEquals("bluetooth", CallLogic.chooseRoute(null, true, true, false, true));
        assertEquals("bluetooth", CallLogic.chooseRoute("earpiece", false, true, false, true));
        // người dùng bấm Loa: loa ngoài kể cả khi đang cắm tai nghe
        assertEquals("speaker", CallLogic.chooseRoute("speaker", false, true, true, true));
        assertEquals("speaker", CallLogic.chooseRoute("speaker", true, false, false, false));
        // bấm lại (nghe riêng) trong cuộc gọi video: loa trong
        assertEquals("earpiece", CallLogic.chooseRoute("earpiece", true, true, false, false));
    }

    @Test
    public void bluetoothIsOnlyOfferedWhereItCanReallyBeRouted() {
        int[] phoneWithBtEarbuds = { AudioDeviceInfo.TYPE_BUILTIN_EARPIECE, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP };
        // Android 7–11 (API 24–30): tai nghe Bluetooth nối (HFP) nhưng setSpeakerphoneOn(false) không mở SCO → KHÔNG báo / chọn
        // Bluetooth; gọi video vẫn ra loa ngoài như bản 3, gọi thoại ra loa trong (đúng chỗ tiếng thật sự ra)
        boolean[] api30 = CallLogic.availableRoutes(30, phoneWithBtEarbuds);
        assertArrayEquals(new boolean[] { true, false, false }, api30);
        assertEquals("speaker", CallLogic.chooseRoute(null, true, api30[0], api30[1], api30[2]));
        assertEquals("earpiece", CallLogic.chooseRoute(null, false, api30[0], api30[1], api30[2]));
        assertArrayEquals(new boolean[] { true, false, false }, CallLogic.availableRoutes(24, new int[] { 1, 2, AudioDeviceInfo.TYPE_HEARING_AID }));
        // Android 12+ (setCommunicationDevice định tuyến thật vào Bluetooth): có
        boolean[] api31 = CallLogic.availableRoutes(31, phoneWithBtEarbuds);
        assertArrayEquals(new boolean[] { true, false, true }, api31);
        assertEquals("bluetooth", CallLogic.chooseRoute(null, true, api31[0], api31[1], api31[2]));
        // tai nghe cắm dây / USB: mọi bản Android
        assertArrayEquals(new boolean[] { true, true, false }, CallLogic.availableRoutes(24, new int[] { 1, 2, AudioDeviceInfo.TYPE_WIRED_HEADSET }));
        assertArrayEquals(new boolean[] { false, true, false }, CallLogic.availableRoutes(33, new int[] { 2, AudioDeviceInfo.TYPE_USB_DEVICE }));
        assertArrayEquals(new boolean[] { false, false, false }, CallLogic.availableRoutes(33, null));
    }

    @Test
    public void newHeadsetMidCallWinsOverTheSpeakerChoice() {
        boolean[] phone = { true, false, false };
        boolean[] wired = { true, true, false };
        boolean[] bt = { true, false, true };
        // bấm Loa rồi cắm tai nghe / nối Bluetooth → bỏ lựa chọn, tai nghe thắng (như app Điện thoại)
        assertEquals(null, CallLogic.requestAfterDevicesChanged("speaker", phone, wired));
        assertEquals(null, CallLogic.requestAfterDevicesChanged("speaker", phone, bt));
        // rút tai nghe / thiết bị khác thay đổi → giữ lựa chọn (chooseRoute tự bỏ thiết bị đã rút)
        assertEquals("speaker", CallLogic.requestAfterDevicesChanged("speaker", wired, phone));
        assertEquals("earpiece", CallLogic.requestAfterDevicesChanged("earpiece", wired, wired));
        assertEquals("speaker", CallLogic.requestAfterDevicesChanged("speaker", null, wired));
        // đường thật trên máy cũ (WebView có thể tự bật / tắt loa ngoài)
        assertEquals("speaker", CallLogic.legacyRoute(true, true, true));
        assertEquals("headset", CallLogic.legacyRoute(false, true, true));
        assertEquals("earpiece", CallLogic.legacyRoute(false, true, false));
        assertEquals("speaker", CallLogic.legacyRoute(false, false, false)); // máy tính bảng
    }

    @Test
    public void callAudioModeIsNeverRestored() {
        // WebView đã bật MODE_IN_COMMUNICATION trước begin() → kết thúc trả về NORMAL, không kẹt ở chế độ gọi
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_IN_COMMUNICATION));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_IN_CALL));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_RINGTONE));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_CALL_SCREENING));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_CALL_REDIRECT));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_COMMUNICATION_REDIRECT));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_NORMAL));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_INVALID));
        assertEquals(AudioManager.MODE_NORMAL, CallLogic.modeToRestore(AudioManager.MODE_CURRENT));
        // WebView trả lại MODE_IN_COMMUNICATION nó đã lưu SAU end(): kiểm lại 2 s sau → về NORMAL, trừ khi đã có cuộc gọi
        // mới hoặc app đang ghi âm
        assertTrue(CallLogic.resetModeLater(false, AudioManager.MODE_IN_COMMUNICATION, false));
        assertFalse(CallLogic.resetModeLater(true, AudioManager.MODE_IN_COMMUNICATION, false));
        assertFalse(CallLogic.resetModeLater(false, AudioManager.MODE_IN_COMMUNICATION, true));
        assertFalse(CallLogic.resetModeLater(false, AudioManager.MODE_NORMAL, false));
        assertFalse(CallLogic.resetModeLater(false, AudioManager.MODE_IN_CALL, false)); // cuộc gọi điện thoại thật: không đụng
        assertEquals(2000, CallLogic.MODE_RECHECK_MS);
    }

    @Test
    public void speakerButtonToggles() {
        assertEquals("earpiece", CallLogic.nextRequest("speaker"));
        assertEquals("speaker", CallLogic.nextRequest("earpiece"));
        assertEquals("speaker", CallLogic.nextRequest("headset"));
        assertEquals("speaker", CallLogic.nextRequest(null));
    }

    @Test
    public void proximityOnlyForVoiceOnTheEarpiece() {
        assertTrue(CallLogic.useProximity(false, "earpiece", true, true));
        assertFalse(CallLogic.useProximity(true, "earpiece", true, true)); // video: màn hình phải sáng
        assertFalse(CallLogic.useProximity(false, "speaker", true, true));
        assertFalse(CallLogic.useProximity(false, "headset", true, true));
        assertFalse(CallLogic.useProximity(false, "earpiece", false, true)); // máy không có cảm biến
        assertFalse(CallLogic.useProximity(false, null, true, true));
        // đang ở app khác (MainActivity onStop): che cảm biến không tắt màn hình ở đó
        assertFalse(CallLogic.useProximity(false, "earpiece", true, false));
        assertTrue(CallLogic.keepScreenOn(true));
        assertFalse(CallLogic.keepScreenOn(false));
    }

    // ---------- foreground service ----------

    @Test
    public void serviceIsMicrophoneOnlyNeverCamera() {
        assertEquals(-1, CallLogic.serviceTypes(34, false)); // không có quyền micro: không chạy
        assertEquals(0, CallLogic.serviceTypes(29, true)); // Android 10: startForeground không loại
        assertEquals(0, CallLogic.serviceTypes(24, true));
        // gọi thoại lẫn gọi video: CHỈ microphone — camera dừng khi rời app (không gửi hình lúc bên kia thấy "Tạm dừng")
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, CallLogic.serviceTypes(30, true));
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, CallLogic.serviceTypes(34, true));
        assertEquals(0, CallLogic.serviceTypes(36, true) & ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);
    }

    @Test
    public void ongoingStates() {
        assertEquals("calling", CallLogic.normState("calling"));
        assertEquals("connecting", CallLogic.normState("connecting"));
        assertEquals("connected", CallLogic.normState("connected"));
        assertEquals("connected", CallLogic.normState(null));
        assertEquals("connected", CallLogic.normState("<script>"));
    }

    // ---------- tin cuộc gọi ----------

    @Test
    public void payloadValidation() {
        assertTrue(CallLogic.isCallId("abc123xyz"));
        assertTrue(CallLogic.isCallId("a1b2"));
        assertFalse(CallLogic.isCallId("ABC123")); // id do client tạo: chữ thường + số
        assertFalse(CallLogic.isCallId("../x"));
        assertFalse(CallLogic.isCallId("abc"));
        assertFalse(CallLogic.isCallId(null));
        assertTrue(CallLogic.isUserId("cmh1abc_DEF-9"));
        assertFalse(CallLogic.isUserId("a b"));
        assertFalse(CallLogic.isUserId(""));
        assertTrue(CallLogic.isCallToken("eyJjIjoidV9jYWxsZXIifQ.c2lnbmF0dXJlLXNpZw"));
        assertFalse(CallLogic.isCallToken("no-dot-token"));
        assertFalse(CallLogic.isCallToken("a.b"));
        assertFalse(CallLogic.isCallToken("eyJjIjoidV9jYWxsZXIifQ.c2lnbmF0dXJl LXNpZw"));
        assertFalse(CallLogic.isCallToken(null));
        assertEquals("pn-call-abc123xyz", CallLogic.tagFor("abc123xyz"));
    }

    @Test
    public void incomingDecision() {
        assertEquals(CallLogic.IN_RING, CallLogic.onIncoming(50_000, false, false, false));
        // app đang mở: web tự đổ chuông trong app
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(50_000, false, true, false));
        // đang trong cuộc gọi khác: web báo bận, không đổ chuông đè lên cuộc gọi đang nói
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(50_000, false, false, true));
        // tin kết thúc đã tới trước / đã bấm Từ chối
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(50_000, true, false, false));
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(-1, true, false, false));
        // tới sau khi cuộc gọi chắc chắn đã thôi đổ chuông → "Cuộc gọi nhỡ" ngay (kể cả khi app đang mở)
        assertEquals(CallLogic.IN_MISSED, CallLogic.onIncoming(-1, false, false, false));
        assertEquals(CallLogic.IN_MISSED, CallLogic.onIncoming(0, false, true, false));
    }

    @Test
    public void ringWindowIsMeasuredFromTheServerClock() {
        long sent = 1_800_000_000_000L; // RemoteMessage.getSentTime() (đồng hồ máy chủ FCM)
        long exp = sent + 60_000; // máy chủ: hết đổ chuông sau 60 s
        // đồng hồ máy đúng, tin tới sau 3 s → còn 57 s
        assertEquals(57_000, CallLogic.ringRemainingMs(sent + 3_000, sent, exp));
        // tới thật muộn (Doze) 61 s → nhỡ
        assertTrue(CallLogic.ringRemainingMs(sent + 61_000, sent, exp) <= 0);
        // đồng hồ máy NHANH 90 s: trước đây mọi cuộc gọi thành "nhỡ" ngay — giờ đổ chuông đủ 60 s
        assertEquals(60_000, CallLogic.ringRemainingMs(sent + 90_000, sent, exp));
        assertEquals(CallLogic.IN_RING, CallLogic.onIncoming(CallLogic.ringRemainingMs(sent + 90_000, sent, exp), false, false, false));
        // đồng hồ máy CHẬM 10 phút: đổ chuông đủ 60 s (trước đây cũng vậy nhưng nhờ kẹp)
        assertEquals(60_000, CallLogic.ringRemainingMs(sent - 600_000, sent, exp));
        // lệch nhỏ (đồng hồ nhanh 40 s, tin tới sau 2 s) không phân biệt được với trễ thật: rút ngắn, không "nhỡ"
        assertEquals(18_000, CallLogic.ringRemainingMs(sent + 42_000, sent, exp));
        // không có exp (tin lạ): 60 s; không có sentTime: cách cũ (exp − now)
        assertEquals(60_000, CallLogic.ringRemainingMs(sent, sent, 0));
        assertEquals(42_000, CallLogic.ringRemainingMs(exp - 42_000, 0, exp));
    }

    @Test
    public void ringStopsWhenTheCallCannotRingAnyMore() {
        assertEquals(42_000, CallLogic.ringTimeoutMs(42_000));
        assertEquals(60_000, CallLogic.ringTimeoutMs(600_000)); // tối đa 60 s
        assertEquals(5_000, CallLogic.ringTimeoutMs(1_000)); // ít nhất 5 s để kịp thấy
        assertEquals(5_000, CallLogic.ringTimeoutMs(-3_000));
    }

    @Test
    public void ringtoneLoopsOnlyWhereTheTimeoutWorks() {
        // Android 7.x: setTimeoutAfter không có tác dụng → FLAG_INSISTENT + mất tin kết thúc = kêu mãi → chỉ kêu 1 lần
        assertFalse(CallLogic.insistentRing(24));
        assertFalse(CallLogic.insistentRing(25));
        assertTrue(CallLogic.insistentRing(26));
        assertTrue(CallLogic.insistentRing(36));
    }

    @Test
    public void followUpCancelsOrReplaces() {
        // đã trả lời / từ chối (thường là máy khác): gỡ thông báo đang có, không hiện thêm gì
        assertEquals(CallLogic.END_CANCEL, CallLogic.onCallEnd("answered", true, false, false));
        assertEquals(CallLogic.END_CANCEL, CallLogic.onCallEnd("declined", true, true, false));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("answered", false, false, false));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("declined", false, false, false));
        // nhỡ: máy vừa đổ chuông → thay IM LẶNG (đã nghe chuông rồi); chưa hiện gì → kêu 1 lần; app đang mở → im lặng
        assertEquals(CallLogic.END_MISSED_SILENT, CallLogic.onCallEnd("missed", true, false, false));
        assertEquals(CallLogic.END_MISSED_ALERT, CallLogic.onCallEnd("missed", false, false, false));
        assertEquals(CallLogic.END_MISSED_SILENT, CallLogic.onCallEnd("missed", false, true, false));
        // nhỡ trong lúc đang nói cuộc gọi khác (máy bận) → im lặng
        assertEquals(CallLogic.END_MISSED_SILENT, CallLogic.onCallEnd("missed", false, false, true));
        // kết quả lạ
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("hangup", true, false, false));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd(null, true, false, false));
    }

    @Test
    public void endedCallsAreRememberedBriefly() {
        long now = 1_800_000_000_000L;
        long keep = CallLogic.ENDED_KEEP_MS;
        String s = CallLogic.addEnded("", "call0001", now, keep, 3);
        assertEquals("call0001:" + now, s);
        assertTrue(CallLogic.isEnded(s, "call0001", now + 1000, keep));
        assertFalse(CallLogic.isEnded(s, "call0002", now + 1000, keep));
        assertFalse(CallLogic.isEnded(s, "call0001", now + keep + 1, keep)); // quá 10 phút: quên
        // tối đa 3 mục, cũ nhất bị bỏ; thêm lại id đã có → chuyển về cuối, không trùng
        s = CallLogic.addEnded(s, "call0002", now + 1, keep, 3);
        s = CallLogic.addEnded(s, "call0003", now + 2, keep, 3);
        s = CallLogic.addEnded(s, "call0004", now + 3, keep, 3);
        assertFalse(CallLogic.isEnded(s, "call0001", now + 4, keep));
        assertTrue(CallLogic.isEnded(s, "call0004", now + 4, keep));
        s = CallLogic.addEnded(s, "call0002", now + 5, keep, 3);
        assertEquals("call0003:" + (now + 2) + ",call0004:" + (now + 3) + ",call0002:" + (now + 5), s);
        // mục quá hạn bị dọn khi thêm; dữ liệu hỏng / id lạ bị bỏ qua
        String later = CallLogic.addEnded(s, "call0009", now + keep + 4, keep, 20);
        assertEquals("call0002:" + (now + 5) + ",call0009:" + (now + keep + 4), later);
        assertEquals("call0005:" + now, CallLogic.addEnded("garbage,:1,BAD:2,call0001:x", "call0005", now, keep, 20));
        assertEquals("", CallLogic.addEnded("", "../x", now, keep, 20));
        assertFalse(CallLogic.isEnded(null, "call0001", now, keep));
    }

    @Test
    public void parseLongIsLenient() {
        assertEquals(42L, CallLogic.parseLong("42", 0));
        assertEquals(7L, CallLogic.parseLong(" 7 ", 0));
        assertEquals(-1L, CallLogic.parseLong("x", -1));
        assertEquals(-1L, CallLogic.parseLong(null, -1));
    }
}
