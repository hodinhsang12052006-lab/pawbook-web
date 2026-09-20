package com.bitpawos.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int MEDIA_PERMISSION_REQUEST_CODE = 7001;
    private PermissionRequest pendingWebPermissionRequest;

    // Cấp quyền Camera/Micro cho WebView khi trang web gọi
    // navigator.mediaDevices.getUserMedia() (cuộc gọi thoại/video WebRTC
    // trong CallManager.tsx). Mặc định BridgeActivity của Capacitor KHÔNG tự
    // xử lý PermissionRequest này — dù AndroidManifest đã khai báo CAMERA +
    // RECORD_AUDIO, WebView vẫn tự động DENY mọi yêu cầu capture media nếu
    // không có đoạn override này, khiến mọi cuộc gọi trong app native trên
    // Android câm lặng thất bại (không nghe/không thấy hình, không crash,
    // không log lỗi rõ ràng).
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    List<String> resourcesNeeded = new ArrayList<>();
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            resourcesNeeded.add(Manifest.permission.CAMERA);
                        } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            resourcesNeeded.add(Manifest.permission.RECORD_AUDIO);
                        }
                    }

                    List<String> missingRuntimePermissions = new ArrayList<>();
                    for (String permission : resourcesNeeded) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, permission)
                                != PackageManager.PERMISSION_GRANTED) {
                            missingRuntimePermissions.add(permission);
                        }
                    }

                    if (missingRuntimePermissions.isEmpty()) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebPermissionRequest = request;
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            missingRuntimePermissions.toArray(new String[0]),
                            MEDIA_PERMISSION_REQUEST_CODE
                        );
                    }
                });
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MEDIA_PERMISSION_REQUEST_CODE || pendingWebPermissionRequest == null) {
            return;
        }

        boolean allGranted = grantResults.length > 0;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
        } else {
            pendingWebPermissionRequest.deny();
        }
        pendingWebPermissionRequest = null;
    }
}
