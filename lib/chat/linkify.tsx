import React from "react";

// Biến URL trong tin nhắn thành link bấm được (https://… và www.…). Không tải trước nội dung trang ngoài
// (không SSRF, không lộ IP người nhận); link trong PawNail mở ngay trong app, link ngoài mở tab/trình duyệt mới.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;
const INTERNAL = /^https?:\/\/(?:www\.)?bitpawos\.com(\/[^\s]*)?$/i;

export function linkify(text: string, className = ""): React.ReactNode {
  if (!text || !/(https?:\/\/|www\.)/i.test(text)) return text;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const raw = m[1];
    const href = raw.startsWith("www.") ? `https://${raw}` : raw;
    const internal = INTERNAL.exec(href);
    out.push(
      internal ? (
        <a key={m.index} href={internal[1] || "/"} className={className}>
          {raw}
        </a>
      ) : (
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={className}>
          {raw}
        </a>
      )
    );
    last = m.index + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
