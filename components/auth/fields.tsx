"use client";

// Shared building blocks for the auth forms (styles in components/marketing/marketing.css). One look for every
// field, toggle and submit: 48 px inputs with 16 px text and a pink focus ring, SVG flags (never emoji flags),
// one lacquer submit per form (the only glow on the page).
import React from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { tr } from "@/lib/i18n/tr";

export function AuthTitle({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <h1 className="pn-display pn-h1">{title}</h1>
      {sub ? <p className="pn-sub">{sub}</p> : null}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="pn-error" role="alert">
      <AlertCircle aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function OkBox({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pn-error" role="status" style={{ background: "rgb(52 211 153 / 0.10)", boxShadow: "inset 0 0 0 1px rgb(52 211 153 / 0.28)", color: "#a7f3d0" }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

export function Submit({ busy, children, disabled, type = "submit", onClick }: { busy?: boolean; children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} className="pn-btn pn-cta pn-cta--block">
      {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export const marketName = (m: "US" | "AU") => (m === "US" ? tr("Mỹ", "United States") : tr("Úc", "Australia"));

/** US / AU segmented toggle with SVG flags. */
export function MarketSeg({ value, onChange, label }: { value: "US" | "AU"; onChange: (m: "US" | "AU") => void; label?: string }) {
  return (
    <div className="pn-seg" role="group" aria-label={label ?? tr("Quốc gia", "Country")}>
      {(["US", "AU"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={value === m} onClick={() => onChange(m)}>
          <span aria-hidden className="inline-flex"><Flag code={m} className="h-3.5 w-5" /></span>
          {marketName(m)}
        </button>
      ))}
    </div>
  );
}

/** Static "+1" / "+61" prefix chip with the flag (the market toggle decides it). */
export function PhonePrefix({ market }: { market: "US" | "AU" }) {
  return (
    <span className="pn-prefix" aria-hidden>
      <Flag code={market} className="h-3.5 w-5" />
      {market === "US" ? "+1" : "+61"}
    </span>
  );
}

/** Country-code <select> — options read "+1 (US)" / "+61 (AU)" (a <select> cannot hold SVG flags). */
export function CountryCodeSelect({ value, onChange }: { value: "+1" | "+61"; onChange: (v: "+1" | "+61") => void }) {
  return (
    <select aria-label={tr("Mã quốc gia", "Country code")} value={value} onChange={(e) => onChange(e.target.value as "+1" | "+61")} className="pn-input" style={{ width: "auto", flex: "0 0 auto", minWidth: 128 }}>
      <option value="+1">{tr("+1 (Mỹ)", "+1 (US)")}</option>
      <option value="+61">{tr("+61 (Úc)", "+61 (AU)")}</option>
    </select>
  );
}

/** "← All account types" — above a role form's title; clears ?role. */
export function BackToRoles({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null;
  return (
    <button type="button" className="pn-back" onClick={onBack} data-back-roles>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {tr("Tất cả loại tài khoản", "All account types")}
    </button>
  );
}
