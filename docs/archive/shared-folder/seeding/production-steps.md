# Seed production: copy-paste route

Live host today: `https://qurancircle.doraquran.pk` (API under `/api`). The `qurancircles` host (with an s)
still answers 404 until the new domain env is deployed.

Two places you paste into:
- **Dokploy → project → `quran-circles` compose → service `postgres` → Terminal** (called "postgres terminal" below).
  It is a plain `sh` inside the database container, as the `qc` superuser.
- **PowerShell on your PC** in `D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load` (called "PC" below).

Do the steps in order. Each one says what you should see. Stop and tell me if anything differs.

## Before you start: email codes

Admin sign-in in production is by a code sent by email (Resend). The stack must have `RESEND_API_KEY`
(and `APP_ENV=production`) in its Dokploy environment, redeployed. Without it step 4 cannot sign in.

## 1. Backup (postgres terminal)

```sh
mkdir -p /var/lib/postgresql/data/qc-backups && F=/var/lib/postgresql/data/qc-backups/pre-seed-$(date +%Y%m%d-%H%M%S).dump && pg_dump -U qc -d qc -Fc -f "$F" && ls -l "$F" && echo "toc entries: $(pg_restore -l "$F" | wc -l)" && psql -U qc -d qc -Atc "select 'cities',count(*) from cities union all select 'venues',count(*) from venues union all select 'sessions',count(*) from sessions union all select 'users',count(*) from users"
```

Expect: one `ls -l` line with a size, `toc entries:` above zero, then `cities|0`, `venues|0`, `sessions|0`.
The dump sits on the database volume, so it survives restarts. Restore later with
`pg_restore -U qc -d qc --clean --if-exists <file>` (only if we ever need to).

## 2. Cities and areas (postgres terminal)

Open psql: `psql -U qc -d qc -v ON_ERROR_STOP=1`

Then paste the whole content of the attached `places.sql` (it starts with `BEGIN;` and ends with a
`SELECT` that prints counts). Type `\q` to leave psql.

Expect the last output: `provinces 5`, `cities 42`, `areas 42`. Safe to paste twice: it skips rows
that already exist.

## 3. The first admin invite (postgres terminal)

This writes the same pending invite the app's `bootstrap-admin` command writes. Use the address
whose inbox you can read today. Until the redirect feature is deployed, codes go to the sign-in
address itself, so use your Gmail here; the `admin@…` identity with codes redirected to Gmail comes
with the branch `lane/auth/admin-bootstrap` (two env lines, after review and deploy).

Replace `YOUR_NUMBER` with your mobile number in +92 form (the one you gave me), then paste:

```sh
psql -U qc -d qc -v ON_ERROR_STOP=1 -c "INSERT INTO coordinator_invites (phone_e164, email, role, scope_type, status, expires_at) VALUES ('YOUR_NUMBER', '<ADMIN_EMAIL>', 'national_admin', 'national', 'pending', now() + interval '7 days') RETURNING id, expires_at"
```

Expect: one row with an `id` and an `expires_at` seven days away. (If you ever need to redo it,
first run `UPDATE coordinator_invites SET status='revoked' WHERE status='pending' AND role='national_admin';`.)

Then the audit row the app writes for an invite, so the log is complete:

```sh
psql -U qc -d qc -v ON_ERROR_STOP=1 -c "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, scope_type, meta) SELECT NULL, 'role.invite', 'invite', id::text, 'national', '{\"role\":\"national_admin\",\"source\":\"bootstrap-admin\"}'::jsonb FROM coordinator_invites WHERE status='pending' AND role='national_admin' ORDER BY created_at DESC LIMIT 1"
```

Expect: `INSERT 0 1`.

## 4. Load the circles from your PC against the live API (PC)

First make sure the plan file exists (it is the geocoded report; takes about a minute, uses your Maps key):

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load"
node --env-file="D:\Apps\CSG Venture\USMAN\circles-geocode.env" --import tsx src/bin.ts report `
  --in "<DOWNLOADS>\quranic_circles.csv" --out "$env:TEMP\report-final.json" --geocode
```

Expect `venuesImportable 167`, `sessionsImportable 172`.

Dry run (writes nothing). It asks for the sign-in code: the API emails it to your Gmail when the
command starts, you type the six digits and press Enter. Replace `YOUR_NUMBER` as above.

```powershell
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER
```

Expect: `venues to import: 167; cities not in the target: 0` and `venues dry run: created 167, duplicate 0, invalid 0`.
The first sign-in also accepts the admin invite from step 3, so your account now holds the role.

Real load. Wait about a minute after the dry run (code resend cooldown), then:

```powershell
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER --apply --manifest "$env:TEMP\prod-manifest.json"
```

Expect: `venues: created 167 … (applied)`, `sessions: created 172 … (applied)`, `manifest: 167 venues, 172 sessions`.
Keep `prod-manifest.json`: it is the rollback list.

## 5. Verify (postgres terminal) and rollback (PC)

```sh
psql -U qc -d qc -Atc "select 'cities',count(*) from cities union all select 'venues',count(*) from venues union all select 'venues_approximate',count(*) from venues where entrance_notes_en like 'Approximate location%' union all select 'sessions',count(*) from sessions union all select 'sessions_draft',count(*) from sessions where status='draft' union all select 'occurrences',count(*) from occurrences"
```

Expect: cities 42, venues 167, venues_approximate 75, sessions 172, sessions_draft 33, occurrences above 2000.
Then open the app: the sign-up city list shows 42 cities, and the map shows pins.

Rollback (archives exactly the 172 sessions and 167 venues from the manifest, nothing else):

```powershell
npx tsx src/bin.ts unload --manifest "$env:TEMP\prod-manifest.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER
```

Full restore of the pre-seed state, if ever needed (postgres terminal):
`pg_restore -U qc -d qc --clean --if-exists /var/lib/postgresql/data/qc-backups/<the dump file>`.
