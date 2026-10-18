# @qc/i18n

Every user-facing string in English and Urdu (right to left), for the apps, the console, the poster renderer and the server's own messages.

Owned by the **ui** lane for wording review ([brief](../../docs/agents/briefs/ui.md)); the key rules are in [`docs/engineering/i18n-keys.md`](../../docs/engineering/i18n-keys.md). Any lane adds its own keys, English and Urdu together, in the same change as the screen that uses them.

## How it is organised

The catalogue is split into parts so each app downloads only its own words, one language at a time:

| Part        | Keys                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| `shared`    | `app.*`, `ui.*`, `errors.*`, `issues.*`, `time.*`                       |
| `admin-app` | `admin.*`                                                               |
| `console`   | `console.*`                                                             |
| `user-app`  | everything else, including `notifications.*`, `reminders.*`, `poster.*` |

Each part is `src/en/<part>.json` and `src/ur/<part>.json`. `partOf(key)` in `src/catalogue.ts` decides the part, and a test fails if a key is in the wrong part or the two languages differ.

## Urdu review

Urdu values are drafts until a native speaker reviews them. Keep the `_meta.status` marker in every `src/ur/*.json` file. Wording and voice follow [`docs/design/microcopy.md`](../../docs/design/microcopy.md).

## Commands

```sh
pnpm --filter @qc/i18n test
```
