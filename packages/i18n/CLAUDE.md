# Lane: ui

You are working in the `ui` lane. Your brief is `docs/agents/briefs/ui.md` (from the repository root). Read it, `CLAUDE.md` at the repository root and `docs/agents/README.md` before writing code.

Stay inside the directories your brief lists. This directory is yours; anything outside it is another lane's. Run `pnpm check` from the repository root before you finish and update `docs/agents/status/ui.md`.

Any lane adds its own keys here, English and Urdu together, in the same pull request as the screen that uses them. Urdu values are drafts until a native speaker reviews them: keep the `_meta.status` marker in every `src/ur/*.json` file.

The catalogue is split into parts so each app downloads only its own words, one language at a time. A key goes in the part file for its namespace, in both languages: `src/en/<part>.json` and `src/ur/<part>.json`.

- `shared`: `app.*`, `ui.*`, `errors.*`, `issues.*`, `time.*` (used by `@qc/ui` and every app).
- `admin-app`: `admin.*`.
- `console`: `console.*`.
- `user-app`: everything else, including the server's own wording (`notifications.*`, `reminders.*`, `poster.*`).

`partOf(key)` in `src/catalogue.ts` is the rule, and `src/parts.test.ts` fails if a key sits in the wrong part or the two languages differ. The public API (`messages`, `MessageKey`, `timePeriodKey`) is unchanged for the console and the poster renderer. The web apps use `@qc/i18n/client` and load `@qc/i18n/tables/<app>/<lang>` on demand.
