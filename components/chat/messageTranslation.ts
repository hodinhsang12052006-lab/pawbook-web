"use client";

// Bản dịch tin nhắn ở trình duyệt: gom các yêu cầu trong 60ms thành 1 lần gọi /api/messages/translate,
// nhớ kết quả trong phiên (bong bóng chat + dòng xem trước ở danh sách dùng chung).
//   - người xem tiếng Anh nhận tin tiếng Việt → TỰ dịch, có nút "Show original";
//   - người xem tiếng Việt nhận tin tiếng Anh → nút "Xem bản dịch" (bấm mới dịch).
import { useEffect, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n/config";
import { detectTextLang } from "@/lib/i18n/detectLang";

type Entry = { status: "loading" | "done" | "failed"; text?: string };
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const k = (lang: Locale, id: string) => `${lang}:${id}`;

let queue: { id: string; lang: Locale }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const batch = queue;
  queue = [];
  const byLang = new Map<Locale, string[]>();
  for (const q of batch) byLang.set(q.lang, [...(byLang.get(q.lang) ?? []), q.id]);
  for (const [lang, ids] of byLang) {
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      fetch("/api/messages/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: chunk, to: lang }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { translations?: Record<string, string> } | null) => {
          for (const id of chunk) {
            const t = d?.translations?.[id];
            store.set(k(lang, id), t ? { status: "done", text: t } : { status: "failed" });
          }
          emit();
        })
        .catch(() => {
          for (const id of chunk) store.set(k(lang, id), { status: "failed" });
          emit();
        });
    }
  }
}

/** Xin bản dịch (không gửi lại nếu đã có / đang chờ). Tin tạm (đang gửi) không dịch. */
export function requestTranslation(id: string, lang: Locale) {
  if (!id || id.startsWith("temp") || store.has(k(lang, id))) return;
  store.set(k(lang, id), { status: "loading" });
  queue.push({ id, lang });
  if (!timer) timer = setTimeout(flush, 60);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snap = () => version;

export function getTranslation(id: string, lang: Locale): Entry | undefined {
  return store.get(k(lang, id));
}

/** Tin này nên dịch tự động cho người xem không (tiếng Việt → người xem tiếng Anh). */
export const autoTranslates = (text: string | null | undefined, viewer: Locale) => viewer === "en" && detectTextLang(text) === "vi";
/** Tin này có thể dịch theo yêu cầu (ngôn ngữ đoán được khác ngôn ngữ người xem). */
export const canTranslate = (text: string | null | undefined, viewer: Locale) => {
  const l = detectTextLang(text);
  return !!l && l !== viewer;
};

/**
 * Bản dịch của 1 tin CHỮ cho người xem `viewer`. `auto` = tự xin dịch ngay (người xem tiếng Anh, tin tiếng
 * Việt). Trả undefined khi không cần / chưa xin.
 */
export function useMessageTranslation(id: string, text: string, viewer: Locale, opts: { enabled: boolean; auto: boolean }) {
  useSyncExternalStore(subscribe, snap, () => 0);
  useEffect(() => {
    if (opts.enabled && opts.auto) requestTranslation(id, viewer);
  }, [id, viewer, opts.enabled, opts.auto]);
  return opts.enabled ? getTranslation(id, viewer) : undefined;
}
