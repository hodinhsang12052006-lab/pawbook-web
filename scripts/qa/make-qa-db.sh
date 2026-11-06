#!/usr/bin/env bash
# Tạo DB QA LOCAL đúng schema hiện tại (prisma/dev.db trong git thường cũ: thiếu bảng / cột → server báo
# P2021 / P2022, tab Việc làm "Không thể tải danh sách…"). KHÔNG BAO GIỜ đụng production / worktree:
#   1. chép prisma/dev.db (bản trong git HEAD) ra file tạm
#   2. `prisma db push` lên BẢN CHÉP (không generate lại client — node_modules có thể dùng chung với repo chính)
#   3. tuỳ chọn --seed: dữ liệu mẫu (scripts/seed-nail-data.ts) + persona QA (scripts/qa/seed_persona.mts)
#
#   bash scripts/qa/make-qa-db.sh [--seed] [đường_dẫn.db]
# Rồi chạy server với DB đó (biến rỗng TURSO_* trong .env.production.local thắng .env production):
#   TURSO_DATABASE_URL="file:$QA_DB" npx next start -p 3000
set -euo pipefail
SEED=0
OUT=""
for a in "$@"; do
  case "$a" in
    --seed) SEED=1 ;;
    *) OUT="$a" ;;
  esac
done
OUT="${OUT:-${TEMP:-/tmp}/pawnail-qa.db}"
case "$OUT" in
  libsql:*|*turso*|http*) echo "❌ Chỉ tạo DB file cục bộ, không phải $OUT"; exit 2 ;;
esac
# Git Bash (Windows): Node hiểu "/tmp/…" là ổ C:/tmp/… → đổi sang đường dẫn Windows cho prisma / tsx.
DBPATH="$OUT"
if command -v cygpath >/dev/null 2>&1; then DBPATH="$(cygpath -m "$OUT")"; fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
git show HEAD:prisma/dev.db > "$OUT"
echo "• chép prisma/dev.db (HEAD) → $OUT"
# DATABASE_URL tường minh + TURSO rỗng: prisma CLI chỉ đọc datasource sqlite từ biến này.
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN DATABASE_URL="file:$DBPATH" npx prisma db push --skip-generate --accept-data-loss >/dev/null
echo "• prisma db push → schema hiện tại"
if [ "$SEED" = 1 ]; then
  # lib/prisma dùng TURSO_DATABASE_URL khi có → trỏ vào FILE vừa tạo (libsql đọc được file:)
  env -u TURSO_AUTH_TOKEN TURSO_DATABASE_URL="file:$DBPATH" npx tsx scripts/seed-nail-data.ts >/dev/null
  env -u TURSO_AUTH_TOKEN TURSO_DATABASE_URL="file:$DBPATH" npx tsx scripts/qa/seed_persona.mts
  echo "• đã seed dữ liệu mẫu + persona QA"
fi
echo "QA_DB=$DBPATH"
echo "Chạy server: TURSO_DATABASE_URL=\"file:$DBPATH\" npx next start -p \${QA_PORT:-3000}"
