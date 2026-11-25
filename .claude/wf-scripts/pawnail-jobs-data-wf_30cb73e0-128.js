export const meta = {
  name: 'pawnail-jobs-data',
  description: 'Diagnose thin job/feature data on PawNail, research compliant job-feed APIs for US/AU nail jobs, build a licensed partner job source + honest empty-state fixes, review for ToS/honesty and code quality, fix',
  phases: [
    { title: 'Audit', detail: 'ingest pipeline review, thin-data audit of every feature, compliant job source research' },
    { title: 'Build', detail: 'partner job source connector + cron + attribution + empty-state fixes in a worktree' },
    { title: 'Review', detail: 'ToS/honesty reviewer and code reviewer' },
    { title: 'Fix', detail: 'apply must-fix' },
  ],
}
const A = args
const CTX = `PawNail (repo ${A.repo}; Next.js 16 + Prisma on Turso; live at www.bitpawos.com; the main checkout's .env points at the PRODUCTION DB — never write to production, never copy .env into a worktree, tsx scripts must run with env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN against local SQLite only). It is a professional platform for the nail industry in the US and Australia; its jobs board is the core value for nail techs and salon owners.
FACTS MEASURED TODAY (read-only): public GET /api/jobs?market=US returns only 3 jobs (2 aggregated 'ingest' posts, 1 salon self-post), AU returns 0. The ingest gateway (app/api/ingest/jobs/route.ts, lib/jobIngest/*) receives posts from the owner's external Facebook-group filtering tool; its stats show 4 active and 57 expired aggregated jobs in total, nothing recent — that external tool stopped sending. We will NOT scrape Facebook groups or any site against its terms, and will not run the owner's scraper (decided earlier; ToS and account risk).
RULES: no fake jobs, fake salons, fake users or fake counts; every external listing must be real, attributed to its source with a link back, respect the provider's API terms (attribution, caching limits, no phone-number harvesting, no republishing beyond what the terms allow), expire automatically, be clearly labelled (e.g. 'via <provider>'), and never be shown as if posted by a salon on PawNail; production contact only via read-only public GETs; no secrets in logs; commit in your worktree often (messages end with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"); do not push. Final message is machine-read.`
const AUD = { type: 'object', properties: { findings: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, spec: { type: 'string' } }, required: ['findings', 'recommendation', 'spec'] }
phase('Audit')
const [pipe, thin, sources] = await parallel([
  () => agent(`${CTX}

Review the job ingest pipeline and job display code (lib/jobIngest/ingest.ts, parse.ts, display.ts, app/api/ingest/jobs, app/api/admin/ingest, app/api/jobs, components/jobs/*, quality guards and anti-spam caps): would good posts be rejected or hidden by over-strict filters (job-seeker/ad/sale filters, TTL, phone rules, market/state inference, realOnly owner filter)? Is there any other reason the board looks empty (e.g. default filters, state filter, market detection, expiry)? Also review the admin 'Đăng hộ tiệm' (post on behalf of a salon) tool path. Concrete findings with file:line and fixes.`, { label: 'audit:pipeline', phase: 'Audit', schema: AUD }),
  () => agent(`${CTX}

Audit every user-facing feature for thin or empty data as a NEW visitor in the US and in AU, using only read-only public GETs against https://www.bitpawos.com (list the public API routes from app/api and call the GET ones that need no auth) plus reading the code: jobs, find techs, salon menus, supply exchange, trends/Nail Radar, designs, feed, notifications for a new user, profiles. For each: how much real data exists, what a new user sees, and an honest way to make it feel useful (real aggregated data with attribution, official PawNail content, better empty states with CTAs, cross-market fallbacks, alerts) — never fake data.`, { label: 'audit:thin-data', phase: 'Audit', schema: AUD }),
  () => agent(`${CTX}

Research legitimate job data sources that can supply real nail-technician / nail-salon job listings for the United States AND Australia to a third-party job board: e.g. Adzuna API, Careerjet API, Jooble API, Indeed/ZipRecruiter/Seek partner programs, Google for Jobs, government job feeds. Use web search and the providers' official docs and terms. For each: coverage of nail jobs in US and AU (try their public search pages to estimate volume for 'nail technician' / 'nail tech' / 'manicurist'), signup requirements, cost, rate limits, display/attribution/caching terms, whether showing salary/location/description snippets and linking out is allowed. Recommend the best one or two and specify exactly how to integrate them compliantly (fields, refresh cadence, attribution UI, expiry, dedupe with salon posts).`, { label: 'audit:sources', phase: 'Audit', schema: AUD }),
])

phase('Build')
const IMPL = { type: 'object', properties: { branch: { type: 'string' }, worktree: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } }, ownerSetup: { type: 'array', items: { type: 'string' }, description: 'exact steps the owner must do (signups, env vars on Vercel, SQL)' }, tests: { type: 'string' }, notes: { type: 'string' } }, required: ['branch', 'worktree', 'commits', 'filesChanged', 'ownerSetup', 'tests', 'notes'] }
const impl = await agent(`${CTX}

Use the EXISTING worktree ${A.repo}/.claude/worktrees/jobs-data (branch jobs-data). CONTINUATION: a previous builder was cut off by a usage limit after committing 541d916 (parse fixes), 78af6f7 (partner feeds: Adzuna + Careerjet, ExternalJob table), 34afe57 (pipeline honesty fixes) and f6b5a35 (WIP). Read git log/diff main..HEAD first, keep that work, and finish only what is missing from this list. Also add an ingest heartbeat (setSetting ingest_last_at on every accepted batch) with an admin warning when nothing arrived for 24h. Implement:
1. The recommended compliant partner job source(s) from this research: ${JSON.stringify(sources)} — a server-side connector behind env vars (no keys in code), a daily cron route protected by CRON_SECRET added to vercel.json, US + AU nail queries, normalisation into the existing Job model (or a minimal additive model if required; any SQL must be additive and delivered as prisma/sql/<date>_*.sql for the owner to run), dedupe, automatic expiry, attribution label + outbound link on cards and detail, never mixed up with salon self-posts, admin visibility of last run / counts. It must be a no-op when keys are missing.
2. The pipeline fixes from: ${JSON.stringify(pipe)}.
3. The honest thin-data/empty-state improvements from: ${JSON.stringify(thin)} that are cheap and high impact (keep copy changes minimal and bilingual via tr()).
tsc --noEmit must pass; add a unit test for normalisation/dedupe/expiry with a mocked provider response (no live calls unless a key is present in the environment, and never with production DB). Report branch, files, owner setup steps, tests.`, { label: 'build', phase: 'Build', schema: IMPL })

phase('Review')
const REV = { type: 'object', properties: { mustFix: { type: 'array', items: { type: 'string' } }, niceToHave: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } }, required: ['mustFix', 'niceToHave', 'verdict'] }
const reviews = impl ? (await parallel([
  () => agent(`${CTX}

You are a compliance reviewer (API terms, consumer protection, honesty). Review branch ${impl.branch} in ${impl.worktree} against the provider terms you can find online and the rules above: attribution, caching/refresh limits, link-back, data minimisation (no phone harvesting), labelling, no fake data, expiry. Must-fix vs nice-to-have.`, { label: 'review:compliance', phase: 'Review', schema: REV }),
  () => agent(`${CTX}

You are a senior engineer. Review branch ${impl.branch} in ${impl.worktree} (git diff main...HEAD): cron auth, timeouts on Vercel, idempotency, dedupe, error handling, schema/SQL safety, performance of the jobs query, UI correctness at 390px, tests. Must-fix vs nice-to-have.`, { label: 'review:code', phase: 'Review', schema: REV }),
])).filter(Boolean) : []

phase('Fix')
const fix = impl && reviews.some((r) => r.mustFix.length) ? await agent(`${CTX}

Continue in worktree ${impl.worktree} (branch ${impl.branch}; cd there). Apply all must-fix items and cheap nice-to-haves: ${JSON.stringify(reviews)}. Re-run tsc and tests, commit, report.`, { label: 'fix', phase: 'Fix', schema: IMPL }) : null
return { pipe, thin, sources, impl, reviews, fix }