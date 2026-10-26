# Security policy

Quran Circles stores phone numbers and registration details for real people, so security reports are taken seriously.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private reporting instead: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it and what an attacker could do with it. Do not include real personal data; use synthetic data.

You can expect an acknowledgement within a few days. Fixes for sensitive areas (sign-in, scope checks, account deletion, WhatsApp, migrations, personal data) need a human review before they merge; see [`docs/engineering/ownership.md`](docs/engineering/ownership.md).

## What is in scope

- The API, worker, poster renderer, user app, admin app and console in this repository.
- The deployment files in [`infra/`](infra/) and the CI workflow in [`.github/`](.github/).

Out of scope: problems in third-party services we use (Meta WhatsApp Cloud API, FCM, APNs, Dokploy, Cloudflare); report those to the provider.

## If you find a secret in the repository

Tell us privately as above. Do not rewrite history yourself. The credential must be revoked or rotated first; removing the file from the repository does not make it safe.

## For contributors

The rules that keep secrets and personal data out of the code are in [CONTRIBUTING.md](CONTRIBUTING.md#never). Security findings from reviews and the load and scope tests are kept in [`docs/security/`](docs/security/).
