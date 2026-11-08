package com.bitpawos.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.pm.ServiceInfo;
import android.media.AudioDeviceInfo;
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
        assertEquals(AudioDeviceInfo.TYPE_USB_HEADSET, CallLogic.DEVICE_USB_HEADSET);
        assertEquals(AudioDeviceInfo.TYPE_BLE_HEADSET, CallLogic.DEVICE_BLE_HEADSET);
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, CallLogic.FGS_MICROPHONE);
        assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA, CallLogic.FGS_CAMERA);
    }

    // ---------- âm thanh ----------

    @Test
    public void deviceTypesMapToRoutes() {
        assertEquals("earpiece", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BUILTIN_EARPIECE));
        assertEquals("speaker", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_WIRED_HEADSET));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_WIRED_HEADPHONES));
        assertEquals("headset", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_USB_HEADSET));
        assertEquals("bluetooth", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BLUETOOTH_SCO));
        assertEquals("bluetooth", CallLogic.routeOfDevice(AudioDeviceInfo.TYPE_BLE_HEADSET));
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
    public void speakerButtonToggles() {
        assertEquals("earpiece", CallLogic.nextRequest("speaker"));
        assertEquals("speaker", CallLogic.nextRequest("earpiece"));
        assertEquals("speaker", CallLogic.nextRequest("headset"));
        assertEquals("speaker", CallLogic.nextRequest(null));
    }

    @Test
    public void proximityOnlyForVoiceOnTheEarpiece() {
        assertTrue(CallLogic.useProximity(false, "earpiece", true));
        assertFalse(CallLogic.useProximity(true, "earpiece", true)); // video: màn hình phải sáng
        assertFalse(CallLogic.useProximity(false, "speaker", true));
        assertFalse(CallLogic.useProximity(false, "headset", true));
        assertFalse(CallLogic.useProximity(false, "earpiece", false)); // máy không có cảm biến
        assertFalse(CallLogic.useProximity(false, null, true));
        assertTrue(CallLogic.keepScreenOn(true));
        assertFalse(CallLogic.keepScreenOn(false));
    }

    // ---------- foreground service ----------

    @Test
    public void serviceTypesFollowPermissionsAndCamera() {
        assertEquals(-1, CallLogic.serviceTypes(34, false, true, true)); // không có quyền micro: không chạy
        assertEquals(0, CallLogic.serviceTypes(29, true, true, true)); // Android 10: startForeground không loại
        assertEquals(0, CallLogic.serviceTypes(24, true, false, false));
        assertEquals(CallLogic.FGS_MICROPHONE, CallLogic.serviceTypes(30, true, false, true));
        assertEquals(CallLogic.FGS_MICROPHONE | CallLogic.FGS_CAMERA, CallLogic.serviceTypes(34, true, true, true));
        // camera đang bật nhưng chưa có quyền camera: chỉ micro (Android 14 ném SecurityException nếu khai camera)
        assertEquals(CallLogic.FGS_MICROPHONE, CallLogic.serviceTypes(34, true, true, false));
        // gọi thoại (camera tắt): không khai camera
        assertEquals(CallLogic.FGS_MICROPHONE, CallLogic.serviceTypes(35, true, false, true));
    }

    @Test
    public void cameraRefusedFallsBackToMicrophone() {
        assertArrayEquals(new int[] { 0xC0, 0x80 }, CallLogic.serviceTypeAttempts(0xC0));
        assertArrayEquals(new int[] { 0x80 }, CallLogic.serviceTypeAttempts(0x80));
        assertArrayEquals(new int[] { 0 }, CallLogic.serviceTypeAttempts(0));
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
        long now = 1_800_000_000_000L;
        assertEquals(CallLogic.IN_RING, CallLogic.onIncoming(now, now + 50_000, false, false));
        // app đang mở: web tự đổ chuông trong app
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(now, now + 50_000, false, true));
        // tin kết thúc đã tới trước / đã bấm Từ chối
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(now, now + 50_000, true, false));
        assertEquals(CallLogic.IN_IGNORE, CallLogic.onIncoming(now, now - 1, true, false));
        // tới sau khi cuộc gọi chắc chắn đã thôi đổ chuông → "Cuộc gọi nhỡ" ngay (kể cả khi app đang mở)
        assertEquals(CallLogic.IN_MISSED, CallLogic.onIncoming(now, now - 1, false, false));
        assertEquals(CallLogic.IN_MISSED, CallLogic.onIncoming(now, now, false, true));
        // không có exp (tin lạ): vẫn đổ chuông, timeoutAfter chặn trên 60 s
        assertEquals(CallLogic.IN_RING, CallLogic.onIncoming(now, 0, false, false));
    }

    @Test
    public void ringStopsWhenTheCallCannotRingAnyMore() {
        long now = 1_800_000_000_000L;
        assertEquals(42_000, CallLogic.ringTimeoutMs(now, now + 42_000));
        assertEquals(60_000, CallLogic.ringTimeoutMs(now, now + 600_000)); // đồng hồ máy lệch: tối đa 60 s
        assertEquals(5_000, CallLogic.ringTimeoutMs(now, now + 1_000)); // ít nhất 5 s để kịp thấy
        assertEquals(60_000, CallLogic.ringTimeoutMs(now, 0));
    }

    @Test
    public void followUpCancelsOrReplaces() {
        // đã trả lời / từ chối (thường là máy khác): gỡ thông báo đang có, không hiện thêm gì
        assertEquals(CallLogic.END_CANCEL, CallLogic.onCallEnd("answered", true, false));
        assertEquals(CallLogic.END_CANCEL, CallLogic.onCallEnd("declined", true, true));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("answered", false, false));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("declined", false, false));
        // nhỡ: máy vừa đổ chuông → thay IM LẶNG (đã nghe chuông rồi); chưa hiện gì → kêu 1 lần; app đang mở → im lặng
        assertEquals(CallLogic.END_MISSED_SILENT, CallLogic.onCallEnd("missed", true, false));
        assertEquals(CallLogic.END_MISSED_ALERT, CallLogic.onCallEnd("missed", false, false));
        assertEquals(CallLogic.END_MISSED_SILENT, CallLogic.onCallEnd("missed", false, true));
        // kết quả lạ
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd("hangup", true, false));
        assertEquals(CallLogic.END_NOTHING, CallLogic.onCallEnd(null, true, false));
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
