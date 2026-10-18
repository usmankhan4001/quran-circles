# @qc/poster-renderer

Renders session posters and share cards: story size, A4 and A3 print PDFs and the link preview image, bilingual, with a QR code and Urdu set in Mehr Nastaliq. It lays out each poster in headless Chromium ([decision 0012](../../docs/engineering/decisions/0012-poster-urdu-rendering.md)). Only the worker calls it; it has no route to the internet or the database.

Owned by the **renderer** lane ([brief](../../docs/agents/briefs/renderer.md)).

## Layout

| Path              | What it is                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| `src/main.ts`     | HTTP server entry (port `RENDERER_PORT`, default 8090)                    |
| `src/renderer.ts` | Chromium page setup and capture                                           |
| `src/templates/`  | The poster templates (`cloud`, `night`; demo designs, marked provisional) |
| `src/cli/`        | `render-sample.ts`, which writes sample posters to disk                   |
| `assets/fonts/`   | Unmodified font copies with their [licences](assets/fonts/LICENSES.md)    |

## Run and test

```sh
pnpm --filter @qc/poster-renderer test           # renders with real headless Chromium
pnpm --filter @qc/poster-renderer start
pnpm --filter @qc/poster-renderer render:sample
```

If Chromium is missing: `pnpm --filter @qc/poster-renderer exec playwright-core install --only-shell chromium`. Outside development it requires `RENDERER_TOKEN` on every request.
