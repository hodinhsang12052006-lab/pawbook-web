"use client";

// Shared building blocks for the auth forms (styles in components/auth/auth.css). One look for every field, toggle
// and submit across login, client / technician / owner sign-up: 48 px inputs with 16 px text, a leading icon on
// every text input, a pink focus ring, City then State (typing a city fills the state), ONE phone control
// (SVG flag + country code chip that follows the US / AU toggle — never emoji flags, never a "+1 (US)" select),
// one lacquer submit per form (the only glow on the page) and the same "Already have an account? Log in" line.
import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MapPin, type LucideIcon } from "lucide-react";
import Flag from "@/components/ui/Flag";
import { tr } from "@/lib/i18n/tr";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { stateName } from "@/lib/stateNames";
import { guessState } from "@/lib/cityState";

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

/** Text input with its leading icon (every text input on the auth forms has one). */
export function IconInput({ icon: Icon, className = "", ...props }: { icon: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="pn-field-icon">
      <Icon aria-hidden />
      <input {...props} className={`pn-input ${className}`} />
    </div>
  );
}

/** Phone number: flag + country-code chip (decided by the market toggle) + national number. */
export function PhoneField({ id, market, value, onChange, label, optional }: { id: string; market: "US" | "AU"; value: string; onChange: (v: string) => void; label: React.ReactNode; optional?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div>
      <label htmlFor={id} className="pn-label">{label}{optional ? <> <span className="pn-opt">{optional}</span></> : null}</label>
      <div className="flex items-center gap-2">
        <PhonePrefix market={market} />
        <input
          id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={market === "AU" ? t("auth.common.phonePlaceholderAU") : t("auth.common.phonePlaceholder")}
          className="pn-input" aria-describedby={`${id}-cc`}
        />
        <span id={`${id}-cc`} className="sr-only">{market === "US" ? tr("Mã vùng +1 (Mỹ)", "Country code +1 (US)") : tr("Mã vùng +61 (Úc)", "Country code +61 (Australia)")}</span>
      </div>
    </div>
  );
}

/** City (leading pin) then State. Typing a known city fills the state; an empty state shows a muted "Select state". */
export function CityStateFields({ idPrefix, market, city, onCity, state, onState, states }: {
  idPrefix: string; market: "US" | "AU"; city: string; onCity: (v: string) => void; state: string; onState: (v: string) => void; states: readonly string[];
}) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-city`} className="pn-label">{t("auth.common.cityLabel")}</label>
        <IconInput
          icon={MapPin} id={`${idPrefix}-city`} autoComplete="address-level2" value={city}
          onChange={(e) => { onCity(e.target.value); const g = guessState(market, e.target.value); if (g && states.includes(g)) onState(g); }}
          placeholder={market === "AU" ? t("auth.common.cityPlaceholderAU") : t("auth.common.cityPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-state`} className="pn-label">{t("auth.common.stateLabel")}</label>
        <select id={`${idPrefix}-state`} value={state} onChange={(e) => onState(e.target.value)} className="pn-input" data-empty={state ? undefined : ""}>
          <option value="">{t("auth.common.statePlaceholder")}</option>
          {states.map((s) => <option key={s} value={s}>{stateName(market, s)}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Thin segmented progress (sign-up steps, owner survey). */
export function StepBar({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="pn-progress pn-progress--steps" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={label}>
      {Array.from({ length: total }, (_, i) => <span key={i} data-on={i < current ? "" : undefined} />)}
    </div>
  );
}

/** "Already have an account? Log in" — identical on every sign-up form. */
export function HaveAccount() {
  const { t } = useLanguage();
  return (
    <p className="pn-muted pn-center">
      {t("auth.common.alreadyHaveAccount")}{" "}
      <Link href="/auth/login" className="pn-a">{t("auth.common.loginNow")}</Link>
    </p>
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
