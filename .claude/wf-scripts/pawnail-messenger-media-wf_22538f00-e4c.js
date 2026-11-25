export const meta = {
  name: 'pawnail-messenger-media',
  description: 'Messenger stickers, GIFs and changeable wallpapers: audit what is broken/missing live, add rich openly-licensed sticker packs from GitHub sources, fix GIF search, premium wallpaper picker incl. custom photo; implement, review, fix',
  phases: [
    { title: 'Audit', detail: 'live + code audit of stickers, GIFs, wallpapers; licensed source research' },
    { title: 'Implement', detail: 'worktree implementation with screenshots' },
    { title: 'Review', detail: 'messenger UX reviewer + licence/code reviewer' },
    { title: 'Fix', detail: 'apply must-fix items' },
  ],
}
const A = args
const CTX = `PawNail (repo ${A.repo}, main LIVE at www.bitpawos.com): Next.js 16 App Router (EN-first routes under app/[lang]/), Tailwind v4, in-app 'warm luxe dark' v2 messenger (components/chat/* incl. MessagesContent.tsx, MessageRow.tsx, messenger.css, GifPicker.tsx, MediaPicker.tsx, ChatModals.tsx; lib/chatStickers.ts (Noto Emoji Animation, CC BY 4.0, from fonts.gstatic.com), lib/chatWallpapers.ts (wallpaper ids + REFINED wash map), lib/chatReactions.ts; NOTICE file). The app also ships as an Android WebView (Capacitor) loading the live site.
OWNER REPORT (2026-11-07): 'stickers and GIFs in messages are still broken and missing a lot' (he wants a rich sticker experience like Telegram, sourced from GitHub), and 'the chat background should be changeable'.
RULES: do NOT copy Telegram's (or any app's) proprietary stickers/icons/brand; use only openly licensed sets with compliant attribution in NOTICE (e.g. Google Noto Emoji / Noto Animated Emoji (CC BY 4.0 / Apache 2.0 / OFL as applicable), Microsoft Fluent Emoji (MIT, github.com/microsoft/fluentui-emoji, loadable from jsDelivr), OpenMoji (CC BY-SA 4.0), Twemoji graphics (CC BY 4.0)) — check each licence yourself; prefer CDN delivery (jsDelivr for GitHub repos, gstatic for Noto) with sensible caching, lazy loading and small payloads; GIF search must use a legitimate API (GIPHY or Tenor with the existing env key if valid — test the key read-only from the browser bundle/env name; if missing/invalid, implement a graceful fallback and tell the owner exactly which key to add on Vercel); never write to production; never copy .env into a worktree; local runs use a throwaway build copy with a local SQLite demo DB like ${A.shots}/scripts/store/serve_local.sh (TURSO_DATABASE_URL="" pinned) and ${A.shots}/scripts/store/ux_audit2.mjs for screenshots; kill only processes you start; commit often in your worktree with messages ending "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; do not push; copy changes bilingual via tr(); no fake data. Final message is machine-read.`
const AUD = { type: 'object', properties: { findings: { type: 'array', items: { type: 'string' } }, spec: { type: 'string' } }, required: ['findings', 'spec'] }
phase('Audit')
const audit = await agent(`${CTX}

Audit live (read-only: open https://www.bitpawos.com in a headless browser where possible and fetch the sticker/GIF asset URLs the code builds) and in code: which sticker URLs 404 or load slowly, which packs are thin or off-season (e.g. Halloween leftovers), whether the sticker/GIF pickers open, scroll, search and send correctly on a 412px Android-like viewport, whether sent stickers/GIFs render in bubbles and in the conversation list preview, whether the GIF API key works, and whether users can change the chat wallpaper (where is the picker, is it discoverable, does it persist, does it apply per chat / all chats). Then write an exact spec: a Telegram-quality sticker panel (tabs: recent, favourites, emoji stickers, 3D Fluent packs grouped by theme incl. nail/beauty/salon/celebrate/love/thanks/work, seasonal packs by market), animated where licensed sources allow, search by keyword in EN and VI, recents + favourites stored per user on device, fast grid; a robust GIF panel (trending + search, safe-search on, attribution 'Powered by GIPHY/Tenor'); and a wallpaper picker reachable from the chat header menu with 10-16 premium options (calm solids, subtle patterns, soft photographic gradients made in CSS or small local assets) + 'Use my own photo' (stored on device, resized, never uploaded) + 'Apply to all chats' + live preview, legible bubbles on every wallpaper (AA).`, { label: 'audit', phase: 'Audit', schema: AUD })
phase('Implement')
const IMPL = { type: 'object', properties: { branch: { type: 'string' }, worktree: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' }, shots: { type: 'string' }, ownerSetup: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['branch', 'worktree', 'commits', 'checks', 'shots', 'ownerSetup', 'notes'] }
const impl = audit ? await agent(`${CTX}

Create a worktree of ${A.repo} from current main on branch messenger-media and implement this spec completely: ${JSON.stringify(audit)}
Verify: tsc --noEmit; next build --webpack in a throwaway build copy; i18n checks (scripts/i18n/check-dict-parity.mjs, check-eager.mjs); screenshots at 412x860 of the sticker panel (each tab), GIF panel (trending + a search), wallpaper picker, and a conversation on 4 different wallpapers incl. a custom photo, EN and VI, into ${A.out}. Report, including any key the owner must add on Vercel.`, { label: 'implement', phase: 'Implement', schema: IMPL }) : null
phase('Review')
const REV = { type: 'object', properties: { mustFix: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } }, required: ['mustFix', 'verdict'] }
const reviews = impl ? (await parallel([
  () => agent(`${CTX}

You are a messaging-product lead who shipped stickers/GIFs at scale. Review the screenshots in ${impl.shots} and the running behaviour if you can: is it as smooth, rich and polished as Telegram/iMessage (without copying them)? Speed, grid density, tap targets, search quality, recents/favourites, send/render in bubbles and previews, wallpaper legibility and picker UX, custom photo flow. Must-fix with exact fixes.`, { label: 'review:ux', phase: 'Review', schema: REV }),
  () => agent(`${CTX}

You are a licence + code reviewer. Review branch ${impl.branch} (worktree ${impl.worktree}): every sticker/emoji source's licence and the NOTICE text, CDN URLs pinned to versions, no proprietary assets, GIF API terms and attribution, privacy of the custom wallpaper (never uploaded), performance (lazy loading, no layout jank), regressions in the v2 messenger. Must-fix only for real problems.`, { label: 'review:licence-code', phase: 'Review', schema: REV }),
])).filter(Boolean) : []
phase('Fix')
const fix = impl && reviews.some((r) => r.mustFix.length) ? await agent(`${CTX}

Continue in worktree ${impl.worktree} (branch ${impl.branch}). CONTINUATION: a previous fix agent was cut off by a usage limit; its work is committed in this worktree (latest commits on the branch). Read git log/diff main..HEAD first, keep that work, finish only the remaining must-fix items, and commit WIP often. Apply every must-fix item: ${JSON.stringify(reviews)}. Re-run checks, re-capture affected screenshots, commit, report.`, { label: 'fix', phase: 'Fix', schema: IMPL }) : null
return { audit, impl, reviews, fix }