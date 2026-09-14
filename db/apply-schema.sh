#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required and must be supplied through a secure runtime secret." >&2
  exit 2
fi

case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *) echo "DATABASE_URL must use the PostgreSQL URI scheme." >&2; exit 2 ;;
esac

command -v psql >/dev/null 2>&1 || { echo "psql is required on the VPC-connected runner." >&2; exit 2; }

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$(dirname "$0")/schema.sql"
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$(dirname "$0")/verify-schema.sql"
