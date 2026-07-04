#!/usr/bin/env bash
# 本部PC用: バックアップ配信 Worker から最新の緊急パケットをローカル保存する。
# 5分ごとの自動実行 (macOS):
#   scripts/fetch-backup.plist を ~/Library/LaunchAgents/ にコピーして
#   launchctl load ~/Library/LaunchAgents/fetch-backup.plist
# Linux なら cron: */5 * * * * /path/to/fetch-backup.sh
set -euo pipefail

# 環境変数で上書き可能
BASE_URL="${BACKUP_BASE_URL:-https://todai-league-backup.qwg2pfmvzk.workers.dev}"
TOKEN="${BACKUP_DOWNLOAD_TOKEN:-REPLACE_WITH_LONG_RANDOM_TOKEN}"

DEST="${BACKUP_DEST:-$HOME/tournament-backup}"
mkdir -p "$DEST"

# 主ファイル。取得失敗時はスクリプト全体を失敗させる。
curl -fsSL "$BASE_URL/emergency.html?token=$TOKEN" -o "$DEST/emergency.html"

# 補助ファイル。存在しなくても続行する。
curl -fsSL "$BASE_URL/emergency.pdf?token=$TOKEN" -o "$DEST/emergency.pdf" || true
curl -fsSL "$BASE_URL/emergency.md?token=$TOKEN" -o "$DEST/emergency.md" || true
curl -fsSL "$BASE_URL/scores.csv?token=$TOKEN" -o "$DEST/scores.csv" || true
curl -fsSL "$BASE_URL/state.json?token=$TOKEN" -o "$DEST/state.json" || true
curl -fsSL "$BASE_URL/event-log.ndjson?token=$TOKEN" -o "$DEST/event-log.ndjson" || true
curl -fsSL "$BASE_URL/manifest.json?token=$TOKEN" -o "$DEST/manifest.json" || true

echo "Downloaded backup to $DEST at $(date)"
