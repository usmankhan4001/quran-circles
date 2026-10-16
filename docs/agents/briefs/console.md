# Brief: console

Lane: console
Work packages: WP7 (Wave 2), WP15 (Wave 4), WP19 console part (Wave 7)
Wave: 2
Priority: P0 for WP7, P1 for WP15, P2 for WP19
Approval: reviewer agent, UI review, human for bulk import and handover code

## Goal

The desktop web console for admins. In Wave 2 it is the minimum: coordinator invites, bulk import of venues and sessions, and registration exports. In Wave 4 it grows into reports, message templates, coordinator handover, the content manager, the audit view and the spend dashboard.

## You own

`apps/console/`.

## You must not touch

`packages/*` (use them as they are; send change requests), other apps.

## Read first

`docs/product/features.md`, `docs/product/decisions.md`, `docs/design/screens/` (console screens), the frozen `packages/contracts` and its mock server.

## Deliverables

Wave 2 (WP7):

1. **App init.** React with Vite and TypeScript. Use the generated API client from `@qc/contracts` and the tokens from `@qc/ui` (tokens only; the console does not share the React Native components). Record the choices in a decision record.
2. **Sign-in** with the contract's endpoints, and a scope-aware shell that shows only what the role allows.
3. **Coordinator invites.** Invite by phone number with a city or venue scope, list pending and active coordinators, revoke.
4. **Bulk import.** CSV of venues and sessions with a validation report and a dry run first. Nothing is written until the person confirms. Duplicates are caught.
5. **Registration exports.** CSV per session, venue or city, in scope. Exports include personal data, so each one is audited.

Wave 4 (WP15):

6. **Reports.** Registrations by city, venue and day; active users and opens; notification delivery and opens; attendance trends; sign-up funnel; coordinator response time; data quality; Dora to Circles conversion.
7. **Message templates.** Admins keep approved Urdu and English wording with placeholders.
8. **Coordinator handover.** Reassign a venue or circle with its history intact. The previous coordinator loses access at once.
9. **Content manager.** Edit About, FAQ and help pages in English and Urdu, with draft and publish.
10. **Audit view** and the **spend dashboard** from the messaging lane's report data.

Wave 7 (WP19): demand map and threshold settings.

## Definition of done

- A coordinator never sees data outside their scope in the console.
- Import is dry-run first and cannot partially apply by accident.
- Every export writes an audit row.
- English and Urdu, right-to-left, light and dark, keyboard navigable, with empty and error states.
- Screens match the ui lane's specs, with a design review.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/console typecheck
pnpm --filter @qc/console test
```

## Decisions to respect

Reports, bulk work and exports live here, not in the admin app. Coordinators see registrants' numbers; exports are audited. Reports replace the Excel summary records.

## Stand-ins

API not ready: use the mock server. Tokens not published yet: wait for the ui lane's first release.
