package com.bitpawos.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Cửa sổ bong bóng chat (Android 11+). Hoạt động riêng, KHÔNG phải BridgeActivity: một
 * Capacitor Bridge thứ 2 sẽ ghi đè PushNotificationsPlugin.staticBridge, mở thêm kết nối
 * Pusher và đổ chuông cuộc gọi 2 lần. Chỉ là một WebView trần dùng chung cookie (cùng phiên
 * đăng nhập) với app chính, mở đúng hội thoại với ?bubble=1 và UA có "PawNailBubble" để web
 * chỉ hiện khung chat (không header / thanh điều hướng / gọi điện / lời mời).
 *
 * Điều hướng: chỉ trang chat của ĐÚNG hội thoại này (?c=<cid>) ở lại; mọi trang khác của bitpawos.com (kể cả
 * /messages trần) mở app chính (pn_url + khoá nội bộ); host khác mở trình duyệt hệ thống; scheme lạ (intent:, file:,
 * javascript:) bị chặn.
 */
public class BubbleActivity extends AppCompatActivity {

    private static final String TAG = "PawNailBubble";

    private WebView webView;
    private String cid;
    private String startUrl;
    private boolean pageCommitted = false;
    private ValueCallback<Uri[]> fileCallback;
    private ActivityResultLauncher<Intent> filePicker;
    private OnBackPressedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb != null) cb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
        });

        Intent intent = getIntent();
        String id = intent.getStringExtra(ChatNotifications.EXTRA_CID);
        cid = AppLinks.isConversationId(id) ? id : null;
        if (cid == null) {
            // Bong bóng luôn thuộc về 1 hội thoại; không có id = không có gì để hiện (web không có danh sách trong bong bóng).
            finish();
            return;
        }
        String path = intent.getStringExtra(AppLinks.EXTRA_URL);
        if (!AppLinks.staysInBubble(path, cid)) path = AppLinks.conversationPath(cid);
        startUrl = AppLinks.absolute(withBubbleFlag(path));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.pn_bubble_background));
        try {
            webView = new WebView(this);
        } catch (RuntimeException e) {
            // WebView đang được cập nhật / bị gỡ: không có gì để hiện.
            Log.w(TAG, "WebView unavailable: " + e.getClass().getSimpleName());
            finish();
            return;
        }
        webView.setBackgroundColor(ContextCompat.getColor(this, R.color.pn_bubble_background));
        root.addView(webView, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Tự đệm theo bàn phím / thanh hệ thống (Android 15+ ép edge-to-edge: adjustResize
        // không còn tự co nội dung).
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets i = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime() | WindowInsetsCompat.Type.displayCutout()
            );
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        configureWebView();

        backCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(startUrl);
        }
    }

    /** Chèn "bubble=1" vào query (trước #fragment nếu có). */
    static String withBubbleFlag(String path) {
        String frag = "";
        int hash = path.indexOf('#');
        if (hash >= 0) {
            frag = path.substring(hash);
            path = path.substring(0, hash);
        }
        return path + (path.contains("?") ? "&" : "?") + "bubble=1" + frag;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " " + AppLinks.UA_APP + " " + AppLinks.UA_BUBBLE);

        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new BubbleClient());
        webView.setWebChromeClient(new BubbleChrome());
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Uri u = Uri.parse(url);
            if ("https".equalsIgnoreCase(u.getScheme())) openExternal(u);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        AppState.setBubbleOpen(cid, true);
        if (cid != null) {
            // Bong bóng mở ra = đã xem: tin sau chỉ hiện tin mới (hệ thống tự ẩn thông báo khỏi khay).
            String id = cid;
            Context app = getApplicationContext();
            ChatNotifications.runAsync(() -> ChatStore.markRead(app, id));
        }
    }

    @Override
    protected void onPause() {
        AppState.setBubbleOpen(cid, false);
        if (webView != null) webView.onPause();
        try {
            CookieManager.getInstance().flush();
        } catch (RuntimeException ignored) {}
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        AppState.setBubbleOpen(cid, false);
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            ((FrameLayout) webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ---------------------------------------------------------------------------------

    /** true = đã xử lý (WebView KHÔNG tải); false = để WebView tải trong bong bóng. */
    private boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (AppLinks.isOwnHost(u)) {
            String path = AppLinks.pathOf(u);
            // Chỉ đúng hội thoại của bong bóng (?c=<cid>) ở lại; /messages trần, ?to=, hội thoại khác, trang khác → app chính.
            if (path != null && AppLinks.staysInBubble(path, cid)) return false;
            if (path != null) openInMain(path);
            // Lần tải đầu đã bị chuyển đi (vd chưa đăng nhập → /auth): đừng để bong bóng trắng trơn.
            if (!pageCommitted && webView != null) webView.post(() -> showMessagePage(getString(R.string.bubble_continue_in_app)));
            return true;
        }
        switch (scheme) {
            case "https":
            case "http":
            case "mailto":
            case "tel":
            case "sms":
                openExternal(u);
                return true;
            default:
                return true;
        }
    }

    private void openInMain(String path) {
        Intent i = AppLinks.withKey(
            this,
            new Intent(this, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(AppLinks.EXTRA_URL, path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
        );
        try {
            startActivity(i);
        } catch (RuntimeException e) {
            Log.w(TAG, "cannot open main: " + e.getClass().getSimpleName());
        }
    }

    private void openExternal(Uri u) {
        Intent i = new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "no app for link");
        }
    }

    /** Trang báo lỗi / chuyển tiếp nhỏ, kèm nút tải lại hội thoại. */
    private void showMessagePage(String message) {
        if (webView == null) return;
        String html =
            "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>" +
            "<style>body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
            "background:#020617;color:#e2e8f0;font:16px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}" +
            "a{margin-top:20px;padding:12px 28px;border-radius:999px;background:#CE6D2C;color:#fff;text-decoration:none;font-weight:600}</style>" +
            "</head><body><div>" +
            TextUtils.htmlEncode(message) +
            "</div><a href='" +
            TextUtils.htmlEncode(startUrl) +
            "'>" +
            TextUtils.htmlEncode(getString(R.string.bubble_retry)) +
            "</a></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private final class BubbleClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            return route(request.getUrl());
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            super.onPageCommitVisible(view, url);
            if (url != null && AppLinks.isOwnHost(Uri.parse(url))) pageCommitted = true;
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            super.doUpdateVisitedHistory(view, url, isReload);
            if (backCallback != null) backCallback.setEnabled(view.canGoBack());
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) showMessagePage(getString(R.string.bubble_offline));
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // Trình hiển thị chết: bỏ WebView này, đóng bong bóng (mở lại sẽ tạo mới).
            if (webView == view) {
                ((FrameLayout) view.getParent()).removeView(view);
                view.destroy();
                webView = null;
            }
            finish();
            return true;
        }
    }

    private final class BubbleChrome extends WebChromeClient {

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                Intent i = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                String[] types = params.getAcceptTypes();
                List<String> mimes = new ArrayList<>();
                if (types != null) {
                    for (String t : types) {
                        if (t == null) continue;
                        for (String part : t.split(",")) {
                            String m = part.trim();
                            if (m.contains("/")) mimes.add(m);
                        }
                    }
                }
                if (mimes.size() > 1) {
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0]));
                }
                filePicker.launch(i);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                callback.onReceiveValue(null);
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            // Chỉ cấp micro/camera cho chính bitpawos.com và chỉ khi app đã có quyền Android
            // (xin quyền làm ở app chính). Gọi điện bị tắt trong bong bóng.
            if (!AppLinks.isOwnHost(request.getOrigin())) {
                request.deny();
                return;
            }
            List<String> grant = new ArrayList<>();
            for (String r : request.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(Manifest.permission.RECORD_AUDIO)) grant.add(r);
                else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(Manifest.permission.CAMERA)) grant.add(r);
            }
            if (grant.isEmpty()) request.deny();
            else request.grant(grant.toArray(new String[0]));
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, false, false);
        }

        private boolean has(String permission) {
            return ContextCompat.checkSelfPermission(BubbleActivity.this, permission) == PackageManager.PERMISSION_GRANTED;
        }
    }
}
