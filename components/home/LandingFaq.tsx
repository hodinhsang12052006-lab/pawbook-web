"use client";

// Guest FAQ on the landing Discover tab (moved here from the register role picker). Native <details>: works
// without JS, keyboard + screen-reader friendly. Copy lives in the dictionaries (auth.rolePicker.faq*).
import "@/components/marketing/marketing.css";
import React from "react";
import { ChevronDown } from "lucide-react";
import { fraunces } from "@/lib/fonts";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function LandingFaq() {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="faq" className={`pn-faq ${fraunces.variable}`}>
      <h2 id="faq" className="pn-display pn-faq-h2">{t("auth.rolePicker.faqTitle")}</h2>
      <div className="pn-list">
        {[1, 2, 3, 4].map((n) => (
          <details key={n}>
            <summary>
              {t(`auth.rolePicker.faq${n}Q`)}
              <ChevronDown aria-hidden />
            </summary>
            <p>{t(`auth.rolePicker.faq${n}A`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
