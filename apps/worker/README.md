# @qc/worker

Background jobs and everything that leaves the system: reminders, push notifications, WhatsApp messages and their delivery webhook, poster renders, the daily occurrence top-up, the morning ayah of the day and sign-in cleanup. Jobs run on pg-boss in the same Postgres database.

Owned by the **messaging** lane ([brief](../../docs/agents/briefs/messaging.md)).

## Layout

| Path               | What it is                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- |
| `src/main.ts`      | Entry point: reads the config, starts pg-boss, the dispatchers and the HTTP server |
| `src/config.ts`    | Every setting, validated with Zod (names in [`infra/ENV.md`](../../infra/ENV.md))  |
| `src/outbox/`      | Claims `message_outbox` rows, checks consent and caps, sends, records the result   |
| `src/reminders/`   | Reminders before each session occurrence                                           |
| `src/occurrences/` | Keeps recurring sessions scheduled ahead                                           |
| `src/ayah/`        | The morning ayah of the day push                                                   |
| `src/posters/`     | The `poster-render` queue: calls the renderer and stores the files                 |
| `src/whatsapp/`    | The WhatsApp webhook (verification, signatures, delivery status)                   |
| `src/auth/`        | Daily sign-in cleanup                                                              |

How messages flow is in [decision 0005](../../docs/engineering/decisions/0005-messaging-outbox-and-providers.md).

## Run and test

```sh
pnpm --filter @qc/worker test
```

To run it locally, with fake providers, see [Getting started](../../docs/getting-started.md#4-worker-optional). It serves `/healthz` on `WORKER_HTTP_PORT` (default 8081).
