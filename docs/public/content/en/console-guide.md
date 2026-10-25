---
title: Console guide
description: The web console for admins and city coordinators: sessions, venues, coordinators, exports, bulk import, posters, daily ayahs and the audit log.
section: guides
order: 30
---

# Console guide

The console is the web tool for admins and city coordinators. Use it on a computer for work that is too big for a phone: lists, files, exports and oversight. Day-to-day tasks (posting an update, marking attendance) are quicker in the [coordinator app](coordinator-guide.md).

The console has its own address, given to staff when they are invited. It is not linked from public pages.

## Sign in and scope

Sign in with a WhatsApp code, like the apps. What you see depends on your role and place: a national admin sees everything, a city coordinator sees their city and its venues, a venue coordinator sees one venue. An item outside your place is not shown.

The left menu has these pages. Some are hidden for roles that cannot use them.

| Page         | For                                                               |
| ------------ | ----------------------------------------------------------------- |
| Sessions     | Every session and its dates; registrations; posters               |
| Venues       | Venues in your place, including archived ones                     |
| Coordinators | Invitations and role assignments                                  |
| Exports      | CSV files of registrants and attendance                           |
| CSV Import   | Bulk-create venues, sessions and coordinator invitations          |
| Daily ayahs  | The ayah of the day: national, venue or circle picks              |
| Audit log    | Who did what, where and when                                      |
| Settings     | Platform settings such as the Hijri date offset (national admins) |

Across the top you can change the language (English or Urdu), the theme (system, light or dark) and the text size (four steps). The menu mirrors for Urdu.

![The console Sessions page in Urdu at the largest text size: the green menu on the right, filter boxes, summary counts and a search box.](screens/console-sessions-ur-largest.png 'The console Sessions page in Urdu at the largest text size. Captured from the current build; it will be replaced after the redesign lands.')

## Sessions

The list shows sessions in your place, including drafts. The summary shows how many sessions there are, how many fall in the next seven days and how many are waiting for approval. Search by title, venue or teacher.

Open a session to see its dates, the people who joined, attendance and posters.

- **Change time or cancel a date** here the same way as in the app. People are told.
- **Posters.** Pick a template, language and formats. A poster is marked out of date if the session changes later; regenerate it.
- **Registrations.** Joining is a pledge, not a seat, so the list shows who said they will come.

## Venues and circles

Create a venue in a city, edit its public contact number and facilities, or archive it. City coordinators approve circles that venue coordinators created. Approved circles go public at once; rejected ones stay hidden.

## Coordinators

1. Choose **Invite coordinators**.
2. Enter the phone number (a Pakistani mobile number), the role and the place (a city for a city coordinator, a venue for a venue coordinator).
3. Send. The person gets a WhatsApp invitation and a pending invite appears in the list.

You can **resend** an invitation (it replaces the pending one) or **revoke** it. To hand a venue over, invite the new coordinator and replace the old assignment; the old coordinator loses access at once. There is a daily limit on invitations per person to stop mistakes and abuse.

## Exports

Choose **Registrations** or **Attendance**, then a city or venue and a date range, and generate a CSV file. The file opens in a spreadsheet.

> **Warning.** Exported files hold names and phone numbers. Share them only with people who need them, store them safely and delete them when finished. Each export is recorded in the audit log, with the filters and the number of rows, never the cells. Cells that could be read as spreadsheet formulas are made safe automatically.

If a file would be too large the console asks you to narrow the filters.

## CSV Import

For setting up many venues, sessions or coordinators at once.

1. **Upload.** Download the template, fill one row per item, and choose the file.
2. **Check.** Run the check. Nothing is saved. The console shows how many rows are ready, which are already there (they will be skipped) and which have errors, with a downloadable error list.
3. **Import.** When there are no errors, confirm. All rows are saved together in one step; if any row is refused, nothing is saved. A file that clashes with a change made by someone else in between is refused as a whole; check it again and retry. Importing the same file twice is safe, because rows already there are skipped.

Rows outside your place are refused. Coordinator files have a size limit and count toward your daily invitation limit.

## Daily ayahs

Set the ayah of the day for a date: nationally (national admins only), for a venue or for a circle. If no pick applies, the app uses a built-in list. You choose a surah and ayah number; the app shows the text from its own source.

## Audit log

Every sensitive action is listed with the person, the action, the place, the time and counts. Use it to answer "who changed this?". It never holds phone numbers or the contents of files.

## Settings

National admins can change platform settings, for example the **Hijri date offset**, because months in Pakistan start by moon sighting.

## Working safely

- Use your own login. Never share it.
- Close the console on shared computers.
- Keep exported files out of email and chat.
- Report a lost or stolen phone to a national admin so the session can be ended.

## Accessibility

The console follows the same rules as the apps: four text sizes, light, dark and high contrast, a skip link, keyboard use everywhere, visible focus, clear error messages next to the field, and a mirrored layout in Urdu.
