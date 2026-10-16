# Brief: integration

Lane: integration (includes the test agent)
Work packages: WP11
Wave: 3
Priority: P0
Approval: reviewer agent

## Goal

Replace the mocks with the real API and prove the main flows work end to end, on the web and on real devices. This is the first time the lanes' work meets, so expect mismatches and route each one to the lane that owns it.

## You own

`tests/e2e/`.

## You must not touch

Application code. When a test fails because of a defect, record it in `tests/e2e/FINDINGS.md` and in the owning lane's status file; do not patch their code.

## Read first

`docs/engineering/gates.md` (Gate 3), `docs/product/features.md`, the frozen contracts, every lane's status file.

## Deliverables

1. **Switch-over.** Coordinate each app and the console moving from the mock server to the real API, one flow at a time, using the contract tests to catch drift.
2. **End-to-end flows** in CI, using fake providers for messaging:
   - find a session, register, and get a reminder;
   - a coordinator posts an update, it appears in the feed and a push is sent;
   - sign in with a code, as an attendee and as an invited coordinator;
   - a coordinator changes a session time and the right people are notified;
   - scope isolation: a venue coordinator cannot reach another venue's data.
3. **Tools.** Playwright for the PWA and the console, Maestro for the native apps on a simulator.
4. **PWA fallback.** Offline shell, install prompt, web push and deep links, tested on a real phone by a person.
5. **Defect routing.** A short list in `tests/e2e/FINDINGS.md` of what failed, which lane owns it, and the status.

## Definition of done

Matches Gate 3: the end-to-end flows pass in CI; the PWA installs and its shell works offline; a person has checked it on a real phone.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/e2e test
```

## Decisions to respect

Tests never call Meta, Google, Apple or an SMS service; they use the fakes. Test data is synthetic. The PWA is the fallback if store release fails.

## Stand-ins

A lane is not ready: keep its flows on the mock and mark them pending in `FINDINGS.md` rather than skipping them. No real device: run on simulators and web, and list the manual device checks for a human.
