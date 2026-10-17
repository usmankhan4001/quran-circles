# Next features (decided with the owner, 2026-10-16 and 2026-10-17)

These are product decisions only. Nothing here is built, and no wave or lane is assigned yet. The contract and database changes they need are in `docs/engineering/change-requests/2026-10-17-next-features.md` for the waves thread to decide. Urdu wording below is a draft until a native speaker reviews it (`docs/design/microcopy.md`).

## 1. Days read (personal) and reading together (community)

The owner chose a gentle count instead of a streak. The "no streaks or guilt" rule in `docs/design/principles.md` stands: there is no chain that breaks, no reset to zero, no missed-day message.

**What counts as a day read.** Any one of these, on a Pakistan-time calendar day:

- Reading any ayah in the in-app reader (recorded automatically).
- Meeting a personal daily goal the person sets, such as 1 page, 1 ruku or 10 minutes. The goal is optional.
- Tapping "I read today", so reading from a printed Quran counts.
- Attending a session (a coordinator attendance mark with the person's name), or reading the session's portion (feature 4).

**What the person sees.** "Days read this week" and "days read this month", for example "4 of 7 days this week". No streak count, no flame, no badge.

**Community total.** One national number only: how many people read today, plus a running count of pages read together. No city, venue or circle totals, so nothing is ever compared side by side.

**Privacy.** A person's days read are visible only to them. Coordinators and admins cannot see them. Everyone is counted anonymously in the national total, and there is no opt-out setting because no personal data is shown. Deleting an account removes the reading log; the national totals already counted stay as anonymous numbers.

**Wording (draft).**

| English                     | Urdu draft                   |
| --------------------------- | ---------------------------- |
| Days read                   | تلاوت کے دن                  |
| 4 of 7 days this week       | اس ہفتے 7 میں سے 4 دن        |
| I read today                | میں نے آج تلاوت کی           |
| Read together today         | آج مل کر تلاوت               |
| {count} people read today   | آج {count} لوگوں نے تلاوت کی |
| {count} pages read together | مل کر {count} صفحات پڑھے گئے |

## 2. Ayah of the day

A card on Home with one ayah, its Urdu translation and a link that opens the reader at that ayah.

- **Who picks it.** Admins keep a curated, dated list in the console. A built-in list of well-known ayahs fills any day the curated list leaves empty. A venue or circle coordinator can set the ayah for their own venue or circle; people who follow it see the coordinator's pick in place of the national one. If someone follows several, the national pick shows.
- **Notification.** A daily morning push, on by default for everyone with push turned on, with an off switch in Profile. This is a deliberate exception to the calm rule, chosen by the owner.
- **Translation rights.** We store only the surah and ayah number. The Arabic text and the Urdu translation come from the reader's current source, because we may not ship our own copy of the translation until rights are confirmed (`docs/product/decisions.md`, Quran and prayer).

**Wording (draft):** Ayah of the day: آج کی آیت. Notification setting: آج کی آیت کی اطلاع.

## 3. Memorisation tracker (private)

- Per surah. Each surah can be marked **learning**, **memorised** or **revising**, or left unmarked.
- A gentle "revise this week" list shows memorised surahs the person has not marked as revised for a while (default 14 days, a setting). No reminders are sent for it.
- Saved to the account so it survives a new phone, and visible only to the person. Deleted with the account.

**Wording (draft):** Memorisation: حفظ. Learning: یاد کر رہے ہیں. Memorised: یاد ہے. Revising: دہرا رہے ہیں. Revise this week: اس ہفتے دہرائیں.

## 4. Read along with your session

Builds on the session companion (WP17), which already lets coordinators set each occurrence's portion.

- On the day of a session the person registered for or follows, the Home card shows "Read tonight's portion", opening the reader at the portion.
- The existing session reminder links straight to the portion.
- Reading any ayah of the portion counts as a day read (feature 1).
- No extra notification is added.

**Wording (draft):** Read tonight's portion: آج کی نشست کا حصہ پڑھیں.

## Parked

The owner asked not to add these yet.

- **Host a Quran circle.** Today only venue coordinators create circles and a city coordinator approves them. Attendees ask for one through "Request a circle near me" (WP19).
- **Join the movement.** Discussed as levels (pledge, invite, volunteer), then parked. If it comes back, settle first how it fits the "no referral rewards" decision.
- **Group khatm and a community dua wall** were suggested and not chosen.
