# Change request: remember the language of a new account

Requested by: auth-scopes
Contract: schema (`otp_challenges`)
What I need: a `locale` column on `otp_challenges` (`en` | `ur`, default `ur`).
Why: `RequestCodeBody.locale` says which language the person is using when they ask for a code. A brand-new account should start in that language, but the challenge row does not keep it, so verification cannot pass it on to `users.locale`.
Proposed change: add `locale text NOT NULL DEFAULT 'ur'` with the usual enum check to `otp_challenges`. The lane then copies it to `users.locale` when it creates an account.
Affected lanes: contracts (db), auth-scopes.
Workaround meanwhile: new accounts start with the column default (`ur`). The app sends the person's language with its first profile update.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.

Applied in api 2026-10-17: `auth.requestCode` writes `otp_challenges.locale`; a new account takes it as `users.locale`.
