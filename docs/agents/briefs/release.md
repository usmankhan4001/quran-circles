# Brief: release

Lane: release
Work packages: WP13
Wave: 6
Priority: P0
Approval: human, for every release step

## Goal

Get V2 to people safely: a pilot city, the store listings and forms, staged rollouts, coordinator onboarding, and the retirement of V1 including the key rotation that was deferred to launch. Agents prepare; humans press every button that touches production or a store.

## You own

`docs/release/` (create it in Wave 6).

## You must not touch

Application code and infrastructure. Release steps use what the other lanes built.

## Read first

`docs/engineering/gates.md` (Gate 6), `docs/product/decisions.md` (migration, V1 retirement), `infra/RUNBOOK.md`, the V2 Plan's risks and open items.

## Deliverables

1. **Pilot plan.** One pilot city, a few coordinators, what they will do each day, how feedback is collected, and the exit criteria. Pilot coordinators complete their daily tasks without help.
2. **Urdu training material.** A short guide for coordinators, written with the native Urdu reviewer, covering sign-in, today's registrants, posting an update, changing a time and marking attendance.
3. **Store listings.** English and Urdu text and screenshots for Apple and Google. Privacy and data-safety forms, age rating, and the in-app account deletion description. Use the owner's organisation accounts.
4. **Test tracks.** Internal and closed test builds through TestFlight and Google's test tracks, then review submission.
5. **Staged rollout.** Release the PWA first, then each store app with a percentage rollout and a way to halt it.
6. **Rollback rehearsal.** Rehearse rolling back the stack and halting a store rollout, and record the steps.
7. **Support.** A support channel, an owner for answering it, and a Ramadan on-call list.
8. **V1 retirement.** After the pilot passes and migrated data is checked: redirect the old domain to the Dora section; rotate the exposed database password and push keys; remove the committed key files from the repository; archive V1. List the exact commands and who runs each.

## Definition of done

Matches Gate 6: pilot coordinators manage without help; store forms are accepted; a rollback has been rehearsed; V1 data is migrated and checked. Then a human completes the V1 retirement checklist.

## Commands that must pass

```sh
pnpm check
```

## Decisions to respect

The PWA ships first and is the fallback. V1 stays live until the pilot passes. The exposed V1 credentials are rotated at this step, and not before. WhatsApp subscribers are asked to opt in again, and push subscriptions are not carried over.

## Stand-ins

Accounts not ready: prepare listings and forms as documents and wait. No pilot city named: write the plan with placeholders and ask the orchestrator.
