# Email sign-in codes (Resend): setup and troubleshooting

Names only. Never put the key in the repository.

## Setup

1. In Resend, add and verify the domain `qurancircles.doraquran.pk` (its DNS records, including the MX and `send` records).
2. In the Dokploy environment for the compose project (the api and worker both read it):

| Variable            | Value                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV`           | `production`                                                                                                                                                 |
| `MESSAGING_MODE`    | `live`                                                                                                                                                       |
| `RESEND_API_KEY`    | the Resend key (required; production refuses to start without it)                                                                                            |
| `EMAIL_FROM`        | leave unset: the default is `Quran Circles <notifications@qurancircles.doraquran.pk>`. If set, it must be on the verified domain, with real `<` `>` brackets |
| `EMAIL_REPLY_TO`    | `support@qurancircles.doraquran.pk`                                                                                                                          |
| `QC_DOMAIN`         | `qurancircles.doraquran.pk`                                                                                                                                  |
| `QC_CONSOLE_DOMAIN` | `qurancircles-admin.doraquran.pk`                                                                                                                            |
| `PUBLIC_WEB_BASE`   | `https://qurancircles.doraquran.pk`                                                                                                                          |
| leave unset         | `AUTH_FIXED_CODE`, `CODE_DELIVERY_MODE`, `AUTH_PHONE_SIGN_IN`                                                                                                |

3. Migration `0015_email_sign_in` runs by itself before the API starts.
4. Smoke test: open `/sign-in`, enter an email; the 6-digit code arrives from `notifications@qurancircles.doraquran.pk` within a minute. The email loads its logo from `https://qurancircles.doraquran.pk/brand/email-logo.png`.

## If no email arrives

1. Open the api service logs in Dokploy and request a code once.
2. Look for `auth.code_send_failed`. Right after it, `code.email_failed` carries `errorCode`: `resend_http_401` is a bad key, `resend_http_403` or `resend_http_422` an unverified domain or sender, `network_error` means the container cannot reach Resend. `auth.code_requested` followed by `code.sent` means Resend accepted it: check spam and the Resend Logs page.
3. No row in the Resend Logs page means the API never called Resend: check `APP_ENV`, `MESSAGING_MODE` and the key.
4. Check that the app host resolves at all (incident 2 in [`decisions-and-incidents.md`](decisions-and-incidents.md)).

Previews of every email template, English and Urdu, are in [`email-previews/`](email-previews/index.html). Regenerate them with `pnpm --filter @qc/messaging email:previews`.
