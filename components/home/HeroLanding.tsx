"use client";

// Landing hero for guests ("/" not signed in). Left: H1 (Fraunces, one foil run) · lede · primary CTA (the only
// glow on the page) + ghost · audience links · trust row. Right (≥ 1024): the 3D lacquer stack with the season
// layer; < 1024 the photo strip sits between the audience links and the trust row. No eyebrow pill, no role
// cards, no live counters, no entrance animation on text (LCP-safe). Copy: sentence case, EN + VI via tr().
import "@/components/marketing/marketing.css";
import React from "react";
import Link from "next/link";
import { fraunces } from "@/lib/fonts";
import HeroLacquerStack from "@/components/home/HeroLacquerStack";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";

export default function HeroLanding({ onExploreJobs, className = "" }: { onExploreJobs: () => void; className?: string }) {
  useTr();
  return (
    <section data-hero className={`pn-hero ${fraunces.variable} ${className}`} aria-labelledby="hero-title">
      <div className="pn-hero-in">
        <div className="pn-hero-copy">
          <h1 id="hero-title" data-hero-title className="pn-display pn-hero-h1">
            {tr("Nền tảng cho", "The platform for")}
            <br />
            <span className="pn-foil">{tr("ngành nail", "the nail industry")}</span>
          </h1>
          <p className="pn-hero-lede">
            {tr(
              "Thử mẫu và đặt lịch. Tìm nơi làm phù hợp. Tuyển thợ cho tiệm. PawNail kết nối khách, thợ nail và chủ tiệm trên khắp nước Mỹ và Úc.",
              "Try on a look and book it. Find your next chair. Hire your next tech. PawNail brings nail clients, technicians and salons together across the US and Australia.",
            )}
          </p>
          <div className="pn-hero-ctas">
            <Link href="/tryon" className="pn-btn pn-cta" data-hero-cta="client">
              {tr("Thử mẫu trên tay", "Try on nail looks")}
            </Link>
            <Link href="/salons" className="pn-btn pn-ghost">
              {tr("Tìm tiệm", "Find a salon")}
            </Link>
          </div>
          <p className="pn-hero-aud">
            <span>
              {tr("Thợ nail? ", "Nail tech? ")}
              <a
                href="/?tab=jobs"
                className="pn-link"
                data-hero-cta="tech"
                onClick={(e) => {
                  e.preventDefault();
                  onExploreJobs();
                }}
              >
                {tr("Xem việc làm", "Explore jobs")}
              </a>
            </span>
            <span>
              {tr("Chủ tiệm? ", "Salon owner? ")}
              <Link href="/auth/register?role=owner" className="pn-link" data-hero-cta="owner">
                {tr("Tuyển thợ", "Hire techs")}
              </Link>
            </span>
          </p>
          <ul className="pn-hero-trust pn-dots" role="list">
            <li>{tr("Không thu phí thợ và tiệm", "No fees for techs or salons")}</li>
            <li>{tr("Có tiếng Anh và tiếng Việt", "English and Tiếng Việt")}</li>
            <li>{tr("Thử mẫu chạy ngay trên điện thoại", "Try-On runs on your phone")}</li>
          </ul>
        </div>
        <HeroLacquerStack />
      </div>
    </section>
  );
}
