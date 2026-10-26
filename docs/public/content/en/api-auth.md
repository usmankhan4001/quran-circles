---
title: Sign-in and tokens
description: The WhatsApp code sign-in, access and refresh tokens, signing out.
section: api
order: 20
---

# Sign-in and tokens

Members sign in with a six-digit code sent to a Pakistani mobile number on WhatsApp. There are no passwords. Staff sign in the same way; their role comes from an assignment on their account, not from a different login.

## The flow

1. **Ask for a code.** `POST /v1/auth/code` with the phone number. The answer is `202` with a `challengeId`, the channel used, when the code expires and how long to wait before asking again (`resendAfterSeconds`).
2. **Verify.** `POST /v1/auth/verify` with the `challengeId` and the code. The answer is `200` with an access token, a refresh token, their expiry times, the person's profile (`me`) and `isNewAccount`.
3. **Call the API** with `Authorization: Bearer <accessToken>`.
4. **Refresh.** When the access token is about to expire, `POST /v1/auth/refresh` with the refresh token to get a new pair.
5. **Sign out.** `POST /v1/auth/sign-out` revokes this sign-in.

```bash
# 1. ask for a code
curl -s -X POST {{API_BASE}}/v1/auth/code \
  -H "Content-Type: application/json" \
  -d '{"phone":"+923001234567","locale":"en"}'

# 2. verify it (the challengeId comes from step 1)
curl -s -X POST {{API_BASE}}/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"00000000-0000-4000-8000-000000000001","code":"123456","deviceLabel":"Android phone"}'
```

## Rules to design around

- **Pakistani mobile numbers only.** A number must be `+923` followed by nine digits. Any other number fails with `validation_failed` and the issue code `phone_not_pakistan_mobile`, before anything is sent.
- **A code lives five minutes** and allows five tries. After that the person asks for a new code.
- **Limits apply** per number and per client address, and the service has overall ceilings. Over a limit the answer is `rate_limited` with `retryAfterSeconds` and a `Retry-After` header. Wait that long. Do not retry in a loop.
- **Delivery.** The code goes by WhatsApp. SMS is a fallback that is switched on only when a gateway is configured; a person whose number is not on WhatsApp cannot sign in without it.

## Tokens

| Token         | Lifetime                                                        | Notes                                                                                   |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Access token  | 15 minutes                                                      | Sent as a Bearer token. It holds no personal data. Expiry is in `accessTokenExpiresAt`. |
| Refresh token | 30 days, renewed on every refresh (see `refreshTokenExpiresAt`) | Single use. Every refresh returns a new one.                                            |

**Rotation.** Store the newest refresh token every time. Sending a refresh token that was already used signs that device out (`refresh_token_invalid`), because it may have been copied. When refresh fails, send the person back to the code step.

**Expiry.** A call with an expired access token fails with `token_expired` (401): refresh, then repeat the call once. A missing or bad token is `unauthenticated` (401).

**Storage.** Keep tokens in the platform's secure storage. On the web they must never go in a URL, a log or analytics.

## Accounts and deletion

- A person can have the account and all personal data deleted: `DELETE /v1/me`. Only anonymised counts remain. The last national admin cannot be deleted (`last_national_admin`); someone else is made admin first.
- Revoking a role takes effect on the next request, because roles are read on every call and are not in the token.
- A suspended account gets `account_suspended` (403).

See [roles and permissions](api-roles.md) for what a signed-in person can reach.
