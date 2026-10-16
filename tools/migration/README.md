# @qc/migration: V1 to V2 data migration

Moves the V1 venues, past registrations and WhatsApp subscribers into the V2 database. V1 is never written to. The tool prints counts only: no phone numbers, names or message text appear in its output, its report or its logs.

Everything here is a human-supervised, run-once-and-repeat-safely tool. Nothing is applied without a reviewed mapping and a confirmed plan.

## What is carried and what is not

| V1 data              | V2 destination                                          | Notes                                                                                                       |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Venues               | `venues`, under a city and area                         | Only rows a person approved in the mapping CSV. Cities are never created; areas only with `--create-areas`. |
| Registrations        | `legacy_registrations`, tagged `ramadan-2026`           | Not turned into accounts. Phone is stored as E.164 in `phone_raw`; the other answers go in `raw`.           |
| WhatsApp subscribers | `legacy_whatsapp_subscribers`, `needs_reconsent = true` | They must opt in again.                                                                                     |

Not carried:

- Push subscriptions (never read, never exported).
- Accounts, consent and sign-ins. A past registration keeps its original purpose only.
- Organizer names, timing, category, maps links and Urdu text (V1 had no Urdu; Urdu columns are filled with the English text and counted as `needsUrduText`).
- Sessions (V1 had none).
- Registrations whose venue is unmapped, ambiguous or unapproved, and rows with an invalid phone. They are skipped and counted, never guessed.

## Quick start (synthetic data, no database)

```sh
pnpm --filter @qc/migration migrate:dry-run -- \
  --in fixtures --mapping fixtures/mapping.csv --offline --create-areas
```

`fixtures/` holds synthetic data only (names such as "Test Person 1", phones in a fake range). Regenerate it with `pnpm --filter @qc/migration fixtures:write`, then `pnpm exec prettier --write tools/migration/fixtures`.

## Running it for real

Run from `v2/`. Use a throwaway working folder: the exports contain personal data, so keep them out of git (`tools/migration/out/` is git-ignored) and delete them after use.

1. **Export** V1 (read-only). Set the variables in your shell, never in a file in the repository.

   | Variable                                  | Used for                                       |
   | ----------------------------------------- | ---------------------------------------------- |
   | `V1_SUPABASE_URL`, `V1_SUPABASE_ANON_KEY` | Venues through the REST API (GET only)         |
   | `V1_VENUES_DATABASE_URL`                  | Venues directly from Postgres, instead of REST |
   | `V1_NEON_DATABASE_URL`                    | Registrations and WhatsApp subscribers         |
   | `DATABASE_URL`                            | The V2 target database (no default)            |

   ```sh
   pnpm --filter @qc/migration export                  # writes out/export/*.json (mode 0600)
   ```

   The V1 connections are read-only transactions with explicit column lists. Push subscription tables are not touched.

2. **Propose a mapping.** The tool guesses a city for each venue from address text and coordinates and writes a CSV.

   ```sh
   pnpm --filter @qc/migration propose-mapping -- --in out/export --out out/mapping.csv
   ```

   It refuses to overwrite an existing file without `--force`.

3. **A person reviews the CSV.** Fix the city, area and coordinates where needed and set `approved` to `yes` on each row that is right. Blank means not approved, and unapproved venues are not imported. A province mismatch is flagged for you.

4. **Dry run.** Reads the target database in a read-only transaction and writes nothing.

   ```sh
   pnpm --filter @qc/migration migrate:dry-run -- \
     --in out/export --mapping out/mapping.csv --create-areas --report out/reports/dry.json
   ```

   It prints counts per city and per category, writes the counts-only JSON report, and writes `dry.flagged.csv` (row number, source id, reason; no personal data). It ends with a `plan fingerprint`.

5. **Review** the report and the flagged rows with the owner. Rows needing a human decision are listed by reason.

6. **Apply** in one transaction, passing the fingerprint you reviewed:

   ```sh
   pnpm --filter @qc/migration migrate:apply -- \
     --in out/export --mapping out/mapping.csv --create-areas \
     --report out/reports/apply.json --confirm <fingerprint>
   ```

   If the data, the mapping or the target changed since the dry run, the fingerprint no longer matches and nothing is written. Any error rolls the whole transaction back.

7. **Verify** the counts before and after:

   ```sh
   pnpm --filter @qc/migration snapshot -- --out out/reports/pre.json   # optional extra snapshot
   pnpm --filter @qc/migration verify -- --report out/reports/apply.json
   ```

   Verify checks that venues, areas and legacy rows grew by exactly the reported amounts per city, that sessions and users did not change, and that no subscriber has `needs_reconsent = false`.

## Safety properties

- **Idempotent.** Inserts use `ON CONFLICT DO NOTHING` and the plan counts rows already present. A second apply inserts nothing; a second dry run shows everything as present.
- **Single transaction.** The apply takes an advisory lock and a rollback follows any error, including a count mismatch.
- **One code path.** The dry run and the apply build the same plan, so their counts match.
- **No data in output.** Errors print only a SQLSTATE code, table and constraint, or a system error code. Tests scan console output, the report and the flagged CSV for names, venue text and phone-like strings.
- **Existing V2 venues are never overwritten.** A venue is recognised as already present by city, normalised name and normalised address. A slug used by a different venue is flagged as a conflict.

## Phone numbers

Normalised to E.164 with Pakistan rules: `0300...`, `300...`, `92300...`, `+92 300 ...`, `0092...`, and Urdu digits all become `+92300xxxxxxx` (mobile prefixes 30 to 35). Landlines are accepted only as venue contacts. International numbers are accepted only with an explicit `+` or `00`, and counted as `nonPakistanNumber`. Anything else is rejected and counted as `invalidPhone`.

## Bookmarks

Mapping of V1 local bookmarks to the contract's `BookmarkImport` shape is a pure function with no I/O:

```ts
import { mapV1Bookmarks } from '@qc/migration/bookmarks';
```

It validates surah and ayah against the real ayah counts, drops duplicates and anything invalid, and caps the result at the contract's 500 items. Apps cannot depend on `tools/`, so see the change request about a shared home for it.

## Rotating the exposed V1 credentials at V2 launch

The V1 app shipped a database password, push keys and other credentials in its source and client bundle. Treat all of them as already seen by others, and treat the V1 git history and any published V1 build as compromised. Rotation is a human step done at V2 launch, after the final export, not by this tool. Nothing is rotated earlier because V1 stays live until then.

At launch, a person with owner access does the following in each provider's dashboard. Do not write any new value into the repository, a ticket or a chat.

1. **Neon (registrations and subscribers):** reset the password of the role V1 used, or delete that role, and revoke any other connection strings. Confirm V1 can no longer connect.
2. **Supabase (venues):** rotate the database password and the API keys (anon and service role). Tighten or remove the open insert policy on the `programs` table, then disable the V1 project once the V1 app is retired.
3. **Web push:** discard the V1 VAPID key pair and delete the stored push subscriptions. V2 generates its own keys; V1 subscriptions are not migrated.
4. **WhatsApp and workflow automation (n8n, WAHA):** rotate or disable their credentials and webhook secrets, and disable the old workflows.
5. **Remove exports:** delete every export, mapping and report file made with this tool from every machine (they hold personal data), and unset the `V1_*` variables.
6. **Confirm:** try the old credentials once and check that they fail, then record the date in the launch checklist.
