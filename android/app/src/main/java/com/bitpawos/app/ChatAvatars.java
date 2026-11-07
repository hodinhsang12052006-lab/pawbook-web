package com.bitpawos.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.util.Log;
import android.util.LruCache;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

/**
 * Ảnh đại diện cho thông báo chat: tải qua https (chỉ host được phép), tối đa 2 MB, ~4 s,
 * cache trên đĩa; lỗi / không có ảnh → hình tròn chữ cái đầu (không bao giờ để trống).
 *
 * Vì sao giới hạn host: avatarUrl do người dùng tự đặt; nếu tải mọi URL thì người gửi đặt
 * một "beacon" là biết IP người nhận đúng lúc thông báo hiện. Danh sách khớp
 * next.config.ts images.remotePatterns + chính bitpawos.com (ảnh qua /_next/image).
 * SVG (dicebear) không giải mã được bằng BitmapFactory → rơi về chữ cái đầu.
 */
final class ChatAvatars {

    private static final String TAG = "PawNailAvatars";

    /** Kích thước ảnh vuông lưu cache (đủ cho cả hình tròn 128 lẫn adaptive 216). */
    private static final int SRC_PX = 256;
    /** Ảnh Person trong MessagingStyle (~40dp ở xxhdpi). */
    static final int PERSON_PX = 128;
    /** Icon adaptive (lối tắt hội thoại, bong bóng): 108dp-ish, vùng an toàn 72/108. */
    static final int ADAPTIVE_PX = 216;

    private static final int MAX_BYTES = 2 * 1024 * 1024;
    /** Tổng thời gian tải 1 ảnh (mọi lần chuyển hướng + đọc thân) — sau đó bỏ, dùng chữ cái đầu. */
    private static final int TOTAL_BUDGET_MS = 6000;
    /** Giải mã tối đa ~2 MP (≈8 MB ARGB): ảnh tỉ lệ cực đoan (300×60000) không làm phình bộ nhớ của service. */
    private static final long MAX_DECODE_PIXELS = 2_000_000L;
    private static final long DISK_FRESH_MS = 3L * 24 * 60 * 60 * 1000;
    private static final long FAIL_BACKOFF_MS = 10L * 60 * 1000;
    private static final int DISK_MAX_FILES = 40;

    private static final String[] ALLOWED_HOSTS = {
        "bitpawos.com",
        "res.cloudinary.com",
        "googleusercontent.com",
        "ui-avatars.com",
        "images.unsplash.com",
        "api.dicebear.com",
        "giphy.com",
        "tenor.com"
    };

    private static final int[] PALETTE = {
        0xFFE91E63, 0xFF9C27B0, 0xFF5E35B1, 0xFF3949AB, 0xFF1E88E5, 0xFF00897B,
        0xFF43A047, 0xFFF4511E, 0xFF6D4C41, 0xFF546E7A, 0xFFD81B60, 0xFF8E24AA
    };

    private static final LruCache<String, Bitmap> MEMORY = new LruCache<String, Bitmap>(4 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return value.getByteCount();
        }
    };
    private static final Map<String, Long> FAILED = new ConcurrentHashMap<>();
    /** Tải ảnh chạy riêng: người gọi (service FCM) chỉ chờ có hạn, thông báo không bị giữ lại vì mạng chậm. */
    private static final ExecutorService NET = Executors.newSingleThreadExecutor();
    private static final Map<String, Future<Bitmap>> IN_FLIGHT = new ConcurrentHashMap<>();
    private static final Pattern STATIC_IMAGE = Pattern.compile("^/[a-z0-9/_.-]+\\.(png|jpe?g|webp|gif|avif)$");

    private ChatAvatars() {}

    /** URL https tuyệt đối hoặc path của bitpawos.com → URL tuyệt đối được phép tải, hoặc null. */
    static String normalize(String raw) {
        if (raw == null) return null;
        String url = raw.trim();
        if (url.isEmpty() || url.length() > 2048) return null;
        if (AppLinks.isSafePath(url)) url = AppLinks.absolute(url);
        return isAllowedUrl(url) ? url : null;
    }

    static boolean isAllowedUrl(String url) {
        try {
            URL u = new URL(url);
            if (!"https".equalsIgnoreCase(u.getProtocol())) return false;
            if (u.getPort() != -1 && u.getPort() != 443) return false;
            if (u.getUserInfo() != null) return false;
            String host = u.getHost().toLowerCase(Locale.ROOT);
            if (host.equals(AppLinks.BARE_HOST) || host.endsWith("." + AppLinks.BARE_HOST)) return isImagePathOnOwnSite(u.getPath());
            for (String h : ALLOWED_HOSTS) {
                if (host.equals(h) || host.endsWith("." + h)) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Ảnh trên chính bitpawos.com: chỉ /_next/image, /uploads/… hoặc file ảnh tĩnh. Request tới bitpawos.com mang
     * cookie phiên của người NHẬN (CapacitorCookies đặt CookieHandler mặc định cho cả tiến trình) — avatarUrl do người
     * gửi tự đặt, nên không bao giờ để nó trỏ vào /api/… hay /auth/… (GET có tác dụng phụ dưới danh nghĩa người nhận).
     */
    static boolean isImagePathOnOwnSite(String path) {
        if (path == null) return false;
        String p = path.toLowerCase(Locale.ROOT);
        if (p.contains("..") || p.contains("%") || p.contains("//")) return false;
        if (p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/admin")) return false;
        if (p.equals("/_next/image") || p.startsWith("/uploads/")) return true;
        return STATIC_IMAGE.matcher(p).matches();
    }

    /**
     * Ảnh vuông SRC_PX của avatar, hoặc null (không có / không được phép / lỗi).
     * allowNetwork=false: chỉ dùng cache (đăng lại thông báo sau khi trả lời nhanh).
     */
    static Bitmap loadSquare(Context ctx, String rawUrl, boolean allowNetwork) {
        String url = normalize(rawUrl);
        if (url == null) return null;
        Bitmap mem = MEMORY.get(url);
        if (mem != null) return mem;

        File file = cacheFile(ctx, url);
        boolean fresh = file != null && file.exists() && System.currentTimeMillis() - file.lastModified() < DISK_FRESH_MS;
        if (fresh || (!allowNetwork && file != null && file.exists())) {
            Bitmap b = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (b != null) {
                MEMORY.put(url, b);
                return b;
            }
        }
        if (!allowNetwork) return null;
        Long failedAt = FAILED.get(url);
        if (failedAt != null && SystemClock.elapsedRealtime() - failedAt < FAIL_BACKOFF_MS) return null;
        return fetch(ctx, url, file);
    }

    /**
     * Ảnh đã có trong cache (bộ nhớ / đĩa còn mới)? Chưa → bắt đầu tải nền và chờ tối đa waitMs.
     * @return null nếu không cần chờ thêm (đã có ảnh, URL không dùng được, vừa lỗi); khác null = vẫn đang tải (dùng
     *     whenDone để vẽ lại khi có ảnh).
     */
    static Future<Bitmap> prefetch(Context ctx, String rawUrl, long waitMs) {
        String url = normalize(rawUrl);
        if (url == null) return null;
        if (MEMORY.get(url) != null || isFresh(ctx, url)) return null;
        Long failedAt = FAILED.get(url);
        if (failedAt != null && SystemClock.elapsedRealtime() - failedAt < FAIL_BACKOFF_MS) return null;
        Future<Bitmap> f = start(ctx, url);
        try {
            f.get(waitMs, TimeUnit.MILLISECONDS);
            return null;
        } catch (Exception e) {
            return f.isDone() ? null : f;
        }
    }

    /** Lượt tải f xong VÀ có ảnh → chạy r (trên luồng tải). */
    static void whenDone(Future<Bitmap> f, Runnable r) {
        // NET chỉ có 1 luồng và lượt tải đã xếp hàng trước → tới lượt việc này thì f đã xong.
        NET.execute(() -> {
            try {
                if (f.get() != null) r.run();
            } catch (Throwable t) {
                Log.w(TAG, "avatar refresh failed: " + t.getClass().getSimpleName());
            }
        });
    }

    private static boolean isFresh(Context ctx, String url) {
        File file = cacheFile(ctx, url);
        return file != null && file.exists() && System.currentTimeMillis() - file.lastModified() < DISK_FRESH_MS;
    }

    private static Future<Bitmap> start(Context ctx, String url) {
        Context app = ctx.getApplicationContext();
        synchronized (IN_FLIGHT) {
            Future<Bitmap> f = IN_FLIGHT.get(url);
            if (f != null) return f;
            FutureTask<Bitmap> task = new FutureTask<>(() -> fetch(app, url, cacheFile(app, url)));
            IN_FLIGHT.put(url, task);
            NET.execute(() -> {
                try {
                    task.run();
                } finally {
                    IN_FLIGHT.remove(url, task);
                }
            });
            return task;
        }
    }

    private static Bitmap fetch(Context ctx, String url, File file) {
        Bitmap square = null;
        try {
            byte[] bytes = download(ctx, url);
            if (bytes != null) square = decodeSquare(bytes);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "avatar download failed: " + e.getClass().getSimpleName());
        }
        if (square == null) {
            FAILED.put(url, SystemClock.elapsedRealtime());
            // Ảnh cũ trên đĩa vẫn hơn chữ cái đầu.
            if (file != null && file.exists()) {
                Bitmap stale = BitmapFactory.decodeFile(file.getAbsolutePath());
                if (stale != null) MEMORY.put(url, stale);
                return stale;
            }
            return null;
        }
        MEMORY.put(url, square);
        if (file != null) saveToDisk(file, square);
        return square;
    }

    private static byte[] download(Context ctx, String url) throws IOException {
        long deadline = SystemClock.elapsedRealtime() + TOTAL_BUDGET_MS;
        String current = url;
        for (int hop = 0; hop < 3; hop++) {
            // Mỗi lần chuyển hướng cũng phải tới host được phép.
            if (!isAllowedUrl(current)) return null;
            int left = (int) (deadline - SystemClock.elapsedRealtime());
            if (left < 300) return null;
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            try {
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(left);
                c.setReadTimeout(left);
                c.setUseCaches(false);
                c.setRequestProperty("Accept", "image/webp,image/png,image/jpeg,image/*;q=0.8");
                // UA của WebView (lưu khi mở app): /_next/image sau Cloudflare không bị coi là bot.
                c.setRequestProperty("User-Agent", ChatApi.cachedUserAgent(ctx));
                int code = c.getResponseCode();
                if (code >= 300 && code < 400) {
                    String loc = c.getHeaderField("Location");
                    if (loc == null) return null;
                    current = new URL(new URL(current), loc).toString();
                    continue;
                }
                if (code != 200) return null;
                String type = c.getContentType();
                if (type == null) return null;
                type = type.toLowerCase(Locale.ROOT);
                if (!type.startsWith("image/") || type.contains("svg")) return null;
                long len = c.getContentLengthLong();
                if (len > MAX_BYTES) return null;
                try (InputStream in = c.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream(len > 0 ? (int) len : 32 * 1024);
                    byte[] buf = new byte[16 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        if (out.size() > MAX_BYTES) return null;
                        if (SystemClock.elapsedRealtime() > deadline) return null;
                    }
                    return out.toByteArray();
                }
            } finally {
                c.disconnect();
            }
        }
        return null;
    }

    private static Bitmap decodeSquare(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        int min = Math.min(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (min / (sample * 2) >= SRC_PX) sample *= 2;
        // Tỉ lệ cực đoan (cạnh ngắn nhỏ, cạnh dài khổng lồ): thu tiếp tới khi số điểm ảnh vừa ngân sách.
        while ((long) (bounds.outWidth / sample) * (bounds.outHeight / sample) > MAX_DECODE_PIXELS) sample *= 2;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        o.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
        if (b == null) return null;
        int side = Math.min(b.getWidth(), b.getHeight());
        Rect src = new Rect((b.getWidth() - side) / 2, (b.getHeight() - side) / 2, 0, 0);
        src.right = src.left + side;
        src.bottom = src.top + side;
        Bitmap out = Bitmap.createBitmap(SRC_PX, SRC_PX, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        cv.drawBitmap(b, src, new Rect(0, 0, SRC_PX, SRC_PX), new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG));
        if (b != out) b.recycle();
        return out;
    }

    /** Đăng xuất: xoá ảnh đại diện đã cache (bộ nhớ + đĩa). */
    static void clearCache(Context ctx) {
        MEMORY.evictAll();
        FAILED.clear();
        File dir = new File(ctx.getCacheDir(), "pn_avatars");
        File[] all = dir.listFiles();
        if (all != null) for (File f : all) f.delete();
        dir.delete();
    }

    private static File cacheFile(Context ctx, String url) {
        try {
            File dir = new File(ctx.getCacheDir(), "pn_avatars");
            if (!dir.exists() && !dir.mkdirs()) return null;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 16; i++) sb.append(String.format(Locale.ROOT, "%02x", h[i]));
            return new File(dir, sb + ".png");
        } catch (Exception e) {
            return null;
        }
    }

    private static void saveToDisk(File file, Bitmap b) {
        File tmp = new File(file.getParentFile(), file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (IOException e) {
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(file)) tmp.delete();
        File[] all = file.getParentFile().listFiles();
        if (all != null && all.length > DISK_MAX_FILES) {
            Arrays.sort(all, (a, c) -> Long.compare(a.lastModified(), c.lastModified()));
            for (int i = 0; i < all.length - DISK_MAX_FILES; i++) all[i].delete();
        }
    }

    // ---------------------------------------------------------------------------------
    // Vẽ
    // ---------------------------------------------------------------------------------

    /** Ảnh vuông → hình tròn px×px (Person của MessagingStyle, large icon Android < 9). */
    static Bitmap circle(Bitmap square, int px) {
        Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Bitmap scaled = Bitmap.createScaledBitmap(square, px, px, true);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        p.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        cv.drawCircle(px / 2f, px / 2f, px / 2f, p);
        return out;
    }

    /**
     * Ảnh vuông → bitmap adaptive (lối tắt, bong bóng): cả ảnh nằm trong vùng an toàn 72/108
     * ở giữa nên mặt nạ tròn/squircle của launcher không cắt mất mặt; phần viền ngoài là
     * chính ảnh đó phóng to (chỉ lộ ra khi có hiệu ứng chuyển động).
     */
    static Bitmap adaptive(Bitmap square, int px) {
        Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        cv.drawBitmap(square, null, new Rect(0, 0, px, px), p);
        int inset = Math.round(px * 18f / 108f);
        cv.drawBitmap(square, null, new Rect(inset, inset, px - inset, px - inset), p);
        return out;
    }

    /** Hình tròn màu + chữ cái đầu (không có ảnh). */
    static Bitmap initialsCircle(String name, String key, int px) {
        Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setColor(colorFor(key));
        cv.drawCircle(px / 2f, px / 2f, px / 2f, bg);
        drawInitials(cv, initials(name), new RectF(0, 0, px, px));
        return out;
    }

    /** Bản adaptive của chữ cái đầu: nền màu tràn viền, chữ nằm trong vùng an toàn. */
    static Bitmap initialsAdaptive(String name, String key, int px) {
        Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        cv.drawColor(colorFor(key));
        float inset = px * 18f / 108f;
        drawInitials(cv, initials(name), new RectF(inset, inset, px - inset, px - inset));
        return out;
    }

    private static void drawInitials(Canvas cv, String text, RectF box) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        p.setTextAlign(Paint.Align.CENTER);
        p.setTextSize(box.height() * (text.codePointCount(0, text.length()) > 1 ? 0.38f : 0.46f));
        Paint.FontMetrics fm = p.getFontMetrics();
        float y = box.centerY() - (fm.ascent + fm.descent) / 2f;
        cv.drawText(text, box.centerX(), y, p);
    }

    static String initials(String name) {
        if (name == null) return "?";
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        if (parts.length > 0 && !parts[0].isEmpty()) sb.appendCodePoint(parts[0].codePointAt(0));
        if (parts.length > 1 && !parts[parts.length - 1].isEmpty()) sb.appendCodePoint(parts[parts.length - 1].codePointAt(0));
        String s = sb.toString().toUpperCase(Locale.getDefault());
        return s.isEmpty() ? "?" : s;
    }

    static int colorFor(String key) {
        int h = key == null ? 0 : key.hashCode();
        return PALETTE[(h & 0x7fffffff) % PALETTE.length];
    }
}
