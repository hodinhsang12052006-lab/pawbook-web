package com.bitpawos.app;

import android.content.Context;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.util.List;

/**
 * Âm thanh của cuộc gọi WebRTC trong WebView (versionCode 4+), do web điều khiển qua PawNailNative:
 *  - begin: AudioManager.MODE_IN_COMMUNICATION (khử vọng / âm lượng cuộc gọi), chọn đường mặc định (thoại → loa trong
 *    như cuộc gọi điện thoại, video → loa ngoài; tai nghe / Bluetooth đang nối luôn được ưu tiên — CallLogic.chooseRoute);
 *  - setRoute: nút Loa của màn hình gọi — Android 12+ setCommunicationDevice, máy cũ setSpeakerphoneOn (Bluetooth chỉ
 *    được chọn từ Android 12: máy cũ cần startBluetoothSco + quyền BLUETOOTH mà app không có);
 *  - cắm / rút tai nghe, nối Bluetooth giữa cuộc gọi (AudioDeviceCallback): chọn lại đường và báo web (sự kiện
 *    "callAudio") để nhãn nút Loa luôn đúng;
 *  - cảm biến tiệm cận khi gọi thoại bằng loa trong, chỉ khi app đang hiện (MainActivity onStart / onStop);
 *  - end: trả chế độ âm thanh về NORMAL (không bao giờ trả lại chế độ cuộc gọi — CallLogic.modeToRestore), tắt loa ngoài,
 *    rồi kiểm lại sau 2 s (mã âm thanh của WebView có thể trả lại chế độ nó đã lưu SAU end()).
 * Mọi lỗi của AudioManager (máy lạ, thiếu quyền) chỉ ghi log — cuộc gọi vẫn tiếp tục với đường âm thanh của hệ thống.
 */
final class CallAudio {

    private static final String TAG = "PawNailCallAudio";
    private static final long PROXIMITY_MAX_MS = 4L * 60 * 60 * 1000;
    private static final CallAudio INSTANCE = new CallAudio();

    static CallAudio get() {
        return INSTANCE;
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean active = false;
    private int prevMode = AudioManager.MODE_NORMAL;
    private boolean video = false;
    /** Lựa chọn của nút Loa (null = mặc định theo loại cuộc gọi / thiết bị đang nối). */
    private String requested = null;
    private String route = null;
    /** Thiết bị dùng được ở lần chọn đường gần nhất (phát hiện tai nghe / Bluetooth VỪA nối). */
    private boolean[] lastAvail = new boolean[3];
    /** MainActivity đang hiện trên màn hình (onStart … onStop). */
    private boolean uiVisible = true;
    private Context app;
    private PowerManager.WakeLock proximity;
    private boolean deviceCallbackOn = false;

    private final AudioDeviceCallback deviceCallback = new AudioDeviceCallback() {
        @Override
        public void onAudioDevicesAdded(AudioDeviceInfo[] added) {
            onDevicesChanged();
        }

        @Override
        public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) {
            onDevicesChanged();
        }
    };

    private final Runnable recheckModeTask = this::recheckMode;

    private CallAudio() {}

    synchronized boolean isActive() {
        return active;
    }

    /** Bắt đầu (hoặc cập nhật loại) cuộc gọi. Gọi lại nhiều lần được. */
    synchronized void begin(Context ctx, boolean video) {
        AudioManager am = am(ctx);
        if (am == null) return;
        app = ctx.getApplicationContext();
        if (!active) {
            main.removeCallbacks(recheckModeTask);
            try {
                prevMode = am.getMode();
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            } catch (RuntimeException e) {
                Log.w(TAG, "begin: " + e.getClass().getSimpleName());
            }
            active = true;
            requested = null;
            lastAvail = available(am);
            registerDeviceCallback(am);
        }
        this.video = video;
        apply(am);
    }

    /** Gọi thoại ↔ video giữa cuộc gọi: chỉ đổi đường mặc định khi người dùng chưa tự chọn loa. */
    synchronized void setVideo(Context ctx, boolean video) {
        if (!active || this.video == video) return;
        this.video = video;
        AudioManager am = am(ctx);
        if (am != null) apply(am);
    }

    /** "speaker" | "earpiece" | "auto" (về mặc định). */
    synchronized void setRoute(Context ctx, String req) {
        if (!active) return;
        requested = CallLogic.ROUTE_SPEAKER.equals(req) || CallLogic.ROUTE_EARPIECE.equals(req) ? req : null;
        AudioManager am = am(ctx);
        if (am != null) apply(am);
    }

    synchronized void end(Context ctx) {
        releaseProximity();
        if (!active) return;
        active = false;
        requested = null;
        route = null;
        AudioManager am = am(ctx);
        if (am == null) return;
        unregisterDeviceCallback(am);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
            else am.setSpeakerphoneOn(false); // KHÔNG trả lại giá trị đã lưu: lúc begin() WebView có thể đã bật loa ngoài
            am.setMode(CallLogic.modeToRestore(prevMode));
        } catch (RuntimeException e) {
            Log.w(TAG, "end: " + e.getClass().getSimpleName());
        }
        main.removeCallbacks(recheckModeTask);
        main.postDelayed(recheckModeTask, CallLogic.MODE_RECHECK_MS);
    }

    /** MainActivity onStart (true) / onStop (false): cảm biến tiệm cận chỉ dùng khi app đang hiện. */
    synchronized void setUiVisible(Context ctx, boolean visible) {
        uiVisible = visible;
        if (!visible) releaseProximity();
        else if (active) updateProximity(ctx);
    }

    /** { active, route (đường đang dùng thật), earpiece (máy có loa trong), headset, bluetooth } cho web (nút Loa). */
    synchronized JSObject state(Context ctx) {
        JSObject o = new JSObject();
        AudioManager am = am(ctx);
        boolean[] avail = am != null ? available(am) : new boolean[3];
        String r = active && am != null ? actualRoute(am, avail) : null;
        o.put("active", active);
        o.put("route", r != null ? r : JSObject.NULL);
        o.put("earpiece", avail[0]);
        o.put("headset", avail[1]);
        o.put("bluetooth", avail[2]);
        return o;
    }

    // ---------------------------------------------------------------------------------

    private void apply(AudioManager am) {
        boolean[] avail = available(am);
        lastAvail = avail;
        String r = CallLogic.chooseRoute(requested, video, avail[0], avail[1], avail[2]);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo dev = communicationDevice(am, r);
                if (dev != null) am.setCommunicationDevice(dev);
            } else {
                // Tai nghe cắm dây / USB: tắt loa ngoài là đủ, hệ thống tự đưa tiếng vào tai nghe.
                am.setSpeakerphoneOn(CallLogic.ROUTE_SPEAKER.equals(r));
            }
            route = r;
        } catch (RuntimeException e) {
            Log.w(TAG, "route: " + e.getClass().getSimpleName());
        }
        updateProximity(app);
    }

    /** Cắm / rút / nối thiết bị (luồng chính): chọn lại đường, báo web nhãn mới của nút Loa. */
    private void onDevicesChanged() {
        JSObject s;
        synchronized (this) {
            if (!active || app == null) return;
            AudioManager am = am(app);
            if (am == null) return;
            requested = CallLogic.requestAfterDevicesChanged(requested, lastAvail, available(am));
            apply(am);
            s = state(app);
        }
        PawNailNativePlugin.emitAudioState(s);
    }

    private void registerDeviceCallback(AudioManager am) {
        if (deviceCallbackOn) return;
        try {
            // Gọi ngay onAudioDevicesAdded với thiết bị hiện có — lastAvail đã đọc ở begin() nên không đổi lựa chọn.
            am.registerAudioDeviceCallback(deviceCallback, main);
            deviceCallbackOn = true;
        } catch (RuntimeException e) {
            Log.w(TAG, "device callback: " + e.getClass().getSimpleName());
        }
    }

    private void unregisterDeviceCallback(AudioManager am) {
        if (!deviceCallbackOn) return;
        deviceCallbackOn = false;
        try {
            am.unregisterAudioDeviceCallback(deviceCallback);
        } catch (RuntimeException ignored) {}
    }

    /** 2 s sau end(): WebView vừa trả lại MODE_IN_COMMUNICATION nó đã lưu và không còn ai ghi âm → về NORMAL. */
    private void recheckMode() {
        synchronized (this) {
            if (app == null) return;
            AudioManager am = am(app);
            if (am == null) return;
            try {
                boolean recording = !am.getActiveRecordingConfigurations().isEmpty();
                if (CallLogic.resetModeLater(active, am.getMode(), recording)) am.setMode(AudioManager.MODE_NORMAL);
            } catch (RuntimeException e) {
                Log.w(TAG, "recheck: " + e.getClass().getSimpleName());
            }
        }
    }

    /** Đường đang dùng THẬT (WebView có thể tự đổi loa sau lần chọn của mình). */
    private String actualRoute(AudioManager am, boolean[] avail) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo d = am.getCommunicationDevice();
                String r = d != null ? CallLogic.routeOfDevice(d.getType()) : null;
                return r != null ? r : route;
            }
            return CallLogic.legacyRoute(am.isSpeakerphoneOn(), avail[0], avail[1]);
        } catch (RuntimeException e) {
            return route;
        }
    }

    /** [loa trong, tai nghe cắm dây / USB, Bluetooth (Android 12+)] đang có — CallLogic.availableRoutes. */
    private static boolean[] available(AudioManager am) {
        try {
            int[] types;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                List<AudioDeviceInfo> list = am.getAvailableCommunicationDevices();
                types = new int[list.size()];
                for (int i = 0; i < types.length; i++) types[i] = list.get(i).getType();
            } else {
                AudioDeviceInfo[] devs = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                types = new int[devs.length];
                for (int i = 0; i < types.length; i++) types[i] = devs[i].getType();
            }
            return CallLogic.availableRoutes(Build.VERSION.SDK_INT, types);
        } catch (RuntimeException e) {
            Log.w(TAG, "devices: " + e.getClass().getSimpleName());
            return new boolean[3];
        }
    }

    private static AudioDeviceInfo communicationDevice(AudioManager am, String route) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null;
        List<AudioDeviceInfo> list = am.getAvailableCommunicationDevices();
        for (AudioDeviceInfo d : list) if (route.equals(CallLogic.routeOfDevice(d.getType()))) return d;
        return null;
    }

    private void updateProximity(Context ctx) {
        if (ctx == null) return;
        PowerManager pm = (PowerManager) ctx.getApplicationContext().getSystemService(Context.POWER_SERVICE);
        boolean supported = pm != null && pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK);
        if (active && CallLogic.useProximity(video, route, supported, uiVisible)) {
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
