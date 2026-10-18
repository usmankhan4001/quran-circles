#!/bin/sh
# Staging-only, in-stack backup and restore check (run by the `restore-check` one-shot in
# infra/docker-compose.staging.yml). No host access, no stopping the stack, no --replace swap:
#   1. pg_dump of the live staging database, streamed into age with a throwaway key made here
#   2. decrypt and pg_restore into a scratch database (qc_restore_check)
#   3. compare every public table's row count, and an md5 over a few key tables, with the live one
#   4. drop the scratch database; the key and the dump live in tmpfs and go with the container
# Prints only table names, counts, hashes and timings: never rows.
set -eu

DB=qc
SCRATCH=qc_restore_check
KEYTABLES="cities venues sessions occurrences poster_templates message_templates"
W=/tmp/restore-check
mkdir -p "$W" && chmod 700 "$W"

# Milliseconds since boot (busybox `date` has no %N).
now() { awk '{ printf "%d", $1 * 1000 }' /proc/uptime; }
ms() { echo $(($2 - $1)); }
q() { psql -X -q -v ON_ERROR_STOP=1 -At -h postgres -U qc "$@"; }

cleanup() {
  q -d "$DB" -c "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true
  rm -rf "$W"
}
trap cleanup EXIT

t0=$(now)
age-keygen -o "$W/key" 2>/dev/null
RECIPIENT=$(age-keygen -y "$W/key")
t1=$(now)
pg_dump -h postgres -U qc -d "$DB" -Fc -Z6 | age -r "$RECIPIENT" >"$W/dump.age"
t2=$(now)
echo "restore-check: backup (pg_dump | age) $(ms "$t1" "$t2") ms, $(wc -c <"$W/dump.age") bytes encrypted"

q -d "$DB" -c "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null
q -d "$DB" -c "CREATE DATABASE $SCRATCH" >/dev/null
t3=$(now)
age -d -i "$W/key" "$W/dump.age" | pg_restore -h postgres -U qc -d "$SCRATCH" --no-owner --no-acl --exit-on-error
t4=$(now)
echo "restore-check: restore (age -d | pg_restore) $(ms "$t3" "$t4") ms"

COUNTS="SELECT format('SELECT %L, count(*) FROM public.%I', table_name, table_name)
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1
\\gexec"
printf '%s\n' "$COUNTS" | q -d "$DB" -F' ' | LC_ALL=C sort >"$W/live.counts"
printf '%s\n' "$COUNTS" | q -d "$SCRATCH" -F' ' | LC_ALL=C sort >"$W/restored.counts"
t5=$(now)
tables=$(wc -l <"$W/live.counts")
rows=$(awk '{ s += $2 } END { print s + 0 }' "$W/live.counts")
if diff "$W/live.counts" "$W/restored.counts" >"$W/counts.diff"; then
  echo "restore-check: row counts match in all $tables tables ($rows rows)"
  counts_ok=1
else
  echo "restore-check: ROW COUNT MISMATCH (live < / restored >):"
  cat "$W/counts.diff"
  counts_ok=0
fi

hash_ok=1
for t in $KEYTABLES; do
  sql="SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) FROM public.$t x"
  a=$(q -d "$DB" -c "$sql")
  b=$(q -d "$SCRATCH" -c "$sql")
  if [ "$a" = "$b" ]; then echo "restore-check: md5 $t match"; else echo "restore-check: md5 $t MISMATCH"; hash_ok=0; fi
done
t6=$(now)
echo "restore-check: compare $(ms "$t4" "$t6") ms (counts $(ms "$t4" "$t5") ms)"

q -d "$DB" -c "DROP DATABASE $SCRATCH" >/dev/null
t7=$(now)
echo "restore-check: drop scratch database $(ms "$t6" "$t7") ms; total $(ms "$t0" "$t7") ms"

if [ "$counts_ok" = 1 ] && [ "$hash_ok" = 1 ]; then
  echo "RESTORE CHECK OK"
else
  echo "RESTORE CHECK FAILED"
  exit 1
fi
