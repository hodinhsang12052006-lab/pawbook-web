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
const PROMPT_MAX = 2000;
const DAY_S = 86_400;

/** Prisma where: mẫu có ảnh Flow. Dùng trong NOT: [...] cho mọi chỗ tự ghi ảnh. */
export const FLOW_WHERE = { prompt: { contains: "[flow:" } } as const;
export const isFlowPrompt = (p: string | null | undefined): boolean => !!p && p.includes("[flow:");

// Mã ảnh: D001…D999 (lô brief 2026-11) hoặc id mẫu (cuid) — lô sau dùng thẳng id mẫu làm mã.
export const D_CODE_RE = /^D\d{3}$/;
export const DESIGN_ID_RE = /^c[a-z0-9]{20,31}$/;
export const isFlowCode = (s: string) => D_CODE_RE.test(s) || DESIGN_ID_RE.test(s);

/** Đọc mã từ tên file ảnh Flow ("D001.png", "D017 (1).jpeg", "<id mẫu>.jpg"). Có cả id mẫu lẫn D-mã → lấy id mẫu. */
export function codeFromFilename(name: string): string | null {
  const base = String(name ?? "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const id = base.match(/(?:^|[^a-z0-9])(c[a-z0-9]{24})(?![a-z0-9])/);
  if (id && /\d/.test(id[1])) return id[1];
  const d = base.match(/(?:^|[^A-Za-z0-9])[Dd](\d{3})(?![0-9])/);
  return d ? `D${d[1]}` : null;
}

/** public_id trên Cloudinary (trong thư mục FLOW_FOLDER): theo MẪU, không theo mã lô — lô sau có dùng lại "D001"
 *  cũng không ghi đè ảnh của mẫu khác. */
export function flowPublicId(code: string, designId: string): string {
  if (!isFlowCode(code) || !DESIGN_ID_RE.test(designId)) throw new Error("bad flow code");
  return code === designId ? designId : `${code}_${designId}`;
}

const IMPORT_STRIP = /\[(pr|q|try|redraws|img|hid):[^\]]*\]/g;
const FLOW_MARKS = /\[(flow|was|wasmk):[^\]]*\]/g;
const AI_MARK = /\[ai:[^\]]*\]/g;

export interface FlowMark { code: string; date: string }
export function flowMark(prompt: string | null | undefined): FlowMark | null {
  const m = String(prompt ?? "").match(/\[flow:([A-Za-z0-9_-]+):(\d{4}-\d{2}-\d{2})\]/);
  return m ? { code: m[1], date: m[2] } : null;
}
/** Ảnh trước khi nhập Flow: undefined = không có dấu [was:], null = trước đó chưa có ảnh. */
export function wasImage(prompt: string | null | undefined): string | null | undefined {
  const m = String(prompt ?? "").match(/\[was:([^\]]*)\]/);
  return m ? m[1] || null : undefined;
}
/** URL ảnh cũ đủ an toàn để cất trong dấu [was:] (không chứa ngoặc, không phải data URL khổng lồ). */
export const backupableUrl = (u: string | null | undefined) => !u || (/^https:\/\/[^\s[\]]+$/.test(u) && u.length <= 600);

/** prompt sau khi nhập ảnh Flow `code` ngày `date`. Nhập lại (đã là ảnh Flow) → GIỮ [was:] gốc, chỉ thay dấu [flow:]. */
export function importPrompt(prompt: string, prevImageUrl: string | null, code: string, date: string): string {
  if (!isFlowCode(code) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("bad flow mark");
  const p = String(prompt ?? "");
  const ai = (p.match(AI_MARK) ?? []).join("");
  let was: string;
  let wasmk: string;
  if (isFlowPrompt(p)) {
    was = p.match(/\[was:[^\]]*\]/)?.[0] ?? "";
    wasmk = p.match(/\[wasmk:[^\]]*\]/)?.[0] ?? "";
  } else {
    if (!backupableUrl(prevImageUrl)) throw new Error("previous image cannot be backed up");
    was = `[was:${prevImageUrl ?? ""}]`;
    const removed = (p.match(IMPORT_STRIP) ?? []).join("");
    wasmk = removed ? `[wasmk:${encodeURIComponent(removed)}]` : "";
  }
  const base = p.replace(IMPORT_STRIP, "").replace(AI_MARK, "").replace(FLOW_MARKS, "").trimEnd();
  const marks = `${ai}${was}${wasmk}[flow:${code}:${date}]`;
  return `${base.slice(0, Math.max(0, PROMPT_MAX - marks.length))}${marks}`;
}

/** Hoàn tác: ảnh + prompt trước khi nhập Flow (null nếu mẫu không phải ảnh Flow / thiếu dấu [was:]). */
export function undoPrompt(prompt: string): { prompt: string; imageUrl: string | null } | null {
  const p = String(prompt ?? "");
  if (!isFlowPrompt(p)) return null;
  const was = wasImage(p);
  if (was === undefined) return null;
  let restored = "";
  const enc = p.match(/\[wasmk:([^\]]*)\]/)?.[1];
  if (enc) {
    try { restored = (decodeURIComponent(enc).match(IMPORT_STRIP) ?? []).join(""); } catch { restored = ""; }
  }
  return { prompt: `${p.replace(FLOW_MARKS, "").trimEnd()}${restored}`, imageUrl: was };
}

/** Admin bấm vẽ lại 1 mẫu đang là ảnh Flow: gỡ dấu Flow, cất URL ảnh Flow vào [ai:…] (khôi phục được). */
export function redrawKeepMark(prompt: string, imageUrl: string | null): string {
  return isFlowPrompt(prompt) && imageUrl && backupableUrl(imageUrl) ? `[ai:${imageUrl}]` : "";
}
export const stripFlowMarks = (prompt: string) => String(prompt ?? "").replace(FLOW_MARKS, "");

export interface FlowUpload { secure_url: string; public_id: string; width: number; height: number; bytes: number }
const int = (n: unknown) => typeof n === "number" && Number.isInteger(n);

/** Kiểm tra kết quả tải lên Cloudinary trước khi gắn vào mẫu. Trả lỗi (tiếng Việt + Anh) hoặc null nếu hợp lệ. */
export function checkFlowUpload(u: Partial<FlowUpload>, opts: { cloudName: string; publicId: string; nowS?: number }): string | null {
  if (typeof u.secure_url !== "string" || typeof u.public_id !== "string") return "Thiếu link ảnh / missing upload result";
  let url: URL;
  try { url = new URL(u.secure_url); } catch { return "Link ảnh không hợp lệ / invalid URL"; }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password || url.search || url.hash) {
    return "Ảnh phải nằm trên Cloudinary của PawNail / image must be on our Cloudinary";
  }
  const m = url.pathname.match(/^\/([A-Za-z0-9_-]+)\/image\/upload\/v(\d{9,11})\/([A-Za-z0-9_/-]+)\.(jpg|jpeg|png|webp)$/);
  if (!m || m[1] !== opts.cloudName) return "Ảnh không thuộc kho Cloudinary của PawNail / wrong Cloudinary cloud";
  const expected = `${FLOW_FOLDER}/${opts.publicId}`;
  if (!m[3].startsWith(`${FLOW_FOLDER}/`)) return "Ảnh không nằm trong thư mục ảnh Flow / wrong folder";
  if (m[3] !== u.public_id || u.public_id !== expected) return "Ảnh không khớp mã mẫu / public_id does not match the code";
  const now = opts.nowS ?? Math.round(Date.now() / 1000);
  const v = Number(m[2]);
  if (v < now - DAY_S || v > now + 600) return "Ảnh tải lên đã quá cũ, tải lại / upload too old, upload again";
  if (!int(u.width) || !int(u.height) || u.width! < FLOW_MIN_SIDE || u.height! < FLOW_MIN_SIDE) return `Ảnh phải từ ${FLOW_MIN_SIDE}px mỗi cạnh / image must be at least ${FLOW_MIN_SIDE}px`;
  if (Math.abs(u.width! - u.height!) > FLOW_SQUARE_TOLERANCE * Math.max(u.width!, u.height!)) return "Ảnh phải vuông 1:1 / image must be square";
  if (!int(u.bytes) || u.bytes! <= 0 || u.bytes! > FLOW_MAX_BYTES) return "Dung lượng ảnh không hợp lệ / invalid file size";
  return null;
}
