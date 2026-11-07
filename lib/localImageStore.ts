// Ảnh CHỈ lưu trên máy này (IndexedDB "pn-local" v1, kho "wallpapers", khoá "<userId>:<uuid>") — hình nền chat
// "Ảnh của bạn". Không bao giờ tải lên máy chủ. Mọi lỗi (chế độ riêng tư, bị chặn bộ nhớ…) → trả null / false.
const DB = "pn-local";
const STORE = "wallpapers";

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const localImageKey = (uid: string, id: string) => `${uid}:${id}`;

export async function putLocalImage(uid: string, id: string, blob: Blob): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(blob, localImageKey(uid, id)));
    return true;
  } catch {
    return false;
  }
}
export async function getLocalImage(uid: string, id: string): Promise<Blob | null> {
  try {
    const v = await run<unknown>("readonly", (s) => s.get(localImageKey(uid, id)));
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}
export async function deleteLocalImage(uid: string, id: string): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.delete(localImageKey(uid, id)));
    return true;
  } catch {
    return false;
  }
}
/** Xoá mọi ảnh của người này không còn trong `keep` (dọn rác khi lưu). */
export async function gcLocalImages(uid: string, keep: Set<string>): Promise<number> {
  try {
    const keys = (await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys())).map(String).filter((k) => k.startsWith(`${uid}:`));
    const drop = keys.filter((k) => !keep.has(k.slice(uid.length + 1)));
    for (const k of drop) await run("readwrite", (s) => s.delete(k));
    return drop.length;
  } catch {
    return 0;
  }
}

// ---- Xử lý ảnh trước khi lưu: xoay đúng chiều, cạnh dài ≤ 1600px, (tuỳ chọn) làm mờ, WebP 0.82 (JPEG nếu máy không
// hỗ trợ WebP), > 400 KB thì nén lại 0.7. Vẽ lại qua canvas nên mọi EXIF (vị trí GPS…) bị bỏ.
export const WALLPAPER_MAX_BYTES = 25 * 1024 * 1024;
const LONG_SIDE = 1600;
const TARGET = 400 * 1024;

export function isAcceptableImage(f: File | null | undefined): f is File {
  return !!f && /^image\//.test(f.type) && f.size > 0 && f.size <= WALLPAPER_MAX_BYTES;
}

function toBlob(c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob((b) => res(b && b.type === type ? b : null), type, q));
}

export async function processWallpaperImage(file: File, blur: boolean): Promise<{ blob: Blob; w: number; h: number } | null> {
  try {
    let bmp: ImageBitmap | HTMLImageElement;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // trình duyệt cũ: đọc qua <img> (vẫn từ file trên máy, không qua mạng)
      const url = URL.createObjectURL(file);
      bmp = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      }).finally(() => URL.revokeObjectURL(url));
    }
    const sw = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
    const sh = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
    if (!sw || !sh) return null;
    const k = Math.min(1, LONG_SIDE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * k));
    const h = Math.max(1, Math.round(sh * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    if (blur) {
      ctx.filter = "blur(12px)";
      // tràn mép 24px để viền không bị mờ thành trong suốt
      ctx.drawImage(bmp, -24, -24, w + 48, h + 48);
      ctx.filter = "none";
    } else ctx.drawImage(bmp, 0, 0, w, h);
    if ("close" in bmp) bmp.close();
    let blob = (await toBlob(c, "image/webp", 0.82)) || (await toBlob(c, "image/jpeg", 0.82));
    if (blob && blob.size > TARGET) blob = (await toBlob(c, blob.type, 0.7)) || blob;
    return blob ? { blob, w, h } : null;
  } catch {
    return null;
  }
}
