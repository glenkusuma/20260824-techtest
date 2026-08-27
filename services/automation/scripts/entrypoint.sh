#!/usr/bin/env bash
set -euo pipefail

# Rootless automation (supercronic + UID 1000). All configuration travels in the
# container environment (BACKEND_URL, ARTIFACT_DIR, COLLECTOR_DATABASE_PATH, TZ),
# so no /etc files are written here. The container runs as the unprivileged
# `node` user (UID 1000) and never as root. tzdata + TZ=Asia/Jakarta let
# supercronic interpret the crontab schedule in the intended timezone.
mkdir -p "${ARTIFACT_DIR:-/home/cron}" "$(dirname "${COLLECTOR_DATABASE_PATH:-/data/collector.db}")"

# Invoke supercronic by absolute path: its reaper re-executes itself, and older
# builds mis-resolve the binary when the cwd is "/" (supercronic #177/#181).
exec /usr/local/bin/supercronic /app/services/automation/crontab
