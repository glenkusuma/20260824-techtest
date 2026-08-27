#!/usr/bin/env bash
set -euo pipefail

artifact_dir="${ARTIFACT_DIR:-/home/cron}"
retention_days="${RETENTION_DAYS:-30}"
mkdir -p "$artifact_dir"

# Restrict deletion to files created by the collection naming convention.
find "$artifact_dir" -type f -name 'cron_????????_??.??.csv' -mtime "+${retention_days}" -print0 |
while IFS= read -r -d '' csv; do
  meta="${csv%.csv}.meta.json"
  rm -f -- "$csv"
  [[ -f "$meta" ]] && rm -f -- "$meta"
done
