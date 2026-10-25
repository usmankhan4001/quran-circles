# Change request: allow OpenStreetMap tiles in the web app's Content-Security-Policy

Requested by: user-app
Contract: infrastructure (Content-Security-Policy, SEC-10)
What I need: add `https://tile.openstreetmap.org` to `img-src` in the `@app` Content-Security-Policy of `infra/caddy/Caddyfile` and `infra/caddy/Caddyfile.staging`. Nothing else.
Why: with no Google Maps key set, Nearby's Map view draws a keyless street map (`apps/user-app/src/features/maps/TileMapView.tsx`) from OpenStreetMap's tile server. The browser blocks those images under the current policy, the map then counts the tiles as failed and falls back to the plain list of places, so the map never shows on the deployed web app. Phones are not affected by the policy.
Proposed change: `img-src 'self' data: blob: https://tile.openstreetmap.org https://*.googleapis.com ...` (append, keep the rest). Tiles are images only, so no `connect-src` or `script-src` change. When the Google Maps key is added and Google tiles are used, the entry can stay (it is the fallback) or go.
Affected lanes: platform (owns `infra/`; needs human approval per `ownership.md`).
Workaround meanwhile: the Map view shows the list of places with their area and distance, as before. Set `EXPO_PUBLIC_MAP_TILE_URL` to a tile host already allowed or served from our own origin to avoid the CSP change.
Note: OpenStreetMap's tile policy allows light, attributed use (the map shows "© OpenStreetMap contributors", linking to the copyright page). For heavy traffic use a commercial tile host or our own and set `EXPO_PUBLIC_MAP_TILE_URL`.
