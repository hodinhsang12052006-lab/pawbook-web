"use client";

import { prepareFileForUpload } from "@/lib/compressImage";
import { tr } from "@/lib/i18n/tr";

// Tải 1 ảnh hoặc video, trả về URL công khai.
//   • Ảnh  → nén trên máy rồi qua /api/upload (máy chủ kiểm tra đúng là ảnh).
//   • Video → tải THẲNG lên Cloudinary bằng chữ ký từ /api/upload/sign (Vercel
//     giới hạn body ~4.5MB), có báo % tiến độ.
export const MAX_VIDEO_MB = 50;

export class UploadError extends Error {}

/** Tải thẳng lên Cloudinary (resource "video" — gồm cả audio) bằng chữ ký của máy chủ, có báo %. */
async function signedUpload(file: File, onProgress?: (pct: number) => void, label = tr("video", "video")): Promise<string> {
  const signRes = await fetch("/api/upload/sign", { method: "POST" });
  const sign = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new UploadError(sign.error || tr(`Chưa tải được ${label}.`, `Couldn't upload the ${label}.`));
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  form.append("allowed_formats", sign.allowed_formats);
  return await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new UploadError(data?.error?.message ? tr(`Tệp không hợp lệ: ${data.error.message}`, `Invalid file: ${data.error.message}`) : tr(`Tải ${label} thất bại.`, `Upload failed.`)));
      } catch {
        reject(new UploadError(tr(`Tải ${label} thất bại.`, "Upload failed.")));
      }
    };
    xhr.onerror = () => reject(new UploadError(tr("Lỗi mạng khi tải lên.", "Network error while uploading.")));
    xhr.send(form);
  });
}

/** Tin nhắn thoại: bản ghi (webm trên Chrome/Android, mp4 trên iPhone) → URL Cloudinary. */
export async function uploadVoice(blob: Blob): Promise<string> {
  const ext = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
  const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || `audio/${ext}` });
  return signedUpload(file, undefined, tr("tin nhắn thoại", "voice message"));
}

export async function uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new UploadError(tr(`Video tối đa ${MAX_VIDEO_MB}MB.`, `Videos up to ${MAX_VIDEO_MB}MB.`));
    return signedUpload(file, onProgress);
  }

  const prepared = await prepareFileForUpload(file);
  const form = new FormData();
  form.append("file", prepared);
  onProgress?.(30);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new UploadError(data.error || tr("Tải ảnh thất bại.", "Image upload failed."));
  onProgress?.(100);
  return data.url as string;
}

export const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) || /\/video\/upload\//.test(u);
