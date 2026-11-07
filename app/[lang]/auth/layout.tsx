"use client";

// Auth shell (/auth/*): ONE continuous stage backdrop (the fixed .app-backdrop with html[data-surface="auth"]) —
// both columns are transparent, no seam, no glass card, no blobs, no sparkles, no theme toggle (dark only).
// ≥ 1024: sticky brand panel (logo · 2-card photo plate · tagline with one foil run · facts) + form column.
// < 1024: calm 56 px header + form. The form title is the page's only <h1>; 0 infinite animations.
import "@/components/marketing/marketing.css";
import "@/components/auth/auth.css";
import React from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import Link from "next/link";
import { fraunces } from "@/lib/fonts";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { tr } from "@/lib/i18n/tr";
import LanguageToggle from "@/components/layout/LanguageToggle";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthPhotoStage from "@/components/auth/AuthPhotoStage";
import LanguageHints from "@/components/i18n/LanguageHints";

// Bảng thương hiệu chỉ nói điều kiểm chứng được (thử mẫu chạy trên máy, không thu phí thợ/tiệm, hai ngôn ngữ).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className={`pn-auth ${fraunces.variable}`}>
      <div className="pn-auth-grid">
        <aside className="pn-auth-panel" aria-label="PawNail">
          <Link href="/" className="pn-auth-brand">
            <span className="pn-auth-logo">
              <BrandLogo size={36} />
            </span>
            <span className="pn-wordmark">PawNail</span>
          </Link>
          {/* DOM order brand → copy → stage (grid rows place the stage in the middle row): with streamed HTML the
              copy is already laid out in its bottom row when the stage arrives, so the plate never jumps up. */}
          <div className="pn-auth-copy">
            <p className="pn-display pn-tagline">
              {t("auth.brand.tagline1")}
              <br />
              <span className="pn-foil">{t("auth.brand.tagline2")}</span>
            </p>
            <p className="pn-auth-desc">{t("auth.brand.description")}</p>
            <ul className="pn-auth-trust pn-dots" role="list">
              <li>{t("auth.brand.trustBadge1")}</li>
              <li>{t("auth.brand.trustBadge2")}</li>
              <li>{t("auth.brand.trustBadge3")}</li>
            </ul>
          </div>
          <div className="pn-auth-stagewrap">
            <AuthPhotoStage />
          </div>
        </aside>

        <main id="main" className="pn-auth-main">
          <AuthHeader />
          <div className="pn-auth-top">
            <LanguageToggle />
          </div>
          <div className="pn-auth-form">{children}</div>
          {/* Gợi ý ngôn ngữ trong luồng, sau form — không bao giờ đè nút / ô nhập (components/i18n/LanguageHints.tsx). */}
          <LanguageHints placement="auth" />
          <footer className="pn-auth-foot">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" role="list">
              <li>© 2026 PawNail</li>
              <li><Link href="/terms">{tr("Điều khoản", "Terms")}</Link></li>
              <li><Link href="/privacy">{tr("Quyền riêng tư", "Privacy")}</Link></li>
              <li><Link href="/support">{tr("Hỗ trợ", "Support")}</Link></li>
            </ul>
          </footer>
        </main>
      </div>
    </div>
  );
}
