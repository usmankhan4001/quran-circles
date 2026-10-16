# Change request: refresh-token grace window and precise reuse detection

Requested by: auth-scopes
Contract: schema (`auth_sessions`)
What I need: two nullable columns on `auth_sessions` so a rotated refresh token is remembered for one step.
Why: today a refresh swaps the stored hash in place, so a token that no longer matches its session cannot be told apart from a forged one that only knows the session id (which is readable inside the access token). The lane therefore treats every mismatch as reuse and revokes the session. That has two costs. A phone that loses the response to a refresh and retries with the old token, or a PWA with two tabs refreshing at once, is signed out. And anyone holding a leaked access token can revoke that session by sending a made-up refresh token. Both are small, but the first one will happen on mobile networks.
Proposed change: add `previous_refresh_token_hash text NULL` and `rotated_at timestamptz NULL` to `auth_sessions`. On refresh, move the current hash into `previous_refresh_token_hash` and set `rotated_at`. Then: a token matching the current hash rotates as now; a token matching the previous hash within 10 seconds of `rotated_at` gets the same new pair again (a retry); a token matching the previous hash after that is reuse and revokes the session; a token matching neither is simply invalid and revokes nothing. The reverse migration drops the columns.
Affected lanes: contracts (db), auth-scopes.
Workaround meanwhile: any mismatch revokes the session (implemented and tested). Clients must send one refresh at a time (single-flight) and must not retry a refresh whose response was lost without signing in again.
