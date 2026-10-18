# @qc/console

The web console for national and city admins: venues, sessions, registrations, coordinators and invites, bulk import, exports, posters, the daily ayah, the audit log and settings. A client-only React app built with Vite ([decision 0006](../../docs/engineering/decisions/0006-console-web-tooling.md)).

Owned by the **console** lane ([brief](../../docs/agents/briefs/console.md)). Bulk import and handover code need a human approval.

## Layout

| Path                           | What it is                                                 |
| ------------------------------ | ---------------------------------------------------------- |
| `src/main.tsx`, `src/App.tsx`  | Entry and routes                                           |
| `src/pages/`                   | One file per page                                          |
| `src/import/`                  | CSV bulk import: client-side dry run, then apply           |
| `src/api/`                     | The typed contract client and token handling               |
| `src/theme/`, `src/styles.css` | Theme variables from the `@qc/ui` tokens, logical CSS only |

## Run and test

```sh
pnpm --filter @qc/console dev                                         # proxies /v1 to the mock on :4010
CONSOLE_API_PROXY_TARGET=http://localhost:3000 pnpm --filter @qc/console dev   # against a local API
pnpm --filter @qc/console test
VITE_API_BASE_URL=/api pnpm --filter @qc/console build                # static build in dist/
```
