# Bug Report: Root route (`/`) returns 307 redirect for RSC navigation requests only, while document requests return 200 with correct content

## Summary

On our production deployment, the root route `/` behaves correctly for normal document (full page load) requests, but returns an unexpected `307` redirect to `/auth/register` when requested using Next.js's client-side RSC navigation request format (the `RSC: 1` header Next.js's router sends for soft/client-side navigations). This causes logged-in users to be sent to the wrong page immediately after a successful login.

This is **fully reproducible on the Vercel deployment** and **not reproducible locally** running the identical build output via `next start`.

## Environment

- **Project**: pawbook-web (Vercel)
- **Domain**: bitpawos.com (canonical: `www.bitpawos.com`, apex redirects 308 → www)
- **Framework**: Next.js 16.2.10, App Router
- **Auth**: NextAuth.js v4.24.14, `CredentialsProvider`, `session.strategy: "jwt"`, `PrismaAdapter` also configured (reserved for future OAuth, not currently used by the credentials flow)
- **Route in question**: `app/page.tsx` — a `"use client"` component, no server-side data fetching, no route segment config (`dynamic`/`revalidate`)
- **No `middleware.ts`** exists anywhere in the project
- **No Cloudflare Page Rules / Redirect Rules / Transform Rules are active** on the zone (confirmed 0 configured rules, checked via Cloudflare dashboard)
- **No `redirects()`/`rewrites()`** configured in `next.config.ts`

## Steps to reproduce

1. Log in with valid credentials against `/api/auth/[...nextauth]` (Credentials provider). Confirm session is valid via `GET /api/auth/session` — it correctly returns the full user object.
2. From a browser, navigate to `/` (either via `router.push("/")` client-side, or a fresh hard navigation `page.goto("https://www.bitpawos.com/")`).
3. Observe: the browser ends up on `/auth/register` instead of `/`.

## Isolating the exact trigger (RSC vs document request)

We captured the browser's `history.replaceState` calls via `addInitScript` and got this stack trace, confirming Next.js's own client router is issuing the navigation after receiving some response from the server:

```
Error
    at history.replaceState (<anonymous>)
    at History.<anonymous> (chunks/6155-*.js)
    at window.history.replaceState (chunks/6155-*.js)
    at iw (chunks/4bd1b696-*.js)   // React/Next internals
    at uu/uo (chunks/4bd1b696-*.js)   // Next.js router reducer (repeated recursive calls)
    ...
    at MessagePort.j (chunks/6155-*.js)
```

We then isolated the exact difference between a working request and a failing one, using the **same session cookie** for both:

**A) Plain document/fetch request (works correctly):**
```bash
curl 'https://www.bitpawos.com/' -H 'Cookie: <valid-session-cookie>'
# → HTTP 200
# → <title>PawNail Jobs — Việc Làm & Tay Nghề Nail US/AU</title>
# → correct homepage content
```

**B) RSC-format request, mimicking exactly what Next.js's client router sends for a soft navigation (fails):**
```bash
curl 'https://www.bitpawos.com/' \
  -H 'Cookie: <same-valid-session-cookie>' \
  -H 'RSC: 1' \
  -H 'Accept: text/x-component'
# → HTTP 307
# → Location: /auth/register
# → Body: "Redirecting..."
```

This is the crux of the bug: **identical URL, identical cookie/session — the only difference is the request being an RSC navigation fetch vs. a normal document request** — and only the RSC-format request gets redirected.

## What we've ruled out

- **App code**: exhaustively grepped the entire codebase for `router.push`, `router.replace`, `redirect()` (from `next/navigation`), and `window.location` assignments outside of explicit user-triggered `onClick` handlers. Nothing auto-redirects to `/auth/register` on mount of `/`.
- **`middleware.ts`**: does not exist anywhere in the project (verified via direct file read and glob search).
- **NextAuth `pages.newUser`**: we had this configured (a common gotcha with `PrismaAdapter` + `CredentialsProvider`, since Credentials sign-in never links an `Account` row, so NextAuth can treat every sign-in as "new"). We removed this config entirely, redeployed, confirmed the deploy was `Ready` — **the bug persisted identically**.
- **Cloudflare**: zone has 0 active Page Rules and 0 active Redirect/Transform Rules (checked in dashboard: "Page Rules — You have used 0 out of 3 available Page Rules", and Rules → Overview shows only the template gallery, no active custom rules). Bot Fight Mode, Under Attack Mode are both off.
- **Client-side cache / router cache / Service Worker**: reproduced with `serviceWorkers: 'block'` in a fresh Playwright browser context, and separately with a completely pristine browser context that **never visited the domain before** (session cookie injected directly via `context.addCookies()`, then a single `page.goto("https://www.bitpawos.com/")`) — bug still occurs on the very first navigation.
- **Vercel build cache**: triggered a manual "Redeploy" with "Use existing Build Cache" turned OFF — bug persisted identically afterward.
- **Route segment config**: added `export const dynamic = "force-dynamic"` to `app/page.tsx` (matching the pattern used successfully on `app/messages/page.tsx`, which correctly does a server-side `redirect()` when unauthenticated). Local build output still marked `/` as static (`○`) even with this export present (expected, since the page is a pure Client Component with no server data fetching for Next.js to treat as dynamic). Deployed anyway to test empirically on Vercel — **no change in behavior**.
- **Local reproduction**: running the exact same build output (`npm run build && npm start`) locally, using the identical methodology (pristine context + injected cookie + `goto("http://localhost:3000/")`), the bug **does not occur** — `/` loads correctly every time.

## Why this matters

Since our root route is a Client Component with no server-side redirect logic, and the only difference between the working and failing case is the RSC-vs-document request format, this strongly suggests something in how our Vercel deployment's routing/RSC-serving layer for this specific project is producing a redirect response for this route only for RSC payload requests. We are not able to inspect Vercel's internal function logs deeply enough to see why a 307 with `Location: /auth/register` is being generated for this specific request shape.

## What we'd like help with

1. Please check the function/edge logs for `GET /` requests carrying the `RSC: 1` header on our project, around the timestamps in the attached test logs, to see what internal logic is producing the 307.
2. Confirm whether there is any platform-level behavior (routing manifest resolution, RSC payload caching, or Next.js 16 + Vercel adapter interaction) that could cause a client-navigation-only redirect for a route like ours (root `/`, Client Component, session-aware via a custom fetch-based context rather than `next-auth`'s built-in `<SessionProvider>`).
3. If this is a known Next.js 16 / Vercel Next.js runtime issue, please point us to any relevant tracking issue or workaround.

## Current mitigation on our side

As a stopgap, we've:
- Switched the post-login redirect to use `window.location.href = "/"` (a hard navigation / document request) instead of `router.push()`, since document requests are always correct.
- Added a client-side guard on `/auth/register` and `/auth/login` that detects an already-valid session and force-redirects back to `/` via `window.location.replace("/")`, with a 5-second cooldown (via `sessionStorage`) to prevent an infinite redirect loop in case `/` itself intermittently exhibits the same RSC-redirect behavior.

This keeps the app usable and safe (no infinite loop), but users still sometimes briefly see the wrong page after logging in, which we'd like to fully resolve.

Happy to provide additional logs, HAR files, or a minimal reproduction repo if useful.
