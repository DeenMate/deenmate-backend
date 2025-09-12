#!/usr/bin/env bash
set -euo pipefail

PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGDATABASE=deenmate
PGPASSWORD=postgres
export PGPASSWORD

DIR="$(cd "$(dirname "$0")/.." && pwd)"
CSV_DIR="$DIR/data/hadith-book-titles"

# Ensure staging table exists
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS staging;
CREATE TABLE IF NOT EXISTS staging.hadith_book_title_overrides (
  collection text NOT NULL,
  number int NOT NULL,
  title_en text,
  title_ar text,
  PRIMARY KEY (collection, number)
);
TRUNCATE staging.hadith_book_title_overrides;
SQL

shopt -s nullglob
for csv in "$CSV_DIR"/*.csv; do
  echo "Loading: $csv"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
    -c "\copy staging.hadith_book_title_overrides (collection, number, title_en, title_ar) FROM '$csv' WITH (FORMAT csv, HEADER true)"
done

echo "Loaded overrides:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM staging.hadith_book_title_overrides;"
