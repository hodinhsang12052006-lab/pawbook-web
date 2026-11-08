package com.bitpawos.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.CapConfig;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

// KHÔNG gọi webView.setWebChromeClient(...) ở đây. Capacitor đã gắn sẵn
// BridgeWebChromeClient (Bridge.java), lo cả <input type=file> (ảnh Try-On,
// portfolio, đính kèm chat), video toàn màn hình, hộp thoại JS và quyền
// camera/micro cho getUserMedia (VIDEO_CAPTURE → CAMERA, AUDIO_CAPTURE →
// RECORD_AUDIO + MODIFY_AUDIO_SETTINGS). Bản cũ thay nó bằng một
// WebChromeClient trần, làm mọi nút chọn ảnh trên Android im lặng không mở.
public class MainActivity extends BridgeActivity {

    private static final String TAG = "PawNailMain";
    /** Chờ JS điều hướng mềm (window.__pawnailOpenUrl) tối đa bấy nhiêu, quá thì tải cả trang. */
    private static final long SOFT_NAV_TIMEOUT_MS = 800;

    /** false trong lúc super.onCreate (BridgeActivity.load() gọi onNewIntent với intent khởi động). */
    private boolean created = false;

    /** Trình hiển thị WebView chết liên tiếp (tạo lại activity tối đa 2 lần / 30 s, quá thì đóng hẳn). */
    private static long rendererGoneAt = 0;
    private static int rendererGoneCount = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin cục bộ phải đăng ký TRƯỚC super.onCreate (lúc đó Bridge được tạo).
        registerPlugin(PawNailNativePlugin.class);

        // Mở nguội từ thông báo / lối tắt hội thoại / bong bóng (extra pn_url): cho Bridge tải
        // THẲNG trang đó (server.appStartPath) thay vì tải trang chủ rồi mới chuyển — nhanh
        // hơn và không huỷ giữa chừng lượt tải đầu.
        // savedInstanceState != null: hệ thống TẠO LẠI activity (tiến trình bị giết khi ở nền, đổi cấu hình...) với
        // bản intent gốc nó đã lưu — removeExtra ở lần trước chỉ sửa bản trong bộ nhớ, nên mở lại từ biểu tượng app
        // sẽ lại nhảy vào cuộc trò chuyện cũ. Chỉ xử lý pn_url ở lần tạo đầu tiên.
        String coldPath = savedInstanceState == null ? takeLaunchPath(getIntent()) : null;
        if (savedInstanceState != null) stripLaunchExtras(getIntent());
        if (coldPath != null) this.config = configWithStartPath(coldPath);

        super.onCreate(savedInstanceState);
        created = true;
        if (this.bridge == null) return; // máy không có WebView: Capacitor đã hiện màn báo lỗi

        if (coldPath != null && this.config == null) loadPath(coldPath, false);

        // server.errorPath (offline.html) chỉ nên hiện khi KHÔNG tải được trang
        // (mất mạng, DNS, SSL): onReceivedError của Capacitor vẫn lo việc đó.
        // BridgeWebViewClient mặc định còn nạp offline.html cho cả lỗi HTTP của
        // trang chính (404 tin đã gỡ, 5xx), nên mở link một tin đã hết hạn sẽ
        // báo "mất mạng". Vẫn dùng BridgeWebViewClient của Capacitor, chỉ bỏ qua
        // lỗi HTTP của trang chính để trang 404/lỗi của website tự hiển thị.
        // (Lỗi HTTP của tài nguyên con vẫn đi qua super như cũ. Không plugin nào
        // đang cài nghe onReceivedHttpError của trang chính.)
        this.bridge.setWebViewClient(
            new BridgeWebViewClient(this.bridge) {
                @Override
                public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                    if (!request.isForMainFrame()) {
                        super.onReceivedHttpError(view, request, errorResponse);
                    }
                }

                @Override
                public void onPageStarted(WebView view, String url, Bitmap favicon) {
                    // Tải trang mới = JS cũ (và hội thoại đang mở nó báo) không còn: trang
                    // mới sẽ tự gọi PawNailNative.setActiveConversation lại nếu mở chat.
                    AppState.setActiveConversation(null);
                    // ... và cuộc gọi WebRTC của trang cũ cũng đã mất (tải lại / điều hướng cứng giữa cuộc gọi): trang
                    // không kịp gọi stopOngoingCall → tắt foreground service / chế độ âm thanh / giữ màn hình ở đây.
                    endNativeCall();
                    super.onPageStarted(view, url, favicon);
                }

                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    if (super.onRenderProcessGone(view, detail)) return true; // plugin nào đó đã xử lý
                    // Mọi WebView của app dùng CHUNG 1 tiến trình hiển thị: bong bóng chat hết bộ nhớ cũng giết
                    // trình hiển thị của app chính. Trả false (mặc định của Capacitor) = WebView giết luôn cả app →
                    // thay vào đó tạo lại activity (WebView mới).
                    onMainRendererGone();
                    return true;
                }
            }
        );

        // Kênh thông báo (Tin nhắn / Cuộc gọi / Thông báo chung) — tên theo ngôn ngữ máy. Lưu sẵn User-Agent của
        // WebView cho request native (trả lời nhanh, ảnh đại diện) lúc app đã tắt.
        Context app = getApplicationContext();
        ChatNotifications.runAsync(() -> {
            ChatNotifications.ensureChannels(app);
            ChatApi.userAgent(app);
        });
    }

    private void onMainRendererGone() {
        long now = SystemClock.elapsedRealtime();
        rendererGoneCount = now - rendererGoneAt < 30_000 ? rendererGoneCount + 1 : 1;
        rendererGoneAt = now;
        Log.w(TAG, "WebView renderer gone (" + rendererGoneCount + ")");
        if (rendererGoneCount > 2) {
            finish();
            return;
        }
        recreate();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Gọi lần đầu từ BridgeActivity.load() (trong super.onCreate) với intent khởi động:
        // pn_url của intent đó đã được xử lý ở onCreate.
        if (!created || this.bridge == null) return;
        String path = takeLaunchPath(intent);
        if (path != null) loadPath(path, true);
    }

    @Override
    public void onResume() {
        super.onResume();
        AppState.setMainResumed(true);
        // Quay lại app đang mở sẵn một hội thoại: thông báo của hội thoại đó không còn cần.
        String active = AppState.getActiveConversation();
        if (active != null) ChatNotifications.clearAsync(this, active);
        // Cuộc gọi đang đổ chuông: web đổ chuông trong app → thôi chuông của thông báo (không kêu 2 lần).
        Context app = getApplicationContext();
        ChatNotifications.runAsync(() -> CallNotifications.cancelRinging(app));
    }

    @Override
    public void onPause() {
        AppState.setMainResumed(false);
        super.onPause();
    }

    @Override
    public void onStart() {
        super.onStart();
        // Cảm biến tiệm cận của cuộc gọi thoại (loa trong) chỉ khi app đang hiện — như app Điện thoại.
        CallAudio.get().setUiVisible(this, true);
    }

    @Override
    public void onStop() {
        CallAudio.get().setUiVisible(this, false);
        super.onStop();
    }

    @Override
    public void onDestroy() {
        // WebView (và cuộc gọi WebRTC trong nó) bị huỷ: thôi giữ foreground service / chế độ âm thanh cuộc gọi. Plugin cũng
        // làm việc này (handleOnDestroy) — ở đây cho chắc khi Bridge không được tạo.
        endNativeCall();
        super.onDestroy();
    }

    /** Cuộc gọi của WebView chính đã mất: tắt "đang trong cuộc gọi", trả chế độ âm thanh, thôi giữ màn hình sáng. */
    private void endNativeCall() {
        if (OngoingCallService.isRunning()) OngoingCallService.stop(this);
        CallAudio.get().end(this);
        try {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (RuntimeException ignored) {}
    }

    /**
     * pn_url hợp lệ của intent (rồi xoá khỏi intent để không mở lại khi tạo lại activity), hoặc
     * null. Bỏ qua khi app được mở lại từ màn đa nhiệm (intent cũ được giao lại).
     *
     * MainActivity được export: app khác cũng gửi được pn_url. Chỉ intent mang khoá nội bộ (thông báo, bong bóng →
     * app chính) được mở path tuỳ ý của bitpawos.com; không có khoá (lối tắt hội thoại do launcher lưu, app lạ) thì
     * chỉ mở đúng trang một cuộc trò chuyện (/messages?c=<id>).
     */
    private String takeLaunchPath(Intent intent) {
        if (intent == null) return null;
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            stripLaunchExtras(intent);
            return null;
        }
        String path = intent.getStringExtra(AppLinks.EXTRA_URL);
        String cid = intent.getStringExtra(ChatNotifications.EXTRA_CID);
        String answerCall = intent.getStringExtra(CallNotifications.EXTRA_ANSWER);
        String openCall = intent.getStringExtra(CallNotifications.EXTRA_OPEN);
        boolean trusted = AppLinks.hasValidKey(this, intent);
        stripLaunchExtras(intent);
        // Thông báo cuộc gọi đến (CallNotifications, chỉ intent có khoá nội bộ): gỡ thông báo (dừng chuông — web đổ chuông
        // trong app); nút "Trả lời" → web tự nghe máy đúng cuộc gọi đó (lấy bằng takeCallAction lúc mở nguội, hoặc sự
        // kiện callAction khi app đang chạy).
        if (trusted && CallLogic.isCallId(answerCall)) {
            CallNotifications.cancel(this, answerCall);
            AppState.setPendingCallAction("answer", answerCall);
            PawNailNativePlugin.emitCallAction("answer", answerCall);
        } else if (trusted && CallLogic.isCallId(openCall)) {
            CallNotifications.cancel(this, openCall);
        }
        if (!AppLinks.isSafePath(path)) return null;
        if (!trusted && !AppLinks.isConversationOpenPath(path)) {
            Log.w(TAG, "ignored untrusted pn_url");
            return null;
        }
        // Mở từ thông báo của một hội thoại: gỡ thông báo + quên lịch sử của nó (không khoá: chỉ đúng hội thoại đang mở).
        if (AppLinks.isConversationId(cid) && (trusted || cid.equals(AppLinks.queryParam(path, "c")))) {
            ChatNotifications.clearAsync(this, cid);
        }
        return path;
    }

    private static void stripLaunchExtras(Intent intent) {
        if (intent == null) return;
        intent.removeExtra(AppLinks.EXTRA_URL);
        intent.removeExtra(ChatNotifications.EXTRA_CID);
        intent.removeExtra(CallNotifications.EXTRA_ANSWER);
        intent.removeExtra(CallNotifications.EXTRA_OPEN);
        intent.removeExtra(AppLinks.EXTRA_KEY);
    }

    /** capacitor.config.json (assets) + server.appStartPath = path, hoặc null nếu không làm được. */
    private CapConfig configWithStartPath(String path) {
        try (InputStream in = getAssets().open("capacitor.config.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) != -1) buf.write(b, 0, n);
            JSONObject json = new JSONObject(buf.toString(StandardCharsets.UTF_8.name()));
            JSONObject server = json.optJSONObject("server");
            if (server == null || !AppLinks.ORIGIN.equals(server.optString("url", ""))) return null;
            server.put("appStartPath", path);
            File dir = new File(getCacheDir(), "pn_launch_config");
            if (!dir.exists() && !dir.mkdirs()) return null;
            try (FileOutputStream out = new FileOutputStream(new File(dir, "capacitor.config.json"))) {
                out.write(json.toString().getBytes(StandardCharsets.UTF_8));
            }
            CapConfig cfg = CapConfig.loadFromFile(this, dir.getAbsolutePath());
            return path.equals(cfg.getStartPath()) && AppLinks.ORIGIN.equals(cfg.getServerUrl()) ? cfg : null;
        } catch (Exception e) {
            Log.w(TAG, "launch config fallback: " + e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * Mở path trong WebView chính. App đang chạy (warm): thử điều hướng mềm qua
     * window.__pawnailOpenUrl(path) nếu web có định nghĩa (trả true = đã xử lý, giữ nguyên
     * trạng thái trang); không có / quá hạn → tải https://www.bitpawos.com + path.
     */
    private void loadPath(String path, boolean trySoft) {
        WebView wv = this.bridge.getWebView();
        if (wv == null) return;
        String target = AppLinks.absolute(path);
        if (!trySoft) {
            wv.loadUrl(target);
            return;
        }
        AtomicBoolean done = new AtomicBoolean(false);
        Runnable hard = () -> {
            if (!done.compareAndSet(false, true)) return;
            // Đang trong cuộc gọi (WebRTC trong chính WebView này): tải lại trang = rớt cuộc gọi. Chạm thông báo chat lúc
            // đó chỉ đưa app lên trước; JS chậm / không điều hướng mềm được thì KHÔNG tải cứng.
            if (OngoingCallService.isRunning() || CallAudio.get().isActive()) {
                Log.w(TAG, "in a call: hard navigation skipped");
                return;
            }
            wv.loadUrl(target);
        };
        try {
            String js =
                "(function(p){try{if(typeof window.__pawnailOpenUrl==='function'&&window.__pawnailOpenUrl(p)===true)return 'soft'}catch(e){}return 'hard'})(" +
                JSONObject.quote(path) +
                ")";
            wv.evaluateJavascript(js, result -> {
                if ("\"soft\"".equals(result)) done.set(true);
                else hard.run();
            });
            wv.postDelayed(hard, SOFT_NAV_TIMEOUT_MS);
        } catch (RuntimeException e) {
            hard.run();
        }
    }
}
