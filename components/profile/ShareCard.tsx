"use client";

import React, { useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2, Share2, Sparkles, X, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import { avatarGradient, initialsOf, isPlaceholderAvatar } from "@/lib/avatar";
import { stateName } from "@/lib/stateNames";
import { valueLabel } from "@/lib/i18n/valueLabel";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

// "Thẻ portfolio" — ảnh 1080×1350 (khổ bài đăng Facebook/Instagram) gồm mẫu
// móng đẹp nhất, tên, kỹ năng, khu vực và MÃ QR về hồ sơ PawNail. Người dùng
// đăng lên mạng xã hội = quảng cáo miễn phí cho app. Vẽ hoàn toàn trên máy
// (canvas), không gửi gì lên máy chủ.

export interface ShareCardData {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "TECHNICIAN" | "OWNER" | string;
  market: "US" | "AU";
  city?: string | null;
  state?: string | null;
  years?: number | null;
  skills?: string[];
  photos?: string[];
  openJobs?: number;
  urgent?: boolean;
}

const W = 1080;
const H = 1350;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Tải ảnh an toàn cho canvas (không làm "bẩn" canvas). Lỗi/không CORS → null. */
async function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) return null;
  try {
    let src = url;
    if (!url.startsWith("data:")) {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      src = URL.createObjectURL(await res.blob());
    }
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("img"));
      img.src = src;
    });
    return img;
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Vẽ ảnh kiểu object-fit: cover trong khung bo góc. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function renderShareCard(d: ShareCardData, profileUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const isOwner = d.role === "OWNER";

  // Nền thương hiệu: tím đêm + quầng hồng/tím
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c0b30");
  bg.addColorStop(1, "#070b18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[W, 0, 700, "rgba(236,72,153,0.30)"], [0, H, 650, "rgba(139,92,246,0.28)"]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Thương hiệu
  ctx.fillStyle = "#f9a8d4";
  ctx.font = `900 34px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("PawNail Jobs", 64, 92);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 26px ${FONT}`;
  const tag = isOwner ? tr("TIỆM ĐANG TUYỂN THỢ", "SALON NOW HIRING") : tr("PORTFOLIO THỢ NAIL", "NAIL TECH PORTFOLIO");
  ctx.textAlign = "right";
  ctx.fillText(tag, W - 64, 92);
  ctx.textAlign = "left";

  // Ảnh mẫu (tối đa 3): 1 lớn + 2 nhỏ
  const imgs = (await Promise.all((d.photos || []).slice(0, 6).map(loadImage))).filter(Boolean).slice(0, 3) as HTMLImageElement[];
  const top = 130;
  const gh = 640;
  if (imgs.length >= 3) {
    drawCover(ctx, imgs[0], 64, top, 620, gh, 36);
    drawCover(ctx, imgs[1], 704, top, 312, (gh - 20) / 2, 30);
    drawCover(ctx, imgs[2], 704, top + (gh + 20) / 2, 312, (gh - 20) / 2, 30);
  } else if (imgs.length === 2) {
    drawCover(ctx, imgs[0], 64, top, 466, gh, 36);
    drawCover(ctx, imgs[1], 550, top, 466, gh, 36);
  } else if (imgs.length === 1) {
    drawCover(ctx, imgs[0], 64, top, W - 128, gh, 36);
  } else {
    // Chưa có ảnh: khung gradient + chữ lớn
    roundRect(ctx, 64, top, W - 128, gh, 36);
    const g = ctx.createLinearGradient(64, top, W - 64, top + gh);
    g.addColorStop(0, "#db2777");
    g.addColorStop(1, "#7c3aed");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `900 120px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("💅", W / 2, top + gh / 2 + 10);
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(isOwner ? tr("Đang tuyển thợ nail", "Hiring nail techs") : tr("Thợ nail chuyên nghiệp", "Professional nail tech"), W / 2, top + gh / 2 + 90);
    ctx.textAlign = "left";
  }

  // Avatar tròn đè mép dưới khung ảnh
  const ax = 64 + 100;
  const ay = top + gh + 10;
  const ar = 92;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar + 8, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0f1e";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  const av = isPlaceholderAvatar(d.avatarUrl) ? null : await loadImage(d.avatarUrl);
  if (av) {
    const s = Math.max((ar * 2) / av.width, (ar * 2) / av.height);
    ctx.drawImage(av, ax - (av.width * s) / 2, ay - (av.height * s) / 2, av.width * s, av.height * s);
  } else {
    const [c1, c2] = avatarGradient(d.id);
    const g = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.fillStyle = "#fff";
    ctx.font = `900 64px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsOf(d.name), ax, ay + 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // Huy hiệu trạng thái cạnh avatar
  const badge = isOwner
    ? d.openJobs
      ? tr(`🔥 ${d.openJobs} vị trí đang tuyển`, `🔥 ${d.openJobs} open ${d.openJobs === 1 ? "position" : "positions"}`)
      : tr("🔥 Đang tuyển thợ", "🔥 Now hiring")
    : d.urgent
      ? tr("⚡ Sẵn sàng nhận việc ngay", "⚡ Available now")
      : tr("✨ Đang mở nhận việc", "✨ Open to work");
  ctx.font = `800 30px ${FONT}`;
  const bw = ctx.measureText(badge).width + 48;
  roundRect(ctx, ax + ar + 36, ay - 6, bw, 60, 30);
  ctx.fillStyle = "rgba(236,72,153,0.22)";
  ctx.fill();
  ctx.strokeStyle = "rgba(244,114,182,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fbcfe8";
  ctx.fillText(badge, ax + ar + 60, ay + 35);

  // Tên + khu vực
  let y = ay + ar + 86;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(fitText(ctx, d.name, W - 128 - 280), 64, y);
  y += 54;
  const where = [d.city, stateName(d.market, d.state)].filter(Boolean).join(", ");
  const roleLine = [isOwner ? tr("Chủ tiệm nail", "Nail salon") : tr("Thợ nail", "Nail tech"), where].filter(Boolean).join(" · ");
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(fitText(ctx, roleLine, W - 128 - 280), 64, y);

  // Kỹ năng dạng chip
  y += 36;
  let x = 64;
  ctx.font = `700 28px ${FONT}`;
  // Số năm kinh nghiệm là chip đầu tiên (để dòng khu vực không bị cắt chữ).
  const chips = [...(!isOwner && d.years ? [tr(`⭐ ${d.years} năm KN`, `⭐ ${d.years} yrs exp`)] : []), ...(d.skills || []).map(valueLabel)];
  for (const label of chips.slice(0, 5)) {
    const w = ctx.measureText(label).width + 40;
    if (x + w > W - 64 - 280) break;
    roundRect(ctx, x, y, w, 52, 26);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.fillStyle = "#f5d0fe";
    ctx.fillText(label, x + 20, y + 36);
    x += w + 12;
  }

  // QR về hồ sơ
  const qrSize = 236;
  const qx = W - 64 - qrSize;
  const qy = H - 64 - qrSize - 40;
  roundRect(ctx, qx - 14, qy - 14, qrSize + 28, qrSize + 28, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const qr = await loadImage(await QRCode.toDataURL(profileUrl, { margin: 0, width: qrSize, errorCorrectionLevel: "M", color: { dark: "#1c0b30", light: "#ffffff" } }));
  if (qr) ctx.drawImage(qr, qx, qy, qrSize, qrSize);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(tr("Quét để xem & nhắn tin", "Scan to view & message"), qx + qrSize / 2, qy + qrSize + 52);
  ctx.textAlign = "left";

  // Lời kêu gọi + link
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText(isOwner ? tr("Thợ giỏi ơi, nhắn tiệm mình nhé!", "Great techs — message us!") : tr("Tiệm cần thợ? Nhắn mình nhé!", "Salon hiring? Message me!"), 64, H - 160);
  ctx.fillStyle = "rgba(249,168,212,0.95)";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(fitText(ctx, profileUrl.replace(/^https?:\/\//, ""), W - 128 - qrSize - 40), 64, H - 112);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(tr("Kết nối thợ & tiệm nail Việt tại Mỹ, Úc — miễn phí", "Connecting Vietnamese nail techs & salons in the US & AU — free"), 64, H - 72);

  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("canvas"))), "image/png"));
}

export default function ShareCardButton({ data, className = "" }: { data: ShareCardData; className?: string }) {
  useTr(); // render lại khi đổi VI/EN
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${data.id}` : `https://www.bitpawos.com/profile/${data.id}`;
  const fileName = `pawnail-${data.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

  const make = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard(data, profileUrl);
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      toast.error(tr("Không tạo được thẻ, thử lại.", "Couldn't create the card, try again."));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!preview) return;
    const file = new File([preview.blob], fileName, { type: "image/png" });
    const text = data.role === "OWNER" ? tr("Tiệm mình đang tuyển thợ — xem & nhắn trên PawNail:", "We're hiring — see us & message on PawNail:") : tr("Portfolio của mình trên PawNail — tiệm cần thợ nhắn mình nhé:", "My portfolio on PawNail — salons, message me:");
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${profileUrl}` });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
    download();
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(tr("Đã lưu ảnh — đăng lên Facebook, Instagram, TikTok nhé!", "Image saved — post it on Facebook, Instagram, TikTok!"));
  };

  const close = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={make}
        disabled={busy}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600/90 to-pink-600/90 px-4 text-sm font-bold text-white shadow-lg shadow-fuchsia-600/20 transition-all hover:brightness-110 disabled:opacity-60 ${className}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {tr("Tạo thẻ chia sẻ", "Create share card")}
      </button>
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={close}>
          <div role="dialog" aria-label={tr("Thẻ chia sẻ", "Share card")} className="flex max-h-full w-full max-w-sm flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white">{tr("Thẻ portfolio của bạn", "Your portfolio card")}</p>
              <button type="button" onClick={close} aria-label={tr("Đóng", "Close")} className="rounded-full p-1.5 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt={tr("Thẻ portfolio", "Portfolio card")} className="max-h-[62vh] w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10" />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={share} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-sm font-black text-white"><Share2 className="h-4 w-4" />{tr(" Chia sẻ", " Share")}</button>
              <button type="button" onClick={download} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white/[0.08] text-sm font-bold text-white ring-1 ring-white/10"><Download className="h-4 w-4" />{tr(" Lưu ảnh", " Save image")}</button>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(profileUrl).then(() => toast.success(tr("Đã sao chép link hồ sơ", "Profile link copied")))}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              <Link2 className="h-3.5 w-3.5" /> {tr("Sao chép link hồ sơ", "Copy profile link")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
