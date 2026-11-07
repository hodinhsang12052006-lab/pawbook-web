package com.bitpawos.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Kiểm tra các hàm thuần (không cần thiết bị) của thông báo chat native:
 * ./gradlew :app:testDebugUnitTest
 */
public class ChatNotificationHelpersTest {

    @Test
    public void safePathAcceptsOnlyInAppPaths() {
        assertTrue(AppLinks.isSafePath("/messages?c=cm0abc123def456ghi789jkl0"));
        assertTrue(AppLinks.isSafePath("/vi/messages?to=u1&x=%20"));
        assertTrue(AppLinks.isSafePath("/"));
        assertFalse(AppLinks.isSafePath(null));
        assertFalse(AppLinks.isSafePath(""));
        assertFalse(AppLinks.isSafePath("messages"));
        assertFalse(AppLinks.isSafePath("//evil.com/x"));
        assertFalse(AppLinks.isSafePath("https://evil.com/"));
        assertFalse(AppLinks.isSafePath("/\\evil.com"));
        assertFalse(AppLinks.isSafePath("/messages x"));
        assertFalse(AppLinks.isSafePath("/messages\n"));
        assertFalse(AppLinks.isSafePath("/tin-nhắn"));
        StringBuilder longPath = new StringBuilder("/");
        for (int i = 0; i < 2048; i++) longPath.append('a');
        assertFalse(AppLinks.isSafePath(longPath.toString()));
    }

    @Test
    public void conversationIdCharset() {
        assertTrue(AppLinks.isConversationId("cm0abc123def456ghi789jkl0"));
        assertTrue(AppLinks.isConversationId("a_b-C9"));
        assertFalse(AppLinks.isConversationId(null));
        assertFalse(AppLinks.isConversationId(""));
        assertFalse(AppLinks.isConversationId("../x"));
        assertFalse(AppLinks.isConversationId("a b"));
    }

    @Test
    public void chatPathDetection() {
        assertTrue(AppLinks.isChatPath("/messages"));
        assertTrue(AppLinks.isChatPath("/messages?c=abc&bubble=1"));
        assertTrue(AppLinks.isChatPath("/vi/messages?c=abc"));
        assertTrue(AppLinks.isChatPath("/messages/abc#end"));
        assertFalse(AppLinks.isChatPath("/messagesX"));
        assertFalse(AppLinks.isChatPath("/jobs"));
        assertFalse(AppLinks.isChatPath("/auth/signin?callbackUrl=/messages"));
        assertFalse(AppLinks.isChatPath("/vi/profile"));
        assertFalse(AppLinks.isChatPath(null));
    }

    @Test
    public void onlyThisConversationStaysInsideTheBubble() {
        // Đúng hội thoại của bong bóng (?c=<cid>) → ở lại.
        assertTrue(AppLinks.staysInBubble("/messages?c=abc&bubble=1", "abc"));
        assertTrue(AppLinks.staysInBubble("/vi/messages?c=abc", "abc"));
        assertTrue(AppLinks.staysInBubble("/messages?bubble=1&c=abc#m1", "abc"));
        // /messages trần (nút "Mở PawNail" của trang lỗi), ?to=, hội thoại khác, trang khác → app chính.
        assertFalse(AppLinks.staysInBubble("/messages", "abc"));
        assertFalse(AppLinks.staysInBubble("/vi/messages", "abc"));
        assertFalse(AppLinks.staysInBubble("/messages?bubble=1", "abc"));
        assertFalse(AppLinks.staysInBubble("/messages?to=u1", "abc"));
        assertFalse(AppLinks.staysInBubble("/messages?c=other", "abc"));
        assertFalse(AppLinks.staysInBubble("/messages?c=abcd", "abc"));
        assertFalse(AppLinks.staysInBubble("/jobs?c=abc", "abc"));
        assertFalse(AppLinks.staysInBubble("/messages?c=abc", null));
    }

    @Test
    public void untrustedLaunchesOnlyOpenAConversation() {
        assertTrue(AppLinks.isConversationOpenPath("/messages?c=cm0abc123"));
        assertTrue(AppLinks.isConversationOpenPath("/vi/messages?c=a_b-C9"));
        assertFalse(AppLinks.isConversationOpenPath("/messages"));
        assertFalse(AppLinks.isConversationOpenPath("/messages?c="));
        assertFalse(AppLinks.isConversationOpenPath("/messages?c=abc&x=1"));
        assertFalse(AppLinks.isConversationOpenPath("/messages?c=abc#x"));
        assertFalse(AppLinks.isConversationOpenPath("/messages?c=../x"));
        assertFalse(AppLinks.isConversationOpenPath("/admin?c=abc"));
        assertFalse(AppLinks.isConversationOpenPath("/api/messages?c=abc"));
        assertFalse(AppLinks.isConversationOpenPath("//evil.com/messages?c=abc"));
        assertEquals("/messages?c=abc", AppLinks.conversationPath("abc"));
        assertEquals("abc", AppLinks.queryParam("/messages?x=1&c=abc#f", "c"));
        assertEquals(null, AppLinks.queryParam("/messages", "c"));
    }

    @Test
    public void bubbleFlagIsAddedBeforeTheFragment() {
        assertEquals("/messages?c=a&bubble=1", BubbleActivity.withBubbleFlag("/messages?c=a"));
        assertEquals("/messages?bubble=1", BubbleActivity.withBubbleFlag("/messages"));
        assertEquals("/messages?c=a&bubble=1#m1", BubbleActivity.withBubbleFlag("/messages?c=a#m1"));
    }

    @Test
    public void cleanStripsControlCharsAndNeverSplitsSurrogates() {
        assertEquals("hi\nthere", ChatNotifications.clean(" hi\u0000\n\tthere ", 100));
        assertEquals("", ChatNotifications.clean(null, 10));
        // 😀 = 2 UTF-16 units: a cut at 3 keeps "a😀", a cut at 2 keeps only "a".
        assertEquals("a😀", ChatNotifications.clean("a😀b", 3));
        assertEquals("a", ChatNotifications.clean("a😀b", 2));
    }

    @Test
    public void namesLoseBidiAndZeroWidthControls() {
        // U+202E (RLO) đảo chiều hiển thị, U+200B / U+FEFF vô hình — tên giả mạo.
        assertEquals("Admin", ChatNotifications.cleanName("Ad\u202Emin\u200B\uFEFF", 80));
        assertEquals("Lan", ChatNotifications.cleanName("\u2066Lan\u2069", 80));
        // Giữ ZWJ: emoji gia đình vẫn là 1 cụm.
        assertEquals("Kim 👩\u200D👩\u200D👧", ChatNotifications.cleanName("Kim 👩\u200D👩\u200D👧", 80));
        assertEquals("", ChatNotifications.cleanName(null, 80));
    }

    @Test
    public void avatarsOnOwnSiteMustBeImages() {
        // Request tới bitpawos.com mang cookie phiên của người nhận → chỉ đường dẫn ảnh.
        assertTrue(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/uploads/a/b.jpg"));
        assertTrue(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/icons/icon-192.webp"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/api/messages?x=1"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/api/auth/signout"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/auth/login"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/admin/users.png"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/profile/u1"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/uploads/../api/x.png"));
        assertFalse(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/x%2F..%2Fapi.png"));
        assertEquals("https://www.bitpawos.com/uploads/a.png", ChatAvatars.normalize("/uploads/a.png"));
        assertEquals(null, ChatAvatars.normalize("/api/profile"));
    }

    @Test
    public void avatarHostsAreAllowListed() {
        assertTrue(ChatAvatars.isAllowedUrl("https://res.cloudinary.com/demo/image/upload/a.jpg"));
        assertTrue(ChatAvatars.isAllowedUrl("https://lh3.googleusercontent.com/a/abc=s96"));
        assertTrue(ChatAvatars.isAllowedUrl("https://www.bitpawos.com/_next/image?url=x&w=96&q=75"));
        assertTrue(ChatAvatars.isAllowedUrl("https://ui-avatars.com/api/?name=A"));
        assertFalse(ChatAvatars.isAllowedUrl("http://res.cloudinary.com/a.jpg"));
        assertFalse(ChatAvatars.isAllowedUrl("https://evil.com/beacon.png"));
        assertFalse(ChatAvatars.isAllowedUrl("https://res.cloudinary.com.evil.com/a.jpg"));
        assertFalse(ChatAvatars.isAllowedUrl("https://notbitpawos.com/a.png"));
        assertFalse(ChatAvatars.isAllowedUrl("https://user@res.cloudinary.com/a.jpg"));
        assertFalse(ChatAvatars.isAllowedUrl("https://res.cloudinary.com:8443/a.jpg"));
        assertFalse(ChatAvatars.isAllowedUrl("data:image/png;base64,AAAA"));
        assertFalse(ChatAvatars.isAllowedUrl(""));
    }

    @Test
    public void initialsUseFirstAndLastWord() {
        assertEquals("NA", ChatAvatars.initials("Nguyễn Văn An"));
        assertEquals("Đ", ChatAvatars.initials("đức"));
        assertEquals("?", ChatAvatars.initials("   "));
        assertEquals("?", ChatAvatars.initials(null));
        assertEquals("😀", ChatAvatars.initials("😀"));
    }
}
