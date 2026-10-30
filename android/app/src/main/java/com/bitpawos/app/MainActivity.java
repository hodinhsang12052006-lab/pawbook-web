package com.bitpawos.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

// KHÔNG gọi webView.setWebChromeClient(...) ở đây. Capacitor đã gắn sẵn
// BridgeWebChromeClient (Bridge.java), lo cả <input type=file> (ảnh Try-On,
// portfolio, đính kèm chat), video toàn màn hình, hộp thoại JS và quyền
// camera/micro cho getUserMedia (VIDEO_CAPTURE → CAMERA, AUDIO_CAPTURE →
// RECORD_AUDIO + MODIFY_AUDIO_SETTINGS). Bản cũ thay nó bằng một
// WebChromeClient trần, làm mọi nút chọn ảnh trên Android im lặng không mở.
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin cục bộ phải đăng ký TRƯỚC super.onCreate (lúc đó Bridge được tạo).
        registerPlugin(PawNailNativePlugin.class);
        super.onCreate(savedInstanceState);

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
            }
        );
    }
}
