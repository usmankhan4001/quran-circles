# Seed the circles: by CSV in the admin console, or by one terminal command

The files are on your PC in `D:\Apps\CSG Venture\USMAN\seed-csv\`:

- `venues.csv`: 167 rows, one per venue.
- `sessions.csv`: 172 rows, one per circle, each naming its venue.

They are generated from the cleaned list (`circles-load export`), so they match what the terminal
route sends. Keep them out of the repo. Both routes need the same two things done first, in order:

1. **Cities and areas exist** in the target database (`places.sql`, step 2 of the production steps).
   The import matches the `city` and `area` columns by name; a city that is missing makes every
   row of that city "Needs fixing".
2. **An admin account** that can sign in (the invite from step 3 of the production steps, then one
   sign-in with the emailed code). Only a national admin can import for every city.

## Column legend

`venues.csv`

| column | meaning |
| --- | --- |
| city | City name, as in the app (e.g. Lahore) |
| area | Area name; here the city itself, since the source names no areas |
| name_en | Venue name: the first part of the address plus the city, made unique within the city |
| name_ur | Empty; the Urdu name can be added later in the console |
| address_en | The address from the source list |
| address_ur | Empty |
| lat, lng | The map pin (from the map link, the plus code, or Google geocoding) |
| contact_phone | Empty on purpose: no coordinator numbers are loaded |
| entrance_notes_en | "Approximate location…" on the 75 venues whose pin came from an approximate geocode |

`sessions.csv`

| column | meaning |
| --- | --- |
| city, venue | The venue, by its city and the exact `name_en` from venues.csv |
| title_en, title_ur | "Quran circle <code> (<city>)" and the halqa name from the source |
| description_en | The original timing wording where a placeholder time or a monthly pattern was used |
| kind | `recurring` |
| program, section, language | `circles`, `family`, `ur` (defaults chosen for the test load) |
| start_time | HH:MM. For "After <prayer>" circles a placeholder time (see the description) |
| duration_minutes | 60, or the length of a given range |
| days | Weekday, e.g. `fri` |
| starts_on | The date the export was made (first occurrence from then on) |
| status | `published`, or `draft` for the 33 monthly-pattern circles |

## Route A: the admin console

1. Sign in to the console (production: `https://qurancircle-admin.doraquran.pk` today, or the
   `qurancircles-admin` host once the new domain is deployed) with your email and the emailed code.
2. Left menu: **CSV Import** (page title "Bulk import").
3. **What are you importing?** → **Venues**. **Choose a CSV file** → `venues.csv`. Press **Check file**.
4. Read the **Summary of the check**: Rows 167, **Ready** 167, **Already there** 0, **Need fixing** 0.
   Nothing is saved yet. If any row "Needs fixing", the table under it names the line, the column
   and the problem (a city not in the database is the usual one); you can **Download the problems
   as a file**. Fix, then **Check again**.
5. Press **Import 167 rows**. Wait for "Import finished. 167 rows added."
6. **Import another file** → **Sessions** → `sessions.csv` → **Check file**. Expect Ready 172.
   Press **Import 172 rows**. Done: the Sessions page lists them, and the member app shows pins.

Running a file twice is safe: rows already there show as "Already there, skipped".

**Undo (console route):** there is no single-step undo in the console; venues and sessions can be
archived one by one on their pages. For a whole-batch undo use the terminal route below (it keeps a
manifest), or restore the pre-seed backup (`pg_restore`, see the production steps).

## Route B: one command from your PC (PowerShell)

Same data, through the same API import, but it signs in for you, runs the check, then the import,
and writes a manifest so the whole batch can be archived in one step. Replace `YOUR_NUMBER` with
your +92 number (the one on the admin invite). It asks for the six-digit code from your email.

```powershell
cd "D:\Apps\CSG Venture\USMAN\qc-tanzeem-local\tools\circles-load"

# Check only (nothing written)
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER

# Import for real, about a minute later (code cooldown)
npx tsx src/bin.ts load --plan "$env:TEMP\report-final.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER --apply --manifest "$env:TEMP\prod-manifest.json"

# Undo the whole batch
npx tsx src/bin.ts unload --manifest "$env:TEMP\prod-manifest.json" --api https://qurancircle.doraquran.pk/api `
  --email <ADMIN_EMAIL> --phone YOUR_NUMBER
```

`$env:TEMP\report-final.json` is the plan file; step 4 of the production steps shows the one command
that creates it (about a minute, uses your Maps key). For the local database use
`--api http://localhost:3000`, email `admin@qurancircles.doraquran.pk`, phone `+923000000001`, `--code 123456`.
