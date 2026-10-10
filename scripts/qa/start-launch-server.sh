#!/usr/bin/env bash
# Khởi động server LOCAL với mọi máy chủ giả cho launch_test.mjs:
#   Twilio Verify :4997 · OAuth :4996 · FCM :4995 · APNs (http2+TLS) :4994 · Web push :4999 · Gemini :4993 · Cloudflare AI :4992
#   (đặt GEMINI_API_KEY thật trước khi chạy để thử với Gemini thật)
# Khoá test (RSA cho FCM, EC P-256 cho APNs) nằm ở $TEMP/qa-keys (tạo bằng openssl).
# KHÔNG BAO GIỜ đặt các biến *_ALLOW_TEST* trên Vercel.
#   bash scripts/qa/start-launch-server.sh
set -a
. ./.env.push.local
set +a
KEYS="$TEMP/qa-keys"
export PUSH_ALLOW_TEST_ENDPOINT=1 NODE_TLS_REJECT_UNAUTHORIZED=0
export NEXTAUTH_URL=http://localhost:3000
export TWILIO_ACCOUNT_SID=ACtest TWILIO_AUTH_TOKEN=test-token TWILIO_VERIFY_SERVICE_SID=VAtest
export SMS_ALLOW_TEST_BASE=1 TWILIO_VERIFY_BASE=http://127.0.0.1:4997
export OAUTH_ALLOW_TEST=1 OAUTH_TEST_SERVER=http://127.0.0.1:4996
export FIREBASE_SERVICE_ACCOUNT="$(node -e 'const fs=require("fs");console.log(JSON.stringify({project_id:"pawnail-test",client_email:"qa@pawnail-test.iam.gserviceaccount.com",private_key:fs.readFileSync(process.argv[1],"utf8")}))' "$KEYS/fcm.pem")"
export FCM_ALLOW_TEST=1 FCM_TEST_BASE=http://127.0.0.1:4995
export APNS_TEAM_ID=TEAM123456 APNS_KEY_ID=KEY1234567 APNS_BUNDLE_ID=com.bitpawos.app
export APNS_PRIVATE_KEY="$(cat "$KEYS/apns.p8")"
export APNS_ALLOW_TEST=1 APNS_TEST_BASE=https://127.0.0.1:4994
export GEMINI_API_KEY="${GEMINI_API_KEY:-test-gemini-key}"
if [ "$GEMINI_API_KEY" = "test-gemini-key" ]; then export GEMINI_ALLOW_TEST=1 GEMINI_TEST_BASE=http://127.0.0.1:4993; fi
export AI_DESIGNS_ALLOW_DATA_URL=1 AI_DESIGNS_DAILY_LIMIT=6 CRON_SECRET=test-cron
export CF_ACCOUNT_ID=test-acc CF_AI_TOKEN=test-cf-token CF_AI_ALLOW_TEST=1 CF_AI_TEST_BASE=http://127.0.0.1:4992 AI_IMAGES_DAILY=3
exec npx next start -p 3000
