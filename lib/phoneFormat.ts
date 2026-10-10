// Hiển thị số điện thoại dễ đọc: "+1 2145550123" → "(214) 555-0123",
// "0412345678" (Úc) → "0412 345 678". Không nhận ra định dạng → giữ nguyên.
export function formatPhone(raw: string | null | undefined, market: "US" | "AU" | string = "US"): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (market === "AU") {
    const local = d.startsWith("61") ? "0" + d.slice(2) : d;
    if (/^04\d{8}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`; // di động
    if (/^0[2378]\d{8}$/.test(local)) return `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`; // cố định
    return String(raw).trim();
  }
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (/^[2-9]\d{9}$/.test(ten)) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return String(raw).trim();
}

/** Số cho link tel: (luôn có mã quốc gia nếu nhận ra). */
export function telHref(raw: string | null | undefined, market: "US" | "AU" | string = "US"): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (market === "AU") {
    const local = d.startsWith("61") ? d.slice(2) : d.replace(/^0/, "");
    return /^\d{9}$/.test(local) ? `tel:+61${local}` : `tel:${raw ?? ""}`;
  }
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^\d{10}$/.test(ten) ? `tel:+1${ten}` : `tel:${raw ?? ""}`;
}
