# Drawing gaps that need data, an API or a licence

The apps now follow the drawings everywhere the existing data allows (pushed to `claude/peaceful-archimedes-ain95k`, full check passes with 5,922 tests). These are the gaps that remain, and what closing each would take.

## Needs your decision

| Gap | What it would take | Until then |
| --- | --- | --- |
| Font files (Figtree, Jameel Noori Nastaleeq, KFGQPC Uthmanic Hafs) | Confirm each licence allows bundling in the apps. Then it is a small change to bundle them. | Fallback fonts. This is the biggest visible difference in Urdu and Quran text. |
| Venue photos | A photo field on venues (contract change plus a migration), upload and storage in the API, an upload control in the console or admin app, and each masjid's permission to publish its picture. Medium-sized: about one lane's work in each of contracts, db, API and console. | Drawn venue art. |
| English translation of the ayah of the day | Pick an English translation whose licence allows app use. Adding it to the content source is small. | English screens show the Arabic and the reference only. Urdu screens show the Urdu translation. |
| Quran text credit | Confirm the Arabic edition is the Tanzil text and whether the credit line must also name CC BY 3.0 or link to tanzil.net. The rights for the Urdu translation (Maududi) are still open. | The credit reads "Arabic text: Tanzil Project (tanzil.net)". |

## Needs a new API (console numbers)

| Drawn item | What it would take |
| --- | --- |
| "Registered this month" | A registration count by date range within the person's scope, for example a registrations report endpoint. |
| "Turned up" percentage | An attendance summary within scope. Headcount exists only per date today. |
| Exact totals ("86 sessions in Karachi") and the approvals count on the menu | A `total` on list answers, or a count endpoint. Today the cards count the rows loaded so far, and say so when there are more pages. |
| Search beyond the loaded rows | A search parameter on the sessions, venues, audit and roles lists. Today search runs over the loaded rows. |
| Exports page: attendance export, recent exports and "file is ready" | An attendance export and an export history endpoint (already an open change request). |
| Add a single session or venue from a form | The endpoints exist, but the console has no editor yet, so Add opens the bulk import. |

## Kit pieces still drawn inside the apps

Map pins, the people stepper, choice cards, round shortcuts, picture cards, a download icon and a gradient for native fades (phones show a solid green header instead of the fade). The apps mark these for the ui lane to move into the kit.

## How to see the staff apps against the mock

Sign in with code `123456` and one of these fake numbers: +923000000201 (venue coordinator), +923000000202 (city coordinator), +923000000203 (national admin). The apps have been checked in tests only; nobody has looked at them on a screen yet.
