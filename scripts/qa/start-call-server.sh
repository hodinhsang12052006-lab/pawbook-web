#!/usr/bin/env bash
# LOCAL server for scripts/qa/call_test.mjs: realtime through the Pusher mock (scripts/qa/lib/pusher_mock.mjs, started
# by the test itself on 127.0.0.1:6001), no STUN (fully offline), call rate limits x20 for the test.
#
# Run it INSIDE a throwaway build copy of the repo (never the repo itself, never a folder with a .env): the repo .env is
# the PRODUCTION database. The copy must pin the database in .env.production.local:
#   TURSO_DATABASE_URL=""            (empty, not missing)
#   DATABASE_URL="file:./dev.db"     (the copy's own prisma/dev.db with the current schema)
# Build the copy with the mock's public settings (they are inlined at build time):
#   NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:6001 npx next build
# then, from the copy:
#   bash scripts/qa/start-call-server.sh            # then: BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
# NEVER set PUSHER_ALLOW_TEST / CALL_RATE_ALLOW_TEST / *_ALLOW_TEST on Vercel (the code ignores them there anyway).
set -e
# Guards (same as the QA copies' serve script): no .env here, Turso pinned EMPTY.
[ ! -f .env ] || { echo "refusing: .env present in $(pwd) — run this from a throwaway copy without .env" >&2; exit 1; }
[ -f .env.production.local ] && grep -q '^TURSO_DATABASE_URL=""' .env.production.local || { echo 'refusing: .env.production.local must pin TURSO_DATABASE_URL="" (local SQLite only)' >&2; exit 1; }
[ -f prisma/dev.db ] || { echo "refusing: prisma/dev.db missing (copy the local demo database first)" >&2; exit 1; }
# EMPTY, not unset: Prisma fills UNSET variables from a .env it finds next to its generated client (node_modules may be
# a junction into the main repo, whose .env is PRODUCTION) — a defined empty value is never overridden.
ROOT_WIN="$(pwd -W 2>/dev/null || pwd)"
export TURSO_DATABASE_URL= TURSO_AUTH_TOKEN=
export DATABASE_URL="file:./dev.db" LOCAL_SQLITE_URL="file:${ROOT_WIN}/prisma/dev.db"
export PUSHER_ALLOW_TEST=1 PUSHER_TEST_HOST=127.0.0.1:${PUSHER_MOCK_PORT:-6001} PUSHER_APP_ID=qa PUSHER_SECRET=qa-secret PUSHER_TEST_KEY=qa-key
export NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1
export CALL_STUN_URLS= CALL_RATE_ALLOW_TEST=1 SESSION_RECHECK_MS=0 SHOW_DEMO_DATA=1 NEXT_TELEMETRY_DISABLED=1
export NEXTAUTH_URL="http://localhost:${QA_PORT:-3210}" NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-local-call-qa}"
exec npx next start -p "${QA_PORT:-3210}"
