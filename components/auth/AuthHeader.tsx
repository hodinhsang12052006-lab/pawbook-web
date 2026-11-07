"use client";

// /auth/* on phones: a calm 56 px bar (+ safe area) — logo + wordmark home link, language toggle. No band, no
// gradient, no flags, no tagline, not sticky. The form title below stays the page's only <h1>.
import React from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import Link from "next/link";
import LanguageToggle from "@/components/layout/LanguageToggle";

export default function AuthHeader() {
  return (
    <div className="pn-auth-hdr">
      {/* prefetch={false} (như Navbar): prefetch "/" kéo CSS hero mùa của trang chủ về → Chrome báo "preloaded but not
          used", tốn băng thông lúc điện thoại chậm đang tải form. */}
      <Link href="/" prefetch={false} className="pn-auth-brand" aria-label="PawNail">
        <span className="pn-auth-logo">
          <BrandLogo size={32} />
        </span>
        <span className="pn-wordmark" aria-hidden>PawNail</span>
      </Link>
      <LanguageToggle />
    </div>
  );
}
