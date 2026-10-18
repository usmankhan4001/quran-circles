# @qc/contracts

The contract every part of V2 is built against: Zod schemas for every request and response, the endpoint registry, error codes, the role-and-scope matrix, message and notification formats, a typed API client and a mock server that answers every endpoint.

Owned by the **contracts** lane ([brief](../../docs/agents/briefs/contracts.md)). Frozen at Gate 1: changes go through a [contract change request](../../docs/engineering/contracts-process.md) and a human approval.

## What is where

| Path               | What it is                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| `src/schemas/`     | The Zod schemas, grouped by area                                             |
| `src/endpoints.ts` | The endpoint registry: method, path, auth, rate-limit bucket, schemas        |
| `src/scopes.ts`    | `can` and `scopeFilter`: who may do what, and where ([SCOPES.md](SCOPES.md)) |
| `src/errors.ts`    | Error codes                                                                  |
| `src/messages.ts`  | Push and WhatsApp message formats                                            |
| `src/client.ts`    | The typed API client the apps and the console use                            |
| `src/mock.ts`      | `createMockHandler`: the mock API used by app tests and local development    |
| `src/fixtures.ts`  | Synthetic fixture data (also the source of the database seed)                |
| `openapi.json`     | Generated OpenAPI document (`pnpm --filter @qc/contracts gen`)               |
| `CHANGELOG.md`     | Contract versions and what changed                                           |

## Commands

```sh
pnpm --filter @qc/contracts test
pnpm --filter @qc/contracts gen        # regenerate openapi.json and SCOPES.md
pnpm --filter @qc/contracts mock       # run the mock server
```
