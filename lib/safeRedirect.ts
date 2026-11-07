// Đích chuyển trang lấy từ URL (?callbackUrl=…) là dữ liệu NGƯỜI LẠ đưa vào → chỉ nhận đường dẫn CÙNG trang web.
//
// Không kiểm bằng regex trên chuỗi thô: trình duyệt PHÂN TÍCH lại URL trước khi đi — bỏ tab / xuống dòng (\t \n \r),
// coi "\" như "/" — nên "/<TAB>/evil.com" qua được /^\/(?![/\\])/ nhưng thành "//evil.com" (ra trang ngoài). Ở đây
// phân tích bằng đúng bộ phân tích URL đó (new URL), đòi cùng origin, rồi trả về đường dẫn ĐÃ chuẩn hoá
// (pathname + search + hash) — chuỗi trả về luôn bắt đầu bằng đúng 1 "/" và không còn ký tự bị bỏ.
// Không nhận /api/… (đích phải là một trang).
export function safeInternalPath(raw: string | null | undefined, origin: string = window.location.origin): string | null {
  if (!raw || raw[0] !== "/") return null;
  let u: URL;
  try {
    u = new URL(raw, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin || u.pathname.startsWith("/api/")) return null;
  return u.pathname + u.search + u.hash;
}
