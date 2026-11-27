"use client";

// Khung soạn tin của Messenger (tách khỏi MessagesContent): ô nhập, nút Gửi ↔ micro, thanh gợi ý nhãn dán, hàng gợi ý
// trả lời (ChatAssist), bảng Emoji / Nhãn dán / GIF, bảng đính kèm "+", ghi âm. MỌI trạng thái của khung nằm ở đây →
// gõ phím / mở bảng chỉ vẽ lại khung này; tin mới / gửi tin (MessagesContent đổi state) không vẽ lại khung này
// (React.memo, mọi prop từ cha đều ổn định giữa các lần gửi).
import React, { memo, startTransition, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Smile, Image as ImageIcon, Mic, Plus as PlusIcon, Sparkles as SparklesIcon, SendHorizontal } from "lucide-react";
import { CS } from "@/lib/i18n/chatStrings";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { trailingEmoji } from "@/lib/chat/emojiOnly";
import { pushRecentSticker, readMediaTab } from "@/lib/stickers/store";
import { useGifEnabled } from "@/lib/chat/gifAvailability";
import { guessMarketInBrowser, readMarketCookie } from "@/lib/market";
import ChatAssist from "./ChatAssist";
import MediaPicker from "./MediaPicker";
import VoiceRecorder from "./VoiceRecorder";
import StickerSuggest from "./StickerSuggest";
import type { ActiveChatType } from "./chatShared";

// Ô soạn tin tự cao theo nội dung (tối đa 6 dòng = 152px rồi cuộn trong). Trình duyệt có `field-sizing: content`
// thì CSS tự lo; còn lại đặt chiều cao theo scrollHeight.
function growInput(el: HTMLTextAreaElement | null) {
  if (!el || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(152, el.scrollHeight)}px`;
}
const finePointer = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

export type SendFn = (content?: string, type?: string, reuseClientId?: string, opts?: { keepPanel?: boolean }) => void | Promise<void>;

/** Cha điều khiển khung soạn tin qua ref này (không qua props → không vẽ lại khung khi cha đổi state). */
export type ComposerApi = {
  /** Điền / sửa chữ trong ô (câu mở đầu gợi ý, bản nháp từ Menu…) */
  setText: (v: string | ((prev: string) => string)) => void;
  focus: () => void;
  /** MessagesContent vừa nhận 1 lần gửi: xoá chữ đã gõ (tin gõ tay), đóng bảng biểu tượng (trừ khi gửi liền nhiều nhãn
   *  dán / GIF) và bảng "+". Ô nhập trống NGAY (DOM); phần vẽ lại khung (Gửi → micro, hàng gợi ý hiện lại) là việc nền —
   *  bong bóng tin vừa gửi được vẽ trước. */
  onSending: (opts: { clearText: boolean; keepPanel: boolean }) => void;
  /** Đóng bảng đính kèm + bảng biểu tượng (Back trên điện thoại đóng cuộc trò chuyện) */
  closeSheets: () => void;
};

export type Unanswered = { content: string; type: "TEXT" | "IMAGE" } | null;

type Props = {
  apiRef: React.Ref<ComposerApi>;
  /** Ô nhập KHÔNG điều khiển bằng state (chữ nằm trong DOM) — cha đọc nội dung lúc gửi qua ref này */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  nearBottomRef: React.RefObject<boolean>;
  /** Ô chứa nút "xuống tin mới nhất" (ChatThread) — nhận biến --m-composer-h */
  jumpSlotRef: React.RefObject<HTMLDivElement | null>;
  /** Bảng biểu tượng mở trên điện thoại có 1 mục lịch sử riêng — closeThread của cha cần biết để lùi đúng số mục */
  panelPushedRef: React.RefObject<boolean>;
  chat: ActiveChatType;
  currentUser: any;
  viewerLang: "vi" | "en";
  t: (key: string) => string;
  /** Tin của cuộc trò chuyện đã nạp từ mạng (không phải bản lưu trên máy) — mới hiện hàng gợi ý */
  assistReady: boolean;
  established: boolean;
  unanswered: Unanswered;
  partnerWrote: boolean;
  onSend: SendFn;
  onPhoto: () => void;
  onTyping: () => void;
  onStudio: () => void;
  onConsult: (image: string | null) => void;
  /** Hộp thoại Thử mẫu / Soi tay (cha giữ state + ảnh của cuộc trò chuyện) — null khi đóng */
  overlay: React.ReactNode;
};

function ChatComposer({
  apiRef, inputRef, scrollRef, nearBottomRef, jumpSlotRef, panelPushedRef, chat, currentUser, viewerLang, t,
  assistReady, established, unanswered, partnerWrote, onSend, onPhoto, onTyping, onStudio, onConsult, overlay,
}: Props) {
  useTr(); // render lại khi đổi VI/EN

  // Chỉ đổi khi ô chuyển rỗng ↔ có chữ (bật/tắt nút Gửi) — gõ chữ thường không vẽ lại gì.
  const [hasText, setHasTextState] = useState(false);
  const hasTextRef = useRef(false);
  // Chỉ gọi setState khi THẬT SỰ đổi (gọi với cùng giá trị React vẫn có thể chạy lại thân component).
  const setHasText = useCallback((v: boolean, background = false) => {
    if (hasTextRef.current === v) return;
    hasTextRef.current = v;
    if (background) startTransition(() => setHasTextState(v));
    else setHasTextState(v);
  }, []);
  // Gợi ý nhãn dán: ô soạn tin là đúng 1 emoji (hoặc "từ" cuối là 1 emoji) → thanh nhãn khớp phía trên ô (StickerSuggest).
  // Chỉ setState khi emoji gợi ý ĐỔI. Đóng (×) → ẩn cho tới khi đổi emoji.
  const [stickerHint, setStickerHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState<string | null>(null);
  const stickerHintRef = useRef<string | null>(null);
  // Cả ô là 1 emoji → hiện NGAY; chỉ "từ" cuối là emoji (đang gõ câu: "ok 😂", "😂" → "😂😂") → chờ 200ms gõ yên mới hiện,
  // thanh không bật / tắt liên tục (mỗi lần ~72px khung tin co / giãn). Ẩn thì luôn ngay (không để thanh gợi ý emoji cũ).
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateStickerHint = useCallback((v: string) => {
    const g = trailingEmoji(v);
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    const apply = () => {
      if (g === stickerHintRef.current) return;
      stickerHintRef.current = g;
      setStickerHint(g);
      if (!g) setHintDismissed(null);
    };
    if (!g || g === stickerHintRef.current || v.trim() === g) return apply();
    // đổi sang emoji cuối KHÁC: thanh của emoji cũ ẩn ngay (chạm nhầm sẽ gửi nhãn của emoji cũ), thanh mới chờ 200ms
    if (stickerHintRef.current) {
      stickerHintRef.current = null;
      setStickerHint(null);
    }
    hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null;
      apply();
    }, 200);
  }, []);
  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);
  const setMessageText = useCallback((v: string | ((prev: string) => string), background = false) => {
    const el = inputRef.current;
    if (!el) return;
    el.value = typeof v === "function" ? v(el.value) : v;
    setHasText(!!el.value.trim(), background);
    if (background) startTransition(() => updateStickerHint(el.value));
    else updateStickerHint(el.value);
    growInput(el);
  }, [inputRef, setHasText, updateStickerHint]);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [gifHandoff, setGifHandoff] = useState<string | undefined>(undefined); // "Tìm GIF …" từ tab Nhãn dán
  // GIF chỉ có khi máy chủ có khoá GIPHY / Tenor — chưa có thì ẩn MỌI lối vào GIF (tab, menu "+", "Tìm GIF …")
  const gifOn = useGifEnabled();
  // Thị trường cho bộ nhãn dán theo mùa: tài khoản → cookie → đoán theo trình duyệt → Mỹ
  const stickerMarket = useMemo<"US" | "AU">(() => {
    const m = currentUser?.market;
    if (m === "US" || m === "AU") return m;
    return (typeof window !== "undefined" && (readMarketCookie() ?? guessMarketInBrowser())) || "US";
  }, [currentUser?.market]);
  const [recording, setRecording] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);

  const handleCloseMediaPanel = useCallback(() => {
    setShowEmoji(false);
    setShowGifs(false);
  }, []);

  useImperativeHandle(apiRef, () => ({
    setText: (v) => setMessageText(v),
    focus: () => inputRef.current?.focus(),
    onSending: ({ clearText, keepPanel }) => {
      if (clearText) setMessageText("", true);
      startTransition(() => {
        // Gửi nhãn dán / GIF: bảng VẪN MỞ (gửi liền nhiều cái như Telegram)
        if (!keepPanel) handleCloseMediaPanel();
        setAttachOpen(false);
      });
    },
    closeSheets: () => {
      setAttachOpen(false);
      setShowEmoji(false);
    },
  }), [setMessageText, handleCloseMediaPanel, inputRef]);

  // Đổi cuộc trò chuyện: xoá chữ đang soạn + đóng bảng biểu tượng (KHÔNG remount — giữ nguyên phần còn lại).
  useEffect(() => {
    setMessageText("");
    updateStickerHint("");
    setShowEmoji(false);
    setShowGifs(false);
    setChatPanelTab("emoji");
  }, [chat.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Gợi ý trả lời thu gọn lại khi đổi cuộc trò chuyện
  useEffect(() => setAssistOpen(false), [chat.id]);

  // Bảng Emoji / Nhãn dán / GIF trên điện thoại: thêm 1 mục lịch sử khi mở → nút Back (Android / trình duyệt) đóng
  // bảng trước, không thoát cuộc trò chuyện. Đóng bằng X / Esc / chạm ra ngoài → tự bỏ mục đó.
  const panelOpen = showEmoji || showGifs;
  // Thanh gợi ý nhãn dán hiện / ẩn (và hàng gợi ý trả lời đổi theo ô trống ↔ có chữ) làm khung tin co / giãn. ResizeObserver
  // của khung tin giữ dính đáy, NHƯNG 2 lần đổi ngược nhau trong cùng 1 khung hình (xoá ô rồi gõ emoji ngay) thì nó không báo
  // gì (cỡ cuối = cỡ cũ) trong khi trình duyệt đã kéo scrollTop lùi lúc khung giãn → tin cuối bị thanh che. Đang ở sát đáy →
  // dính lại đáy ngay sau mỗi lần đổi (trước khi vẽ).
  const stripShown = !!stickerHint && stickerHint !== hintDismissed && !panelOpen && !recording;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [stripShown, hasText]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (panelOpen) {
      if (panelPushedRef.current || window.matchMedia("(min-width: 768px)").matches) return;
      try {
        window.history.pushState({ ...((window.history.state || {}) as Record<string, unknown>), pnPanel: true }, "");
        panelPushedRef.current = true;
      } catch {}
    } else if (panelPushedRef.current) {
      panelPushedRef.current = false;
      if ((window.history.state as { pnPanel?: boolean } | null)?.pnPanel) window.history.back();
    }
  }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => {
      if (panelPushedRef.current && !(window.history.state as { pnPanel?: boolean } | null)?.pnPanel) {
        panelPushedRef.current = false;
        setShowEmoji(false);
        setShowGifs(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bảng đính kèm: Esc đóng + trả focus về nút "+"; mở ra thì focus mục đầu
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const attachSheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!attachOpen) return;
    attachSheetRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAttachOpen(false);
      attachBtnRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attachOpen]);

  // ----- V2: chiều cao khung soạn tin → vị trí nút "xuống tin mới nhất"
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Khung soạn tin cao thêm (bảng Emoji / Nhãn dán / GIF nằm TRONG khung trên điện thoại, ô nhập nhiều dòng…) → khung tin
    // co lại; đang ở cuối đoạn chat thì giữ dính đáy để tin vừa gửi không bị khuất.
    const ro = new ResizeObserver(() => {
      // Biến CSS đặt lên Ô CHỨA RIÊNG nút "xuống tin mới nhất", KHÔNG lên khung chat: biến tuỳ biến đổi ở 1 phần tử cha là
      // trình duyệt tính lại style cho MỌI phần tử con — cả trăm dòng tin (~100 ms ở CPU chậm 4x mỗi lần hàng gợi ý ẩn /
      // hiện: phím đầu tiên, gửi tin).
      jumpSlotRef.current?.style.setProperty("--m-composer-h", `${el.offsetHeight}px`);
      const sc = scrollRef.current;
      if (sc && nearBottomRef.current) sc.scrollTop = sc.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chạm 1 nhãn trên thanh gợi ý: gửi nhãn đó + bỏ emoji vừa gõ khỏi ô soạn tin (cả ô chỉ là emoji → ô trống; "hehe 😂" →
  // còn "hehe", không mất chữ đã gõ). Bàn phím vẫn mở (nút chặn pointerdown).
  const pickSuggestedSticker = (id: string) => {
    const el = inputRef.current;
    const g = stickerHintRef.current;
    if (el && g) {
      const v = el.value.trimEnd();
      setMessageText(v.endsWith(g) ? v.slice(0, v.length - g.length).trimEnd() : v);
    }
    if (currentUser?.id) pushRecentSticker(currentUser.id, id);
    onSend(id, "STICKER", undefined, { keepPanel: true });
  };

  // Khách đang nhắn với tiệm / thợ → ✨ là "Thử mẫu trên tay mình rồi gửi tiệm"
  const clientChat = currentUser?.role === "CLIENT" && !chat.isGroup && (chat.role === "TECHNICIAN" || chat.role === "OWNER");

  return (
    <div ref={composerRef} className="pn-composer relative flex-none z-10 border-t border-white/[0.06] px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4">
      {overlay}
      {/* đang gõ → ẩn thanh gợi ý cho ô nhập + bàn phím đủ chỗ (bấm gợi ý xong cũng ẩn: đã dùng).
          Chờ tin MỚI của cuộc trò chuyện nạp xong (không dùng bản lưu trên máy) — không thì thoáng hiện gợi ý theo tin cũ rồi mới đổi. */}
      {/* Bảng Emoji / Nhãn dán / GIF đang mở → ẩn hàng gợi ý (không chen giữa bảng và ô nhập, giữ chỗ cho tin nhắn) */}
      {!panelOpen && !recording && !hasText && assistReady && currentUser && !chat.isGroup && established && !assistOpen && (
        <button type="button" onClick={() => setAssistOpen(true)} aria-expanded={false} data-assist-toggle="" className="mb-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-[var(--m-text-2)] ring-1 ring-white/[0.08]">
          <SparklesIcon className="h-3.5 w-3.5" aria-hidden />{tr("Gợi ý", "Suggest")}
        </button>
      )}
      {!panelOpen && !recording && !hasText && assistReady && currentUser && !chat.isGroup && (!established || assistOpen) && (
        <ChatAssist
          me={{ id: currentUser.id, role: currentUser.role, market: currentUser.market }}
          partner={{ id: chat.id, role: chat.role, isGroup: !!chat.isGroup }}
          last={unanswered}
          partnerWrote={partnerWrote}
          onFill={(text) => { setMessageText(text); inputRef.current?.focus(); }}
          onStudio={() => { handleCloseMediaPanel(); onStudio(); }}
          onConsult={(image) => { handleCloseMediaPanel(); onConsult(image); }}
          onPhoto={onPhoto}
        />
      )}
      {(showEmoji || showGifs) && currentUser?.id && (
        <MediaPicker
          userId={currentUser.id}
          market={stickerMarket}
          lang={viewerLang}
          tab={chatPanelTab}
          gifQuery={gifHandoff}
          onTab={(tab, q) => { setChatPanelTab(tab); setGifHandoff(tab === "gif" ? q : undefined); setShowEmoji(true); setShowGifs(tab === "gif"); }}
          onEmoji={(e) => setMessageText((prev) => prev + e)}
          onSticker={(id) => onSend(id, "STICKER", undefined, { keepPanel: true })}
          onGif={(g) => onSend(g.send, "IMAGE", undefined, { keepPanel: true })}
          onClose={handleCloseMediaPanel}
        />
      )}
      {/* Gợi ý nhãn dán theo emoji đang gõ — trong khung soạn tin (khung tin co lại, tin cuối không bị che); bảng biểu tượng
          đang mở thì ẩn (bảng đã có tab Nhãn dán) */}
      {stripShown && stickerHint && currentUser?.id && (
        <StickerSuggest glyph={stickerHint} onPick={pickSuggestedSticker} onDismiss={() => setHintDismissed(stickerHint)} />
      )}
      {/* 1 hàng như Messenger: [😊][GIF][📎] · ô nhập bo tròn · nút gửi tròn. Trước đây nút
          biểu tượng nằm riêng 1 hàng phía trên, tốn chỗ và nhìn rời rạc. */}
      {recording ? (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onSend={(url, secs) => { setRecording(false); onSend(`${url}#d=${secs}`, "AUDIO"); }}
          />
        </div>
      ) : (
      <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="relative flex items-end gap-1 sm:gap-1.5">
        {/* 1 nút "+" duy nhất mở bảng đính kèm (ảnh/video, GIF, thử mẫu) — thay cho 4 nút chen chúc ở 360px */}
        <button
          type="button"
          ref={attachBtnRef}
          onClick={() => { setAttachOpen((v) => !v); setShowEmoji(false); }}
          aria-expanded={attachOpen}
          aria-label={CS.attach(gifOn === true)}
          title={gifOn === true ? tr("Ảnh, ghi âm, GIF", "Photo, voice, GIF") : tr("Ảnh, ghi âm", "Photo, voice")}
          className="m-cbtn"
        >
          <PlusIcon className={`h-6 w-6 transition-transform duration-150 motion-reduce:transition-none ${attachOpen ? "rotate-45" : ""}`} />
        </button>
        {attachOpen && (
          <>
            <div aria-hidden className="fixed inset-0 z-20" onClick={() => setAttachOpen(false)} />
            <div ref={attachSheetRef} role="menu" className="m-attach-sheet">
              <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); onPhoto(); }}>
                <span><ImageIcon className="h-[22px] w-[22px]" /></span>
                {tr("Gửi ảnh hoặc video", "Send a photo or video")}
              </button>
              {gifOn === true && (
                <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); inputRef.current?.blur(); setGifHandoff(undefined); setShowEmoji(true); setChatPanelTab("gif"); setShowGifs(true); }}>
                  <span className="text-[13px] font-semibold">GIF</span>
                  {tr("Chèn ảnh động GIF", "Insert GIF")}
                </button>
              )}
              {(["TECHNICIAN", "OWNER", "ADMIN"].includes(currentUser?.role) || clientChat) && !chat.isGroup ? (
                <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); handleCloseMediaPanel(); onStudio(); }}>
                  <span><SparklesIcon className="h-[22px] w-[22px]" /></span>
                  {tr("Tạo mẫu", "Try-on looks")}
                </button>
              ) : (
                <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); handleCloseMediaPanel(); setRecording(true); }}>
                  <span><Mic className="h-[22px] w-[22px]" /></span>
                  {tr("Ghi âm", "Record voice")}
                </button>
              )}
            </div>
          </>
        )}

        <div className="pn-input-wrap relative flex min-w-0 flex-1 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            defaultValue=""
            onChange={(e) => {
              const has = !!e.target.value.trim();
              setHasText(has); // chỉ render lại khi ô chuyển rỗng ↔ có chữ
              updateStickerHint(e.target.value); // … hoặc khi emoji gợi ý nhãn dán đổi
              growInput(e.target);
              if (has) onTyping();
            }}
            onKeyDown={(e) => {
              // Điện thoại (chạm): Enter = xuống dòng, gửi bằng nút. Máy tính: Enter gửi, Shift+Enter xuống dòng.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) {
                e.preventDefault();
                if (inputRef.current?.value.trim()) onSend();
              }
            }}
            onFocus={() => setAttachOpen(false)}
            enterKeyHint="enter"
            autoComplete="off"
            // QA chọn ô nhập bằng thuộc tính này, không theo chữ gợi ý (đã đổi "Viết tin nhắn..." → "Nhắn tin").
            data-chat-input=""
            placeholder={t("messenger.inputPlaceholder")}
            aria-label={t("messenger.inputPlaceholder")}
            className="m-input"
          />
          <button
            type="button"
            data-media-toggle=""
            aria-expanded={showEmoji}
            onClick={() => {
              if (showEmoji) { handleCloseMediaPanel(); return; }
              // mở đúng tab dùng lần trước (theo người); đang gõ → ẩn bàn phím cho bảng hiện đủ
              const saved = currentUser?.id ? readMediaTab(currentUser.id) : null;
              // tab nhớ là GIF nhưng GIF chưa dùng được → mở Nhãn dán
              const last = saved === "gif" && gifOn !== true ? "sticker" : saved;
              setChatPanelTab(last ?? "emoji");
              setGifHandoff(undefined);
              inputRef.current?.blur();
              setShowEmoji(true);
              setShowGifs(last === "gif");
              setAttachOpen(false);
            }}
            className={`m-cbtn m-emoji-btn ${showEmoji ? "!text-[var(--m-accent-ink)]" : ""}`}
            title={tr("Chèn biểu tượng, nhãn dán", "Insert emoji or sticker")}
            aria-label={tr("Biểu tượng cảm xúc", "Emoji")}
          >
            <Smile className="h-[22px] w-[22px]" />
          </button>
        </div>
        {/* Ô trống → micro (ghi âm); có chữ → nút gửi (đổi qua lại bằng mờ + thu phóng 140ms) */}
        <span className="m-send" data-has={hasText ? "1" : "0"}>
          <button
            type="button"
            tabIndex={hasText ? -1 : 0}
            aria-hidden={hasText}
            onClick={() => { handleCloseMediaPanel(); setRecording(true); }}
            title={tr("Ghi âm tin nhắn thoại", "Record a voice message")}
            aria-label={tr("Ghi âm", "Record voice")}
            className="m-mic"
          >
            <Mic className="h-[22px] w-[22px]" />
          </button>
          <button
            type="submit"
            tabIndex={hasText ? 0 : -1}
            aria-hidden={!hasText}
            aria-label={tr("Gửi tin nhắn", "Send message")}
            disabled={!hasText}
            onPointerDown={(e) => e.preventDefault() /* giữ bàn phím mở khi bấm Gửi */}
            className="m-send-on"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </span>
      </form>
      )}
    </div>
  );
}

export default memo(ChatComposer);
