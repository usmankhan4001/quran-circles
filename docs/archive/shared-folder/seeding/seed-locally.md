# Seed the circles on your own PC (local only)

Everything below runs on your PC against a local Postgres. Nothing touches production.
Open PowerShell and paste one block at a time. Lines starting with `#` are comments.

The folder used below is the worktree I already prepared: `D:\Apps\CSG Venture\USMAN\qc-tanzeem-local`
(branch `lane/data/tanzeem-seed`, merged with today's main). The data file stays outside the repo.

## 0. One-time setup (already done on this PC, listed so you can redo it)

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local"
pnpm install

# Local Postgres on port 5433 (5432 is taken by another app on this PC)
$override = "$env:TEMP\qc-dev-port.yml"
"services:`n  postgres:`n    ports: !override`n      - `"127.0.0.1:5433:5432`"" | Set-Content -Encoding utf8 $override
docker compose -p qc-dev -f infra/docker-compose.dev.yml -f $override up -d

# .env for the local database (gitignored)
(Get-Content .env.example) -replace 'localhost:5432','localhost:5433' | Set-Content -Encoding utf8 .env

pnpm --filter @qc/db migrate
```

## 1. Cities and areas (SQL; the app has no screen for these)

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load"
npx tsx src/bin.ts places --in "<DOWNLOADS>\quranic_circles.csv" --out "$env:TEMP\places.sql"
Get-Content "$env:TEMP\places.sql" -Raw | docker exec -i qc-dev-postgres-1 psql -U qc -d qc -v ON_ERROR_STOP=1 -q
```

Expect: `provinces 5, cities 42, areas 42`. Safe to run again (it skips what exists).

## 2. Start the API in test mode (own window, leave it running)

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\apps\api"
$env:APP_ENV='development'; $env:AUTH_SECRET='dev-only-secret-at-least-32-characters-long'
$env:AUTH_FIXED_CODE='123456'; $env:MESSAGING_MODE='fake'; $env:CODE_DELIVERY_MODE='test'; $env:PORT='3000'
pnpm exec tsx --env-file=../../.env src/index.ts
```

Test mode: every sign-in code is `123456` and no email or WhatsApp is sent.

## 3. The local admin account

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local"
pnpm --filter @qc/db bootstrap-admin --phone +923000000001 --email admin@qurancircles.doraquran.pk
```

That creates a pending national-admin invite. The first sign-in with that email accepts it.
(+923000000001 is a synthetic test number for the local database only.)

## 4. Pin the venues and build the plan (map links, then Google geocoding)

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load"
node --env-file="D:\Apps\CSG Venture\USMAN\circles-geocode.env" --import tsx src/bin.ts report `
  --in "<DOWNLOADS>\quranic_circles.csv" --out "$env:TEMP\report-final.json" --geocode
```

Expect the counts you approved: `venuesImportable 167`, `sessionsImportable 172`, `pinsApproximate 75`.
(The key file is the one I created earlier; it never goes into the repo.)

## 5. Dry run, then the real import, through the API's own bulk import

```powershell
# Dry run: writes nothing
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api http://localhost:3000 `
  --email admin@qurancircles.doraquran.pk --phone +923000000001 --code 123456

# Real import (wait about a minute after the dry run: the sign-in has a resend cooldown)
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api http://localhost:3000 `
  --email admin@qurancircles.doraquran.pk --phone +923000000001 --code 123456 `
  --apply --manifest "$env:TEMP\local-manifest.json"
```

Expect `venues: created 167` and `sessions: created 172`. The manifest lists every id created.

## 6. Check the counts

```powershell
docker exec -i qc-dev-postgres-1 psql -U qc -d qc -c "select (select count(*) from cities) cities, (select count(*) from venues) venues, (select count(*) from sessions) sessions, (select count(*) from sessions where status='draft') monthly_drafts, (select count(*) from venues where entrance_notes_en like 'Approximate location%') approximate_pins"
curl http://localhost:3000/v1/places/cities
```

## 7. Open the apps

```powershell
# Console (admin), own window
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local"
pnpm --filter @qc/console dev
# then open the address it prints (usually http://localhost:5173)
# sign in: email admin@qurancircles.doraquran.pk, WhatsApp number +923000000001, code 123456

# Member app on the web, own window
$env:EXPO_PUBLIC_API_URL='http://localhost:3000'
pnpm --filter @qc/user-app web
```

## Rollback (local)

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load"
npx tsx src/bin.ts unload --manifest "$env:TEMP\local-manifest.json" --api http://localhost:3000 `
  --email admin@qurancircles.doraquran.pk --phone +923000000001 --code 123456
```

That archives the 172 sessions and then the 167 venues the load created, and nothing else.
To wipe the local database completely instead: `docker compose -p qc-dev down -v`, then start at step 0.
