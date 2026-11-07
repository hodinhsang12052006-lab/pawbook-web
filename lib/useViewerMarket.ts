"use client";

// Thị trường của người xem cho component (xem lib/market.ts). Một store chung cho cả trang:
//   - đã đăng nhập → market của tài khoản (luôn thắng);
//   - cookie bitpaw_market (lựa chọn đã nhớ / kết quả dò lần trước);
//   - chưa có → đoán ngay tại trình duyệt (ngôn ngữ, múi giờ) rồi hỏi /api/market 1 lần (quốc gia theo IP,
//     chính xác hơn) và nhớ kết quả vào cookie.
// Máy chủ render trang tĩnh nên khi hydrate luôn bắt đầu bằng "US" (getServerSnapshot), rồi đổi sang thị
// trường thật ngay sau đó — không lệch hydration.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, guessMarketInBrowser, isMarket, readMarketCookie, type Market } from "@/lib/market";
import { applySeason } from "@/lib/season";
import { useSessionUser } from "@/lib/SessionUserContext";

let current: Market | null = null;
let resolved = false;
let asked = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function init() {
  if (resolved || typeof window === "undefined") return;
  resolved = true;
  let saved: string | null = readMarketCookie();
  if (!saved) {
    try {
      saved = localStorage.getItem(MARKET_COOKIE);
    } catch {}
  }
  current = isMarket(saved) ? saved : guessMarketInBrowser() ?? "US";
  // Mùa (html[data-season]) do SEASON_BOOT đặt trước khi vẽ — cùng thứ tự dò; chỉ sửa nếu lệch.
  // (init chạy trong getSnapshot, tức lúc render → đẩy việc ghi DOM ra sau.)
  const guessed = current;
  if (document.documentElement.getAttribute("data-mkt") !== guessed) queueMicrotask(() => applySeason(guessed));
  if (!readMarketCookie() && !asked) {
    asked = true;
    // Quốc gia theo IP (chỉ máy chủ thấy). Máy chủ cũng đặt cookie 1 năm cho các lần sau.
    fetch("/api/market", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { market?: unknown; source?: unknown } | null) => {
        const m = d?.market;
        if (isMarket(m) && d?.source !== "default" && m !== current && !readMarketCookieChosen()) {
          current = m;
          applySeason(m);
          emit();
        }
        if (isMarket(current)) writeLocal(current);
      })
      .catch(() => {});
  }
}

// Người xem đã TỰ chọn (bấm nút 🇺🇸/🇦🇺) trong phiên này → kết quả dò IP về sau không được đè lên.
let chosen = false;
const readMarketCookieChosen = () => chosen;

function writeLocal(m: Market) {
  try {
    localStorage.setItem(MARKET_COOKIE, m);
  } catch {}
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSnapshot = (): Market => {
  init();
  return current ?? "US";
};
const getServerSnapshot = (): Market => "US";

/** Ghi lựa chọn của người xem: cookie do máy chủ đặt (không bị Safari ITP cắt còn 7 ngày) + dự phòng tại chỗ. */
export function chooseMarket(m: Market) {
  if (!isMarket(m)) return;
  chosen = true;
  current = m;
  writeLocal(m);
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${MARKET_COOKIE}=${m}; Path=/; Max-Age=${MARKET_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {}
  fetch("/api/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market: m }) }).catch(() => {});
  applySeason(m);
  emit();
}

/**
 * { market, setMarket, fromAccount }. `market` là thị trường để HIỂN THỊ mặc định (tiệm gần bạn, form đăng
 * ký, mùa, chính tả). Người đã đăng nhập: market của tài khoản.
 */
export function useViewerMarket(): { market: Market; setMarket: (m: Market) => void; fromAccount: boolean } {
  const { user } = useSessionUser();
  const guest = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const account = isMarket(user?.market) ? (user.market as Market) : null;
  // Đăng nhập rồi → nhớ luôn market của tài khoản cho các trang khách (đăng xuất vẫn đúng thị trường).
  useEffect(() => {
    if (account && account !== current) {
      current = account;
      writeLocal(account);
      applySeason(account);
      emit();
    }
  }, [account]);
  const setMarket = useCallback((m: Market) => chooseMarket(m), []);
  return { market: account ?? guest, setMarket, fromAccount: !!account };
}
