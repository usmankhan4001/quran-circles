# Tanzeem-e-Islami Quranic Circles: clean data (25 Oct 2026)

Source: the export Muhammad supplied (CSV + JSON) of the Google Sheet that the widget on https://www.tanzeem.org/quranic-circles/ reads. I could not fetch tanzeem.org directly (blocked in the sandbox). The CSV and JSON agree on every field for all 189 rows (checked).

Files
- `quranic_circles_clean.csv` (UTF-8 with BOM so Excel shows Urdu) and `quranic_circles_clean.json`: one row per circle/session, 189 rows.
- Raw values are kept (`*_raw`, `time_raw`, `weeks_raw`); derived columns sit next to them. Nothing was invented: a blank means the source had no value.

## Counts
189 circles, 42 cities (as spelled in the source), 182 distinct venues (same city + address text). Biggest: Lahore 44, Karachi 34, Jhang 11, Multan 11, Bajaur 9, Faisalabad 8.

## Columns
id, city, halqa_code, halqa_name_ur, address, address_script (ur/en), venue_key, day_name, day_of_week (Sun=0), time_raw, time_kind (clock / prayer_relative / prayer_relative_with_clock), prayer_anchor (fajr/zuhr/asr/maghrib/isha), start_time_24h, end_time_24h, recurrence (weekly / monthly), weeks_of_month (e.g. "1 3"), weeks_raw, contact_raw, contact_e164, map_link_raw, map_link (g_st tracking param removed), map_link_type, map_lat, map_lng, map_coord_source, map_note_raw, map_note_kind (place_text / placeholder / partial_coordinate / coordinates_dms), submitted_at (ISO), source_url, flags (pipe separated).

## What the source does not have
- No coordinates as columns. Only 4 rows yield lat/lng (3 from the map link, 1 from degrees in the note); the rest need geocoding from the map link.
- No area/neighbourhood, venue name, title, language, men/women/family section, duration, capacity, or coordinator name. Only a phone number per circle.
- 153 of 189 times are relative ("After Maghrib", "After Isha", ...), not clock times. Only 35 have a clock time (`start_time_24h`; one has an end time, row 150).
- "Halqa" (region) is a regional group, not a city.

## Conflicts and oddities (flagged in `flags`)
- Possible duplicate: ids 71 and 73 (Jhang, same address, Friday 11:00, different map links). Keep one.
- Same venue, two rows, likely typo: ids 185/186 (Islamabad I-10, Tue "Evening 6:15" and Wed "Evening 6:16").
- Map link shared by rows with different addresses (9 rows): 153 Arifwala with 155/156 Sahiwal; 108/109 Bahawalnagar; 188/189 Islamabad; 177 Sheikhupura with 178 Lahore.
- City vs halqa mismatch: id 59 is listed under Sargodha but has a Karachi address and Karachi halqa (KW); id 187 Rawalpindi is in the Islamabad halqa (CT). Cities with several halqas: Karachi (4), Lahore (2).
- 15 rows have no map link. Of those, 4 have a placeholder note ("No", "Nil", "....", "xxxx"), 3 have a partial coordinate (just a latitude: ids 28, 29, 70), 6 have only place text (two with plus codes: 10, 180), 1 has degrees (id 99, converted).
- Time: id 164 "Morning 12:00am" is ambiguous (kept as 00:00); id 175 "After Zohar (12:45)" has no am/pm (kept as 12:45); id 46 "Namaz Zuhar" is prayer-relative only.
- Phone: id 82 "0333-242243" has too few digits, so `contact_e164` is blank. Other numbers were normalised to +92 format.
- Fixed-format spelling variants in the source were kept as given (Magrib/Maghrib, Fajar, Aftar Asar); `prayer_anchor` normalises them.

## Mapping to the console import (for the next step)
`apps/console/src/import` takes two files. Venues need: city, area, name_en, address_en, lat, lng (all required), plus name_ur, address_ur, contact_phone and facility flags. Sessions need: venue, title_en, program, section, language, start_time (HH:MM), duration_minutes (all required), plus kind, days (Mon|Wed), starts_on, date, capacity, registration, status.
Gaps against the required columns: area, lat/lng, a venue name and title (we only have an address), program, section, language, duration, and a clock start_time for the 154 relative times. Those need decisions or defaults before a seed, not guessing.
