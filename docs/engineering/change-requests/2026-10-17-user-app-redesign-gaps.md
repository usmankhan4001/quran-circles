# Change request: gaps found while applying the redesign to the user app

Requested by: user-app
Contract: `@qc/ui`, `@qc/contracts`, `@qc/content`
What I need:

1. `@qc/ui` `SessionCard`: a `footer` slot (a status, a reminder switch, a Cancel button) and a `lang` for the title and place. My Journey puts the controls in a card under the kit card, and an English venue name inside an Urdu screen takes the Urdu font.
2. `@qc/ui` `ConfirmSheet`: an `errorText` shown in the sheet with `role="alert"`. When a cancel or a delete fails the person must see why. The app adds the reason to the message for now, which is read out as part of the question.
3. `@qc/ui`: a `Stepper` (people counter), choice cards (Women / Men / Family, D10), a photo header with a neutral block when there is no photo, a picture card, a map preview card, and icons for home, pin, book, calendar, bell, filter, clock, people, route and prayer. The app draws these in `apps/user-app/src/ui/` (marked `TODO(kit)`).
4. `@qc/ui` `SearchField`: a "link" variant that looks the same but opens another screen (Home to Nearby).
5. `@qc/contracts`: a photo for a venue (`photoUrl`), so session, venue and picture cards can show it. Until then they show the neutral block.
6. `@qc/contracts`: circle progress for My Journey (J1 draws "circle progress"): the portion a circle has reached and the sessions a person attended. The app has nothing to show, so the section is left out.
7. `@qc/content`: an ayah-of-the-day card (Arabic, translation, reference, share). Home shows the place (surah and ayah) and opens the reader there.

Why: D14, D15 and D16 draw these. The app cannot show them without the pieces above.

Affected lanes: ui, contracts, content, user-app (deletes its local stand-ins).

Workaround meanwhile: the local pieces in `apps/user-app/src/ui/`.
