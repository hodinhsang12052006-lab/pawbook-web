// Unit: ?callbackUrl= chỉ được đưa tới đường dẫn CÙNG trang web (lib/safeRedirect.ts) — dùng ở LoginForm (sau khi đăng
// nhập) và useAuthedRedirect (người đã đăng nhập mở /auth/login|forgot|register). Không cần máy chủ / DB.
//   npx tsx scripts/qa/safe_redirect_unit.mts
import { safeInternalPath } from "../../lib/safeRedirect";
import { authedTarget } from "../../components/auth/useAuthedRedirect";

const O = "https://bitpawos.com";
let fail = 0;
const eq = (id: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} [${id}] ${JSON.stringify(got)}${ok ? "" : `  (want ${JSON.stringify(want)})`}`);
};

// Cùng trang web → giữ nguyên (đã chuẩn hoá)
eq("S1", safeInternalPath("/designs", O), "/designs");
eq("S2", safeInternalPath("/menu/abc?tab=menu#x", O), "/menu/abc?tab=menu#x");
eq("S3", safeInternalPath("/vi/designs", O), "/vi/designs");
// Trang ngoài, mọi kiểu ngụy trang → null
for (const [id, raw] of [
  ["X1", "//evil.example.com"],
  ["X2", "/\t/evil.example.com"],
  ["X3", "/\n/evil.example.com"],
  ["X4", "/\r\n/evil.example.com"],
  ["X5", "/\\evil.example.com"],
  ["X6", "/\t\\evil.example.com"],
  ["X7", "https://evil.example.com/"],
  ["X8", "javascript:alert(1)"],
  ["X9", " /designs"],
  ["X10", "\t//evil.example.com"],
  ["X11", "/api/auth/signout"],
  ["X12", ""],
] as const) eq(id, safeInternalPath(raw, O), null);
eq("X13", safeInternalPath(null, O), null);
// Ký tự bị bỏ nằm GIỮA đường dẫn cùng trang → vẫn cùng trang, trả bản đã chuẩn hoá (không còn \t)
eq("S4", safeInternalPath("/des\tigns", O), "/designs");

// authedTarget: callbackUrl hợp lệ ngoài /auth; còn lại → trang chủ đúng ngôn ngữ
const loc = (pathname: string, search: string) => ({ pathname, search, origin: O });
eq("A1", authedTarget(loc("/auth/login", "?callbackUrl=%2Fdesigns")), "/designs");
eq("A2", authedTarget(loc("/auth/login", "?callbackUrl=%2F%09%2Fevil.example.com")), "/");
eq("A3", authedTarget(loc("/auth/forgot", "?callbackUrl=%2F%0A%2Fevil.example.com")), "/");
eq("A4", authedTarget(loc("/auth/register", "?callbackUrl=%2F%0D%0A%2Fevil.example.com")), "/");
eq("A5", authedTarget(loc("/vi/auth/login", "?callbackUrl=%2F%2Fevil.example.com")), "/vi");
eq("A6", authedTarget(loc("/auth/login", "?callbackUrl=%2Fauth%2Fregister")), "/");
eq("A7", authedTarget(loc("/auth/login", "?callbackUrl=%2Fvi%2Fauth%2Flogin")), "/");
eq("A8", authedTarget(loc("/auth/login", "?callbackUrl=%2F%09auth%2Flogin")), "/");
eq("A9", authedTarget(loc("/vi/auth/register", "")), "/vi");
eq("A10", authedTarget(loc("/auth/login", "?callbackUrl=https%3A%2F%2Fevil.example.com")), "/");

console.log(fail ? `\nsafe_redirect_unit: ${fail} FAIL` : "\nsafe_redirect_unit: all PASS");
process.exit(fail ? 1 : 0);
