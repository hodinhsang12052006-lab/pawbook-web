package com.bitpawos.app;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.util.List;

/**
 * Âm thanh của cuộc gọi WebRTC trong WebView (versionCode 4+), do web điều khiển qua PawNailNative:
 *  - begin: AudioManager.MODE_IN_COMMUNICATION (khử vọng / âm lượng cuộc gọi), chọn đường mặc định (thoại → loa trong
 *    như cuộc gọi điện thoại, video → loa ngoài; tai nghe / Bluetooth đang nối luôn được ưu tiên — CallLogic.chooseRoute);
 *  - setRoute: nút Loa của màn hình gọi — Android 12+ setCommunicationDevice, máy cũ setSpeakerphoneOn;
 *  - cảm biến tiệm cận khi gọi thoại bằng loa trong (áp tai → tắt màn hình, không chạm nhầm nút);
 *  - end: trả lại chế độ / loa như trước cuộc gọi.
 * Mọi lỗi của AudioManager (máy lạ, thiếu quyền) chỉ ghi log — cuộc gọi vẫn tiếp tục với đường âm thanh của hệ thống.
 */
final class CallAudio {

    private static final String TAG = "PawNailCallAudio";
    private static final long PROXIMITY_MAX_MS = 4L * 60 * 60 * 1000;
    private static final CallAudio INSTANCE = new CallAudio();

    static CallAudio get() {
        return INSTANCE;
    }

    private boolean active = false;
    private int prevMode = AudioManager.MODE_NORMAL;
    private boolean prevSpeaker = false;
    private boolean video = false;
    /** Lựa chọn của nút Loa (null = mặc định theo loại cuộc gọi). */
    private String requested = null;
    private String route = null;
    private PowerManager.WakeLock proximity;

    private CallAudio() {}

    synchronized boolean isActive() {
        return active;
    }

    /** Bắt đầu (hoặc cập nhật loại) cuộc gọi. Gọi lại nhiều lần được. */
    synchronized void begin(Context ctx, boolean video) {
        AudioManager am = am(ctx);
        if (am == null) return;
        if (!active) {
            try {
                prevMode = am.getMode();
                prevSpeaker = am.isSpeakerphoneOn();
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            } catch (RuntimeException e) {
                Log.w(TAG, "begin: " + e.getClass().getSimpleName());
            }
            active = true;
            requested = null;
        }
        this.video = video;
        apply(ctx, am);
    }

    /** Gọi thoại ↔ video giữa cuộc gọi: chỉ đổi đường mặc định khi người dùng chưa tự chọn loa. */
    synchronized void setVideo(Context ctx, boolean video) {
        if (!active || this.video == video) return;
        this.video = video;
        AudioManager am = am(ctx);
        if (am != null) apply(ctx, am);
    }

    /** "speaker" | "earpiece" | "auto" (về mặc định). */
    synchronized void setRoute(Context ctx, String req) {
        if (!active) return;
        requested = CallLogic.ROUTE_SPEAKER.equals(req) || CallLogic.ROUTE_EARPIECE.equals(req) ? req : null;
        AudioManager am = am(ctx);
        if (am != null) apply(ctx, am);
    }

    synchronized void end(Context ctx) {
        releaseProximity();
        if (!active) return;
        active = false;
        requested = null;
        route = null;
        AudioManager am = am(ctx);
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
            else am.setSpeakerphoneOn(prevSpeaker);
            am.setMode(prevMode);
        } catch (RuntimeException e) {
            Log.w(TAG, "end: " + e.getClass().getSimpleName());
        }
    }

    /** { active, route, earpiece (máy có loa trong), headset, bluetooth } cho web (nút Loa). */
    synchronized JSObject state(Context ctx) {
        JSObject o = new JSObject();
        AudioManager am = am(ctx);
        boolean[] avail = am != null ? available(am) : new boolean[3];
        o.put("active", active);
        o.put("route", route != null ? route : JSObject.NULL);
        o.put("earpiece", avail[0]);
        o.put("headset", avail[1]);
        o.put("bluetooth", avail[2]);
        return o;
    }

    // ---------------------------------------------------------------------------------

    private void apply(Context ctx, AudioManager am) {
        boolean[] avail = available(am);
        String r = CallLogic.chooseRoute(requested, video, avail[0], avail[1], avail[2]);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo dev = communicationDevice(am, r);
                if (dev != null) am.setCommunicationDevice(dev);
            } else {
                // Tai nghe cắm dây / Bluetooth: tắt loa ngoài là đủ, hệ thống tự đưa tiếng vào tai nghe.
                am.setSpeakerphoneOn(CallLogic.ROUTE_SPEAKER.equals(r));
            }
            route = r;
        } catch (RuntimeException e) {
            Log.w(TAG, "route: " + e.getClass().getSimpleName());
        }
        updateProximity(ctx);
    }

    /** [loa trong, tai nghe cắm dây / USB, Bluetooth] đang có. */
    private static boolean[] available(AudioManager am) {
        boolean[] out = new boolean[3];
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) mark(out, d.getType());
            } else {
                for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) mark(out, d.getType());
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "devices: " + e.getClass().getSimpleName());
        }
        return out;
    }

    private static void mark(boolean[] out, int type) {
        String r = CallLogic.routeOfDevice(type);
        if (CallLogic.ROUTE_EARPIECE.equals(r)) out[0] = true;
        else if (CallLogic.ROUTE_HEADSET.equals(r)) out[1] = true;
        else if (CallLogic.ROUTE_BLUETOOTH.equals(r)) out[2] = true;
    }

    private static AudioDeviceInfo communicationDevice(AudioManager am, String route) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null;
        List<AudioDeviceInfo> list = am.getAvailableCommunicationDevices();
        for (AudioDeviceInfo d : list) if (route.equals(CallLogic.routeOfDevice(d.getType()))) return d;
        return null;
    }

    private void updateProximity(Context ctx) {
        PowerManager pm = (PowerManager) ctx.getApplicationContext().getSystemService(Context.POWER_SERVICE);
        boolean supported = pm != null && pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK);
        if (active && CallLogic.useProximity(video, route, supported)) {
            if (proximity == null) {
                proximity = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "PawNail:call-proximity");
                proximity.setReferenceCounted(false);
            }
            if (!proximity.isHeld()) {
                try {
                    proximity.acquire(PROXIMITY_MAX_MS);
                } catch (RuntimeException e) {
                    Log.w(TAG, "proximity: " + e.getClass().getSimpleName());
                }
            }
        } else {
            releaseProximity();
        }
    }

    private void releaseProximity() {
        if (proximity != null && proximity.isHeld()) {
            try {
                // Màn hình đang tắt vì áp tai: chỉ bật lại khi bỏ máy ra khỏi tai.
                proximity.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY);
            } catch (RuntimeException ignored) {}
        }
    }

    private static AudioManager am(Context ctx) {
        return (AudioManager) ctx.getApplicationContext().getSystemService(Context.AUDIO_SERVICE);
    }
}
