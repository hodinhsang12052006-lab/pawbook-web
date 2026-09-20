import UIKit
import Capacitor
import WebKit

// Cấp quyền Camera/Micro cho WKWebView khi trang web gọi
// navigator.mediaDevices.getUserMedia() (cuộc gọi thoại/video WebRTC trong
// CallManager.tsx). Từ iOS 15, nếu app không tự implement
// WKUIDelegate.requestMediaCapturePermissionFor, WebKit mặc định TỪ CHỐI
// mọi yêu cầu capture media — dù Info.plist đã có đủ
// NSCameraUsageDescription/NSMicrophoneUsageDescription, cuộc gọi vẫn câm
// lặng thất bại nếu thiếu class này.
//
// Main.storyboard trỏ customClass ở đây thay vì thẳng CAPBridgeViewController
// mặc định — chỉ đổi 1 dòng customClass, không đổi gì khác trong flow khởi
// tạo của Capacitor.
class ViewController: CAPBridgeViewController, WKUIDelegate {

    override func viewDidLoad() {
        super.viewDidLoad()
        self.bridge?.webView?.uiDelegate = self
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        // App chỉ có 1 nguồn duy nhất (server.url trong capacitor.config.ts)
        // nên không cần kiểm tra origin — cấp thẳng, hệ điều hành đã tự
        // hiện chuỗi NSCameraUsageDescription/NSMicrophoneUsageDescription
        // cho người dùng xác nhận ở lần xin quyền hệ thống đầu tiên.
        decisionHandler(.grant)
    }
}
