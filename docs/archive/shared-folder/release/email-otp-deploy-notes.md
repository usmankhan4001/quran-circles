# Email sign-in code: deploy notes

Branch `lane/auth/email-otp`, commit `2df9cdf`, on GitHub (not merged; no PR). Base: `eb5c095`.
Full write-up: `docs/engineering/change-requests/2026-10-25-email-otp.md` on the branch.

## Migration

`packages/db/migrations/0015_email_sign_in.up.sql` (with a `.down.sql`). It runs by itself on deploy:
the `migrate` one-shot service runs before the api and worker start (production compose file).
Backward compatible: existing phone accounts keep working; nothing is dropped.

## Dokploy environment (api and worker)

| Variable             | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| `RESEND_API_KEY`     | the Resend key (required; production refuses to start without it)      |
| `EMAIL_FROM`         | optional; default `Quran Circles <notifications@qurancircles.doraquran.pk>` |
| `EMAIL_REPLY_TO`     | optional, e.g. `support@qurancircles.doraquran.pk`                     |
| `AUTH_PHONE_SIGN_IN` | leave unset (WhatsApp sign-in off)                                     |
| `QC_DOMAIN`          | `qurancircles.doraquran.pk` (with an s)                                |
| `QC_CONSOLE_DOMAIN`  | `qurancircles-admin.doraquran.pk`                                      |
| `PUBLIC_WEB_BASE`    | `https://qurancircles.doraquran.pk`                                    |

The Resend key that was pasted in chat should be rotated after launch.

## Outside the repo (owner)

- Dokploy domains, Cloudflare tunnel hostnames, Google Maps key referrers, Play Console URLs and
  Firebase authorised domains: the app host is now `qurancircles.doraquran.pk`.
- Inbound mail routing for `support@` and `privacy@qurancircles.doraquran.pk` (e.g. Cloudflare
  Email Routing); both appear on the store listing and privacy page.
- Google Play reviewers still need a way to sign in (reviewer allowance, its own change).

## Smoke test after deploy

Open `https://qurancircles.doraquran.pk/sign-in`, enter your email, confirm a 6-digit code arrives
from `notifications@qurancircles.doraquran.pk` within a minute, and that it signs you in (a new
account asks for the WhatsApp number on the sign-up screen first).

## Checks on the branch

- Typecheck: clean across the workspace.
- Lint: clean.
- Tests: contracts 1997, db, messaging 251, api 804, user-app 1189, admin-app 895, console 518,
  i18n 40, ui 1117, all passing. `apps/poster-renderer` browser tests fail on the base commit
  too (need a browser; unrelated).
- Prettier: 6 files in `packages/content` were already unformatted on the base commit; untouched.
- End-to-end suites were updated for email sign-in but not run here (need the full stack).
