#!/usr/bin/env bash
# Regenerates CookFeed_frontend/prototype/js/seed-data.js from the seeded development database, so the
# prototype shows exactly the store the database holds. Run it after changing the seed data
# (CookFeed_api/docs/sql/seed.sql and SeedData.cs), on a database freshly seeded from them:
#
#   1. reset and seed the database (CookFeed_api/DOCKER.md, "Reset the database"), then start the API once
#      in Development so DbSeeder fills it;
#   2. run this script from anywhere:  CookFeed_frontend/tools/export-seed-data.sh
#
# It uses psql if it is installed, and otherwise psql inside the Docker container from docker-compose.yml.
# The connection defaults match DOCKER.md; override them with PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
# The integration test PrototypeDataTests fails if the committed file no longer matches the seed.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
sql="$here/export-seed-data.sql"
out="$here/../prototype/js/seed-data.js"
compose="$here/../../CookFeed_api/docker-compose.yml"

export_json() {
  if command -v psql >/dev/null 2>&1; then
    PGTZ=UTC PGPASSWORD="${PGPASSWORD:-postgres}" psql -X -q -A -t -v ON_ERROR_STOP=1 \
      -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-cookfeed}" -f "$sql"
  else
    docker compose -f "$compose" exec -T -e PGTZ=UTC postgres \
      psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d cookfeed < "$sql"
  fi
}

# Non-ASCII characters (Tom\u00e1s, 230\u00b0C, 11\u201312) are written as \u escapes, like every other prototype
# script: a script loaded with src takes its encoding from the page, so plain ASCII reads the same however the
# file is decoded.
json="$(export_json | perl -CS -pe 's/([^\x00-\x7F])/sprintf("\\u%04x", ord($1))/ge')"
{
  echo "/* GENERATED from the seeded database by CookFeed_frontend/tools/export-seed-data.sh."
  echo "   Do not edit by hand: change the seed data, then run the script again."
  echo "   One array per table, rows in primary-key order, column names in camelCase. */"
  printf 'window.COOKFEED_SEED = %s;\n' "$json"
} > "$out"
echo "Wrote $out"
