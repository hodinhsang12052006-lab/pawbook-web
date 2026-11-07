package com.bitpawos.app;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Trạng thái giao diện mà service đẩy cần biết để không báo trùng:
 *  - MainActivity đang ở tiền cảnh (resumed) hay không;
 *  - hội thoại web đang mở (JS gọi PawNailNative.setActiveConversation);
 *  - cửa sổ bong bóng nào đang mở (BubbleActivity resumed).
 * Chỉ sống trong bộ nhớ tiến trình: tiến trình chết = app không ở tiền cảnh = đúng.
 */
final class AppState {

    private static volatile boolean mainResumed = false;
    private static volatile String activeConversation = null;
    private static final Set<String> openBubbles = Collections.synchronizedSet(new HashSet<>());

    private AppState() {}

    static void setMainResumed(boolean resumed) {
        mainResumed = resumed;
    }

    static boolean isMainResumed() {
        return mainResumed;
    }

    static void setActiveConversation(String cid) {
        activeConversation = cid;
    }

    static String getActiveConversation() {
        return activeConversation;
    }

    /** Người dùng đang nhìn đúng hội thoại này trong app chính. */
    static boolean isViewingInMain(String cid) {
        return mainResumed && cid != null && cid.equals(activeConversation);
    }

    static void setBubbleOpen(String cid, boolean open) {
        if (cid == null) return;
        if (open) openBubbles.add(cid);
        else openBubbles.remove(cid);
    }

    static boolean isBubbleOpen(String cid) {
        return cid != null && openBubbles.contains(cid);
    }
}
