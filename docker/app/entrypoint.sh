#!/bin/sh
set -e

# DATABASE_URL が file:/data/... のような絶対パス sqlite を指している場合、
# 親ディレクトリを作っておく (compose の volume マウント直下を想定)。
case "${DATABASE_URL:-}" in
  file:/*)
    db_path="${DATABASE_URL#file:}"
    db_dir="$(dirname "$db_path")"
    mkdir -p "$db_dir"
    ;;
esac

# マイグレーション適用 (prod 用は migrate deploy。dev 用の prompt は出ない)。
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

exec "$@"
