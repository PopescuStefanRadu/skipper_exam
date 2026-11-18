#!/bin/sh
# Database backups for production (see docs/DEPLOYMENT.md).
#
#   backup.sh daily           back up at start-up if today's backup is missing, then every
#                             day at BACKUP_HOUR (default 3); the newest BACKUP_KEEP_DAYS
#                             backups (default 14) are kept
#   backup.sh now             back up once, now
#   backup.sh list            list the backups
#   backup.sh restore <date>  restore both databases from /backups/<date> (stop app and kratos first)
#
# A backup is one folder per day, /backups/YYYY-MM-DD, with a custom-format pg_dump
# of the app's database and of Kratos's (accounts), taken together.
# Connection settings come from PGHOST, PGUSER and PGPASSWORD.
set -eu

dir=/backups
databases="skipper_exam kratos"

backup() {
  day=$(date +%F)
  tmp="$dir/.$day.tmp"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  for db in $databases; do
    pg_dump --format=custom --dbname="$db" --file="$tmp/$db.dump"
  done
  rm -rf "${dir:?}/$day"
  mv "$tmp" "$dir/$day"
  echo "backup: $dir/$day"
  # One backup a day: keeping the newest BACKUP_KEEP_DAYS keeps that many days.
  ls -1d "$dir"/20* | sort | head -n -"${BACKUP_KEEP_DAYS:-14}" | while read -r old; do
    rm -rf "$old"
    echo "backup: removed $old"
  done
}

restore() {
  src="$dir/${1:?usage: backup.sh restore <date>}"
  for db in $databases; do
    [ -f "$src/$db.dump" ] || { echo "restore: $src/$db.dump not found" >&2; exit 1; }
  done
  for db in $databases; do
    pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$db" "$src/$db.dump"
  done
  echo "restored $src"
}

case "${1:-daily}" in
  daily)
    until pg_isready --quiet; do sleep 2; done
    [ -d "$dir/$(date +%F)" ] || backup
    while true; do
      hour=${BACKUP_HOUR:-3}
      next=$(date -d "today $hour:00" +%s)
      [ "$next" -gt "$(date +%s)" ] || next=$(date -d "tomorrow $hour:00" +%s)
      sleep $((next - $(date +%s)))
      backup || echo "backup failed" >&2
    done
    ;;
  now) backup ;;
  list) ls -1 "$dir" | grep '^20' || true ;;
  restore) restore "${2:-}" ;;
  *) echo "usage: backup.sh daily|now|list|restore <date>" >&2; exit 2 ;;
esac
