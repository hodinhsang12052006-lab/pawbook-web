"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";

interface SessionUserContextValue {
  user: any;
  loading: boolean;
  refresh: () => void;
}

const SessionUserContext = createContext<SessionUserContextValue>({
  user: null,
  loading: true,
  refresh: () => {},
});

// Nạp session + profile MỘT LẦN cho toàn app (Navbar và Sidebar trước đây
// mỗi component tự fetch riêng /api/auth/session + /api/profile, gây 2 round-trip
// trùng lặp tới database trên mỗi lượt tải trang).
export function SessionUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chỉ lần nạp ĐẦU mới bật "loading". Làm mới sau khi lưu hồ sơ / đổi ảnh
  // (event "profile-updated") chạy ngầm — trước đây cả thanh điều hướng, cột
  // trái... chớp tắt về trạng thái đang tải mỗi lần bấm Lưu.
  const loadedOnce = useRef(false);
  const load = useCallback(async () => {
    try {
      if (!loadedOnce.current) setLoading(true);
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const session = await res.json();
        // Đăng nhập Google/Apple lần đầu: phải chọn vai trò + khu vực trước khi dùng app.
        if (session?.user?.needsOnboarding && !window.location.pathname.startsWith("/auth/complete")) {
          window.location.replace("/auth/complete");
          return;
        }
        if (session?.user?.id) {
          const profileRes = await fetch(`/api/profile?id=${session.user.id}`);
          if (profileRes.ok) {
            setUser(await profileRes.json());
            return;
          }
        }
        setUser(session?.user || null);
      }
    } catch (err) {
      // "Failed to fetch" khi người dùng chuyển trang lúc đang tải (request bị
      // huỷ) hoặc mất mạng chốc lát — không phải lỗi app, đừng đẩy lên Sentry.
      if (!(err instanceof TypeError && /fetch/i.test(err.message))) console.error(err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("profile-updated", load);
    return () => window.removeEventListener("profile-updated", load);
  }, [load]);

  return (
    <SessionUserContext.Provider value={{ user, loading, refresh: load }}>
      {children}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionUserContext);
}
