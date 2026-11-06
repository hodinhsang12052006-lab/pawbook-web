// Cầu nối ảnh Google Flow → kho mẫu nail. KHÔNG đổi schema: ghi dấu trong NailDesign.prompt (cùng kiểu các
// dấu [pr:…] [ai:…] [q:…] của lib/aiDesigns). File này thuần (không prisma) — dùng được cả ở trình duyệt.
//   [flow:<mã>:<YYYY-MM-DD>]  ảnh đang hiện là ảnh Flow chủ tiệm duyệt nhập (mã D001… hoặc id mẫu)
//   [was:<url>]               ảnh trước khi nhập Flow — "Hoàn tác" trả lại ảnh này (rỗng = trước đó chưa có ảnh)
//   [wasmk:<mã hoá URI>]      các dấu ảnh cũ bị gỡ khi nhập ([pr:][q:][try:][redraws:][img:][hid:]) — hoàn tác trả lại đủ
// Máy tự vẽ ảnh (vẽ lại / vẽ bù / cron) PHẢI bỏ qua mẫu có "[flow:" — xem FLOW_WHERE.

export const FLOW_FOLDER = "pawbook/designs-flow";
export const FLOW_FORMATS = "jpg,png,webp";
export const FLOW_TAG = "pawnail-flow";
export const FLOW_MIN_SIDE = 1024;
export const FLOW_MAX_SIDE = 2048; // trình duyệt thu nhỏ về cạnh dài 2048 trước khi tải lên
export const FLOW_MAX_BYTES = 15 * 1024 * 1024;
export const FLOW_SQUARE_TOLERANCE = 0.02;
/** Ảnh tải lên phải mới (chữ ký Cloudinary chỉ sống 1 giờ) — nhập lại đúng ảnh đang hiện thì không cần. */
export const FLOW_VERSION_WINDOW_S = 2 * 3600;
const MARKS_MAX = 1500;

/** Prisma where: mẫu có ảnh Flow. Dùng trong NOT: [...] cho mọi chỗ tự ghi ảnh (cố ý rộng: dấu hỏng cũng tính). */
export const FLOW_WHERE = { prompt: { contains: "[flow:" } } as const;
export const isFlowPrompt = (p: string | null | undefined): boolean => !!p && p.includes("[flow:");

// Mã ảnh: D001…D999 (lô brief 2026-11) hoặc id mẫu (cuid) — lô sau dùng thẳng id mẫu làm mã.
export const D_CODE_RE = /^D\d{3}$/;
export const DESIGN_ID_RE = /^c[a-z0-9]{20,31}$/;
export const isFlowCode = (s: string) => D_CODE_RE.test(s) || DESIGN_ID_RE.test(s);

/** Mọi mã có trong tên file ảnh Flow ("D001.png", "D017 (1).jpeg", "<id mẫu>.jpg", "D001_<id>.png"), không trùng. */
export function filenameCodes(name: string): { dcodes: string[]; ids: string[] } {
  const base = String(name ?? "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const ids = [...new Set([...base.matchAll(/(?<![a-z0-9])c[a-z0-9]{24}(?![a-z0-9])/g)].map((m) => m[0]).filter((s) => /\d/.test(s)))];
  const dcodes = [...new Set([...base.matchAll(/(?<![A-Za-z0-9])[Dd](\d{3})(?![0-9])/g)].map((m) => `D${m[1]}`))];
  return { dcodes, ids };
}

/** public_id gốc trên Cloudinary (trong thư mục FLOW_FOLDER): theo MẪU, không theo mã lô — lô sau có dùng lại "D001"
 *  cũng không đụng ảnh của mẫu khác. Mỗi lần tải lên thêm đuôi ngẫu nhiên (flowUploadId). */
export function flowPublicId(code: string, designId: string): string {
  if (!isFlowCode(code) || !DESIGN_ID_RE.test(designId)) throw new Error("bad flow code");
  return code === designId ? designId : `${code}_${designId}`;
}
export const FLOW_NONCE_RE = /^[a-f0-9]{10}$/;
/** public_id cho 1 lần tải lên: gốc + đuôi ngẫu nhiên → mỗi ảnh Flow là 1 file riêng (ký overwrite=false), tải lên
 *  không bao giờ thay ảnh đang hiện; ảnh chỉ lên trang khi /import duyệt. */
export function flowUploadId(code: string, designId: string, nonce: string): string {
  if (!FLOW_NONCE_RE.test(nonce)) throw new Error("bad nonce");
  return `${flowPublicId(code, designId)}_${nonce}`;
}

const IMPORT_STRIP = /\[(pr|q|try|redraws|img|hid):[^\]]*\]/g;
const FLOW_MARKS = /\[(flow|was|wasmk):[^\]]*\]/g;
const AI_MARK = /\[ai:[^\]]*\]/g;

export interface FlowMark { code: string; date: string }
/** Dấu [flow:] đúng dạng (mã hợp lệ + ngày). Chuỗi "[flow:" lạc trong chữ không tính. */
export function flowMark(prompt: string | null | undefined): FlowMark | null {
  const m = String(prompt ?? "").match(/\[flow:(D\d{3}|c[a-z0-9]{20,31}):(\d{4}-\d{2}-\d{2})\]/);
  return m ? { code: m[1], date: m[2] } : null;
}
/** Ảnh trước khi nhập Flow: undefined = không có dấu [was:], null = trước đó chưa có ảnh. */
export function wasImage(prompt: string | null | undefined): string | null | undefined {
  const m = String(prompt ?? "").match(/\[was:([^\]]*)\]/);
  return m ? m[1] || null : undefined;
}
/** URL ảnh cũ đủ an toàn để cất trong dấu [was:] (không chứa ngoặc, không phải data URL khổng lồ). */
export const backupableUrl = (u: string | null | undefined) => !u || (/^https:\/\/[^\s[\]]+$/.test(u) && u.length <= 600);
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
/** Ảnh cất / trả lại được khi hoàn tác: rỗng, hoặc link https trên CDN Cloudinary (không bao giờ trả về host lạ). */
export const restorableUrl = (u: string | null | undefined) => !u || (backupableUrl(u) && hostOf(u) === "res.cloudinary.com");
const decodeWasmk = (p: string): string => {
  const enc = p.match(/\[wasmk:([^\]]*)\]/)?.[1];
  if (!enc) return "";
  try { return (decodeURIComponent(enc).match(IMPORT_STRIP) ?? []).join(""); } catch { return ""; }
};

/** prompt sau khi nhập ảnh Flow `code` ngày `date`. Nhập lại (đã là ảnh Flow, có [was:]) → GIỮ [was:] gốc, chỉ thay
 *  dấu [flow:]. Phần chữ giữ nguyên vẹn (không cắt) để hoàn tác trả lại đúng; dấu quá dài → từ chối. */
export function importPrompt(prompt: string, prevImageUrl: string | null, code: string, date: string): string {
  if (!isFlowCode(code) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("bad flow mark");
  const p = String(prompt ?? "");
  const ai = [...new Set(p.match(AI_MARK) ?? [])].join("");
  let was: string;
  let wasmk: string;
  if (flowMark(p) && wasImage(p) !== undefined) {
    was = p.match(/\[was:[^\]]*\]/)![0];
    wasmk = p.match(/\[wasmk:[^\]]*\]/)?.[0] ?? "";
  } else {
    // lần nhập đầu (hoặc dấu Flow hỏng / thiếu [was:]) → cất ảnh đang hiện, như lần đầu
    if (!restorableUrl(prevImageUrl)) throw new Error("previous image cannot be backed up");
    was = `[was:${prevImageUrl ?? ""}]`;
    const removed = (p.match(IMPORT_STRIP) ?? []).join("");
    wasmk = removed ? `[wasmk:${encodeURIComponent(removed)}]` : "";
  }
  const base = p.replace(IMPORT_STRIP, "").replace(AI_MARK, "").replace(FLOW_MARKS, "").trimEnd();
  const marks = `${ai}${was}${wasmk}[flow:${code}:${date}]`;
  if (marks.length > MARKS_MAX) throw new Error("image marks too long");
  return `${base}${marks}`;
}

/** Hoàn tác: ảnh + prompt trước khi nhập Flow (null nếu không có dấu Flow đúng dạng / thiếu [was:] / ảnh cũ ở host lạ). */
export function undoPrompt(prompt: string): { prompt: string; imageUrl: string | null } | null {
  const p = String(prompt ?? "");
  if (!flowMark(p)) return null;
  const was = wasImage(p);
  if (was === undefined || !restorableUrl(was)) return null;
  return { prompt: `${p.replace(FLOW_MARKS, "").trimEnd()}${decodeWasmk(p)}`, imageUrl: was };
}

/** Admin bấm vẽ lại 1 mẫu đang là ảnh Flow: gỡ dấu Flow nhưng không mất ảnh nào — giữ mọi [ai:] cũ (ảnh AI gốc),
 *  cất ảnh trước Flow ([was:], trừ ảnh máy PawNail vẽ — vẽ lại được) và ảnh Flow vào [ai:…]. Không phải ảnh Flow → "". */
export function redrawKeepMarks(prompt: string, imageUrl: string | null): string {
  const p = String(prompt ?? "");
  if (!isFlowPrompt(p)) return "";
  const urls = (p.match(AI_MARK) ?? []).map((m) => m.slice(4, -1));
  const was = wasImage(p);
  if (was && restorableUrl(was) && !decodeWasmk(p).includes("[pr:")) urls.push(was);
  if (imageUrl && backupableUrl(imageUrl)) urls.push(imageUrl);
  return [...new Set(urls)].map((u) => `[ai:${u}]`).join("");
}
export const stripFlowMarks = (prompt: string) => String(prompt ?? "").replace(FLOW_MARKS, "");

export interface FlowUpload { secure_url: string; public_id: string; version: number; signature: string; width: number; height: number; bytes: number }
const int = (n: unknown) => typeof n === "number" && Number.isInteger(n);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Kiểm tra kết quả tải lên Cloudinary trước khi gắn vào mẫu. Trả lỗi (tiếng Việt + Anh) hoặc null nếu hợp lệ.
 *  So khớp CHUỖI GỐC (không phải URL đã chuẩn hoá) với mẫu cố định — chuỗi lưu vào imageUrl đúng là chuỗi đã kiểm.
 *  `publicIdBase` = flowPublicId(mã, mẫu); public_id phải là <thư mục>/<gốc>_<đuôi 10 hex>. */
export function checkFlowUpload(u: Partial<FlowUpload>, opts: { cloudName: string; publicIdBase: string; nowS?: number }): string | null {
  if (typeof u.secure_url !== "string" || typeof u.public_id !== "string") return "Thiếu link ảnh / missing upload result";
  const raw = u.secure_url;
  let href = "";
  try { href = new URL(raw).href; } catch { /* không phải URL */ }
  if (!href || href !== raw || raw.length > 400) return "Link ảnh không hợp lệ / invalid URL";
  if (!/^[a-z0-9_-]{1,64}$/i.test(opts.cloudName)) return "Máy chủ cấu hình sai kho Cloudinary / bad storage config";
  const prefix = `https://res.cloudinary.com/${opts.cloudName}/image/upload/`;
  if (!raw.startsWith("https://res.cloudinary.com/")) return "Ảnh phải nằm trên Cloudinary của PawNail / image must be on our Cloudinary";
  if (!raw.startsWith(prefix)) return "Ảnh không thuộc kho Cloudinary của PawNail / wrong Cloudinary cloud";
  if (!raw.includes(`/${FLOW_FOLDER}/`)) return "Ảnh không nằm trong thư mục ảnh Flow / wrong folder";
  const re = new RegExp(`^${escapeRe(prefix)}v(\\d{9,11})/(${escapeRe(FLOW_FOLDER)}/${escapeRe(opts.publicIdBase)}_[a-f0-9]{10})\\.(jpg|jpeg|png|webp)$`);
  const m = raw.match(re);
  if (!m || m[2] !== u.public_id) return "Ảnh không khớp mã mẫu / public_id does not match the code";
  if (!int(u.version) || String(u.version) !== m[1] || typeof u.signature !== "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(u.signature)) {
    return "Thiếu xác nhận của Cloudinary, tải lại ảnh / missing Cloudinary confirmation, upload again";
  }
  const now = opts.nowS ?? Math.round(Date.now() / 1000);
  const v = Number(m[1]);
  if (v < now - FLOW_VERSION_WINDOW_S || v > now + 600) return "Ảnh tải lên đã quá cũ, tải lại / upload too old, upload again";
  if (!int(u.width) || !int(u.height) || u.width! < FLOW_MIN_SIDE || u.height! < FLOW_MIN_SIDE) return `Ảnh phải từ ${FLOW_MIN_SIDE}px mỗi cạnh / image must be at least ${FLOW_MIN_SIDE}px`;
  if (Math.abs(u.width! - u.height!) > FLOW_SQUARE_TOLERANCE * Math.max(u.width!, u.height!)) return "Ảnh phải vuông 1:1 / image must be square";
  if (!int(u.bytes) || u.bytes! <= 0 || u.bytes! > FLOW_MAX_BYTES) return "Dung lượng ảnh không hợp lệ / invalid file size";
  return null;
}
