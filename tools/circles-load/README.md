# @qc/circles-load

Cleans a circles list (a CSV passed at run time) and works out one map position per venue, so the list can be loaded through the app's own import path. **No real circles, addresses or phone numbers belong in this repository.** The data file and the report both live outside it. Tests use synthetic rows only.

This package never writes to a database. Today it has one command, `report`.

```sh
pnpm --filter @qc/circles-load load report --in <circles.csv> --out <report.json> [--offline]
```

It prints counts only. The full detail (per-venue pin and reason, per-row flags) goes to `--out`.

## What it does

1. **Cleans each row.** Day names, weeks of the month (`Every 1st & 3rd Week of Month`), times (`07:30-AM`, `02.30-PM`, `Morning 10:15am`, `Evening 6:15`, ranges, `After Maghrib` and its spellings) and Pakistani mobile numbers (to `+92…`).
2. **Compares rows.** An exact repeat (same venue, day, time, weeks) is skipped. Two clock times at one venue one to five minutes apart are held as a probable typo. An address that names another city of the file is held. A midnight time written as "Morning 12:00am" is held. A bad phone number is dropped from the row; the row is still imported.
3. **Finds a position per venue.** In order: coordinates in the map link, the link's redirect (only Google's own hosts are contacted; a redirect to any other host is refused), coordinates or a plus code written in the note (a short plus code is recovered against the median pin of the same city). Reading page text was tried and removed: on real data it returned Google's default map centre for dozens of venues.
4. **Checks each position.** Outside Pakistan, far (over 60 km) from the median pin of its city, or the same pin used by two venues with different addresses: not trusted, not imported.
5. **Never guesses.** A venue with no trusted pin is listed as `needs_geocoding` and is not imported until someone pins it (the console location picker) or the owner approves a geocoding service.

## Defaults the load will apply (not source data)

- Prayer-relative starts use placeholder times (`PLACEHOLDER_TIMES` in `src/clean.ts`), stated in each session's description with the original wording. The app has no prayer-anchored start yet.
- Monthly patterns (`weeks` other than every week) cannot be expressed as a recurring session; they are loaded as drafts with the pattern in the description.
- Program `circles`, section, language, duration and titles are set by the loader and documented in the report.
