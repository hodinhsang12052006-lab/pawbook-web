"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const session = await res.json();
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
      console.error(err);
    } finally {
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
