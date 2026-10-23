#!/usr/bin/env bash
# Ejecuta un archivo .sql contra la base de producción de Supabase usando la
# Management API y el SUPABASE_ACCESS_TOKEN de .env.local.
# Uso: bash .claude/supabase-sql.sh archivo.sql
set -euo pipefail

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Uso: bash .claude/supabase-sql.sh archivo.sql" >&2
  exit 1
fi

SQL_FILE=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
cd "$(dirname "$0")/.."
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2 | tr -d '\r')

python -c "import json,sys;print(json.dumps({'query':open(sys.argv[1],encoding='utf-8').read()}))" "$SQL_FILE" |
  curl -sS -X POST "https://api.supabase.com/v1/projects/pnrhgujjnxyuznawjyaf/database/query" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary @-
echo
