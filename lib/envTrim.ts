// Biến môi trường dán vào Vercel hay dính dấu cách / xuống dòng ở cuối (VD `echo KEY | vercel env add` thêm "\n").
// Hậu quả thật trên production 11/2026: Cloudflare TURN 401 → cuộc gọi qua 4G kẹt "Connecting…", Giphy 401 → ô GIF
// trống. Gọi 1 lần lúc máy chủ khởi động (instrumentation.ts): cắt khoảng trắng 2 đầu của MỌI biến — không biến nào của
// app cần khoảng trắng ở đầu / cuối (khoá JSON / PEM vẫn đúng sau khi cắt). Trả về tên các biến đã sửa (không giá trị).
export function trimEnv(env: Record<string, string | undefined> = process.env): string[] {
  const fixed: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t !== v) {
      env[k] = t;
      fixed.push(k);
    }
  }
  (globalThis as { __pnEnvTrimmed?: string[] }).__pnEnvTrimmed = fixed;
  return fixed;
}
/** Tên các biến đã bị cắt lúc khởi động (dùng chung giữa instrumentation và route qua globalThis). */
export const trimmedEnvNames = (): string[] => (globalThis as { __pnEnvTrimmed?: string[] }).__pnEnvTrimmed ?? [];
