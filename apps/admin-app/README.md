# @qc/admin-app

The coordinator app: post an update, change a session time, create or edit a venue or circle, see today's registrants and mark attendance from a phone. Same Expo stack as the user app ([decision 0010](../../docs/engineering/decisions/0010-admin-app-stack.md)).

Owned by the **admin-app** lane ([brief](../../docs/agents/briefs/admin-app.md)). Screens follow the UI lane's [design specs](../../docs/design/screens/), [right-to-left guide](../../docs/design/rtl-urdu-guide.md) and [accessibility rules](../../docs/design/accessibility.md).

## Layout

| Path              | What it is                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/app/`        | expo-router routes                                                                                             |
| `src/features/`   | One folder per task: post-update, schedule, venues, circles, attendance, registrants, posters, daily-ayah, ... |
| `src/api/`        | `useQuery` and `useMutation` over the typed contract client                                                    |
| `src/scope/`      | Turns the signed-in person's roles into what the screens may show                                              |
| `src/navigation/` | Routes and the injected `Navigation`                                                                           |

Registrant lists are shown to the session's coordinator only; bulk export stays in the console.

## Run and test

```sh
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/admin-app web     # against the mock
pnpm --filter @qc/admin-app start
pnpm --filter @qc/admin-app test
```
