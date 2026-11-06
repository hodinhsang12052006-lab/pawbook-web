"use client";

// Footer for guests on the landing (all widths). Members keep the slim desktop footer in HomePage.
import "@/components/marketing/marketing.css";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function SiteFooter() {
  useTr();
  const links: [string, string][] = [
    [tr("Thử mẫu", "Try-On"), "/tryon"],
    [tr("Mẫu nail", "Designs"), "/designs"],
    [tr("Tiệm nail", "Salons"), "/salons"],
    [tr("Việc làm", "Jobs"), "/?tab=jobs"],
    [tr("Hỗ trợ", "Support"), "/support"],
    [tr("Điều khoản", "Terms"), "/terms"],
    [tr("Quyền riêng tư", "Privacy"), "/privacy"],
  ];
  return (
    <footer className="pn-foot" data-site-footer>
      <div className="pn-foot-in">
        <div className="pn-foot-top">
          <div className="pn-foot-brand">
            <span className="pn-foot-logo">
              <Image src="/cho1.jpg" alt="" fill sizes="28px" className="object-cover" />
            </span>
            <span className="pn-foot-name">PawNail</span>
            <span className="pn-foot-tag">{tr("Nền tảng cho ngành nail tại Mỹ và Úc.", "The platform for the nail industry in the US and Australia.")}</span>
          </div>
          <nav aria-label={tr("Liên kết cuối trang", "Footer")}>
            <ul className="pn-foot-links" role="list">
              {links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="pn-foot-copy">© 2026 PawNail</p>
      </div>
    </footer>
  );
}
