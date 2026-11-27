import type { Metadata } from "next";
import Link from "next/link";
import { langFrom, pageMetadata } from "@/lib/i18n/server";
import Navbar from "@/components/layout/Navbar";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pageMetadata(await langFrom(params), "/android-beta", {
    title: ["Thử app PawNail trên Android", "Test the PawNail Android app"],
    description: [
      "Tham gia bản thử app PawNail trên Google Play: 3 bước, miễn phí.",
      "Join the PawNail Android beta on Google Play: 3 steps, free.",
    ],
  });
}

// Google Play bắt tài khoản nhà phát triển mới chạy thử nghiệm khép kín với ≥ 12 người thật trong 14 ngày trước khi
// lên kênh công khai. Người thử vào qua Nhóm Google (ai cũng tham gia được) → chọn tham gia trên Play → cài app.
const GROUP = "https://groups.google.com/g/pawnail-testers";
const OPT_IN = "https://play.google.com/apps/testing/com.bitpawos.app";
const STORE = "https://play.google.com/store/apps/details?id=com.bitpawos.app";
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bitpawsoftware.com";

const btn = "flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-sm font-bold text-white";
const btn2 = "flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-inset ring-white/10";

type Copy = { h1: string; lead: string; steps: { t: string; d: string; href: string; cta: string; primary?: boolean }[]; note: string; help: string };
const COPY: Record<"vi" | "en", Copy> = {
  vi: {
    h1: "Thử app PawNail trên Android",
    lead: "PawNail đang thử nghiệm trên Google Play trước khi mở cho mọi người. Bạn giúp tụi mình bằng cách cài bản thử và giữ app trong máy 14 ngày (mở vài lần là đủ). Miễn phí, dùng tài khoản Gmail bạn đang đăng nhập trên điện thoại.",
    steps: [
      { t: "1. Tham gia nhóm người thử", d: "Mở bằng tài khoản Gmail trên điện thoại, bấm \"Tham gia nhóm\".", href: GROUP, cta: "Tham gia nhóm PawNail Testers", primary: true },
      { t: "2. Đồng ý làm người thử", d: "Bấm \"Trở thành người thử nghiệm\" (Become a tester).", href: OPT_IN, cta: "Mở trang tham gia trên Google Play" },
      { t: "3. Cài app", d: "Cài PawNail từ Google Play như app bình thường, đăng nhập và dùng thử.", href: STORE, cta: "Cài PawNail trên Google Play" },
    ],
    note: "Bước 2 báo không tìm thấy? Đợi 1–2 phút sau bước 1 rồi mở lại. Phải dùng cùng một tài khoản Gmail ở cả 3 bước.",
    help: "Cần giúp? Email",
  },
  en: {
    h1: "Test the PawNail Android app",
    lead: "PawNail is in testing on Google Play before it opens to everyone. Help us by installing the test version and keeping it on your phone for 14 days (opening it a few times is enough). Free, with the Google account you already use on your phone.",
    steps: [
      { t: "1. Join the tester group", d: "Open it with the Google account on your phone and tap \"Join group\".", href: GROUP, cta: "Join PawNail Testers", primary: true },
      { t: "2. Become a tester", d: "Tap \"Become a tester\".", href: OPT_IN, cta: "Open the Google Play test page" },
      { t: "3. Install the app", d: "Install PawNail from Google Play like any app, sign in and try it.", href: STORE, cta: "Get PawNail on Google Play" },
    ],
    note: "Step 2 says the app isn't found? Wait a minute or two after step 1 and open it again. Use the same Google account in all three steps.",
    help: "Need help? Email",
  },
};

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langFrom(params);
  const c = COPY[lang === "vi" ? "vi" : "en"];
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10 pb-24 text-sm leading-relaxed text-slate-300 md:pb-10">
        <h1 className="text-2xl font-black text-white">{c.h1}</h1>
        <p>{c.lead}</p>
        <ol className="space-y-4">
          {c.steps.map((s) => (
            <li key={s.t} className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="font-bold text-white">{s.t}</p>
              <p>{s.d}</p>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className={s.primary ? btn : btn2}>{s.cta}</a>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-400">{c.note}</p>
        <p className="text-xs text-slate-400">
          {c.help} <a href={`mailto:${SUPPORT}?subject=PawNail%20Android%20beta`} className="text-pink-300 underline">{SUPPORT}</a>
        </p>
        {lang === "en" && (
          <p className="text-xs text-slate-500">
            <Link href="/vi/android-beta" hrefLang="vi" lang="vi" className="text-pink-300 underline">Tiếng Việt</Link>
          </p>
        )}
      </main>
    </div>
  );
}
