// Ảnh chụp thẳng từ điện thoại thường 3000-4000px, vài MB — tải thẳng lên
// trên mạng yếu (3G/4G chập chờn ở tiệm) dễ treo lâu hoặc timeout trước khi
// server kịp từ chối (server chỉ chặn > 10MB, không giúp gì với ảnh 8MB tải
// mất 40s trên mạng yếu). Nén nhẹ phía client trước khi gửi giải quyết cả
// hai: giảm thời gian chờ, và không cần đợi round-trip mạng mới biết file
// quá khổ.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_COMPRESSION_UNDER_BYTES = 400 * 1024; // đã đủ nhỏ, nén thêm phí CPU vô ích
const HARD_REJECT_OVER_BYTES = 20 * 1024 * 1024; // chặn thẳng — tránh decode ảnh khổng lồ làm treo máy yếu

export class FileTooLargeError extends Error {}

// Video và GIF động đi qua nguyên vẹn — canvas chỉ vẽ được 1 khung hình,
// nén qua canvas sẽ làm GIF mất hoạt ảnh.
function isCompressibleImage(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/gif";
}

export async function prepareFileForUpload(file: File): Promise<File> {
  if (file.size > HARD_REJECT_OVER_BYTES) {
    throw new FileTooLargeError(
      `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB) — vui lòng chọn file dưới 20MB.`
    );
  }

  if (!isCompressibleImage(file) || file.size <= SKIP_COMPRESSION_UNDER_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );

    // Ảnh đã nén sẵn tốt (vd JPEG chất lượng thấp có sẵn) có thể "nén lại"
    // ra to hơn bản gốc — khi đó cứ giữ nguyên file gốc.
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    // Nén thất bại (định dạng lạ, ảnh hỏng...) không được phép chặn cả luồng
    // upload — cứ để nguyên file gốc đi tiếp, server vẫn còn chốt chặn 10MB.
    console.error("Nén ảnh thất bại, tải lên bản gốc:", err);
    return file;
  }
}
