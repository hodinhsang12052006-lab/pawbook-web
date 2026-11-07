#!/usr/bin/env bash
# LOCAL server for scripts/qa/call_test.mjs: realtime through the Pusher mock (scripts/qa/lib/pusher_mock.mjs, started
# by the test itself on 127.0.0.1:6001), no STUN (fully offline), call rate limits ×20 for the test.
# The build must be made with the mock's public settings (they are inlined at build time):
#   NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1 NEXT_PUBLIC_PUSHER_TEST_WS=127.0.0.1:6001 npm run build
# Local SQLite only — TURSO_* are cleared. NEVER set PUSHER_ALLOW_TEST / CALL_RATE_ALLOW_TEST / *_ALLOW_TEST on Vercel
# (the code ignores them there anyway).
#   bash scripts/qa/start-call-server.sh            # then: BASE_URL=http://localhost:3210 node scripts/qa/call_test.mjs
set -e
unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN
export PUSHER_ALLOW_TEST=1 PUSHER_TEST_HOST=127.0.0.1:${PUSHER_MOCK_PORT:-6001} PUSHER_APP_ID=qa PUSHER_SECRET=qa-secret PUSHER_TEST_KEY=qa-key
export NEXT_PUBLIC_PUSHER_APP_KEY=qa-key NEXT_PUBLIC_PUSHER_CLUSTER=mt1
export CALL_STUN_URLS= CALL_RATE_ALLOW_TEST=1 SESSION_RECHECK_MS=0 SHOW_DEMO_DATA=1
export NEXTAUTH_URL="http://localhost:${QA_PORT:-3210}"
exec npx next start -p "${QA_PORT:-3210}"
