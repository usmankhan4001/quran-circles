# @qc/user-app

The attendee app: find the nearest Quran session, register, get reminders, follow venues, read the Quran and see prayer times. One Expo codebase for iOS, Android and the PWA ([decision 0009](../../docs/engineering/decisions/0009-user-app-stack.md)).

Owned by the **user-app** lane ([brief](../../docs/agents/briefs/user-app.md)). Screens follow the UI lane's [design specs](../../docs/design/screens/), [right-to-left guide](../../docs/design/rtl-urdu-guide.md) and [accessibility rules](../../docs/design/accessibility.md).

## Layout

| Path                     | What it is                                                               |
| ------------------------ | ------------------------------------------------------------------------ |
| `src/app/`               | expo-router routes (thin: they mount screens)                            |
| `src/screens/`           | The screens; they never import the router                                |
| `src/features/`          | Feature logic, including the Quran and prayer mount (`features/content`) |
| `src/core/`, `src/data/` | Injected services, the query cache and hooks                             |
| `src/platform/`          | Storage, push, maps and other platform adapters                          |
| `scripts/dev-mock.ts`    | Local mock API for working without a backend                             |

## Run and test

```sh
pnpm --filter @qc/user-app mock                                    # mock API on :4010
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web
pnpm --filter @qc/user-app start                                   # phone or emulator
pnpm --filter @qc/user-app test
EXPO_PUBLIC_API_URL=https://<domain>/api pnpm --filter @qc/user-app export:web   # PWA build in dist/
```

Build-time settings are `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and `EXPO_PUBLIC_VAPID_PUBLIC_KEY`; all are public. Store build configuration (`app.config.ts`, `eas.json`) needs a human approval.
