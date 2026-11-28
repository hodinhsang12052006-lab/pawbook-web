import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Khoá trên Vercel dính "\n" / dấu cách → cắt trước khi bất kỳ module nào đọc (lib/envTrim.ts). Chỉ log TÊN biến.
    const { trimEnv } = await import("./lib/envTrim");
    const fixed = trimEnv();
    if (fixed.length) console.warn(`[env] trimmed whitespace in: ${fixed.join(", ")}`);
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
