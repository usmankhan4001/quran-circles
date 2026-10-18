# @qc/e2e

End-to-end tests against the real stack: a private Postgres, the API, the worker and the web builds of the PWA, the admin app and the console, driven by Playwright. Synthetic data and fake messaging only; browsers reach nothing but loopback.

Owned by the **integration** lane ([brief](../../docs/agents/briefs/integration.md)). What the suite found is in [FINDINGS.md](FINDINGS.md).

## Commands

```sh
pnpm e2e                                                  # start the stack, run every project, stop
pnpm --filter @qc/e2e test:api                            # API flows only
pnpm --filter @qc/e2e test:web                            # PWA, console and admin app
pnpm --filter @qc/e2e stack                               # keep a stack running
E2E_REUSE_STACK=1 pnpm --filter @qc/e2e test              # run against the running stack
```

| Path           | What it is                                                              |
| -------------- | ----------------------------------------------------------------------- |
| `src/stack/`   | Starts and stops Postgres, the API, the worker and a static server      |
| `src/flows/`   | Flows per project: `api`, `pwa`, `console`, `admin-app`                 |
| `src/quality/` | Opt-in low-end budget and accessibility/RTL checks (quality lane, WP12) |
| `src/support/` | Shared helpers                                                          |

The suite is kept out of `pnpm check` because it starts real services.
