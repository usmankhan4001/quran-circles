# Store assets: Quran Circles

| Folder | What |
| --- | --- |
| `source/quran-circles-logo-master.png` | The logo as supplied (668×648). Every icon is generated from it. |
| `icons-admin/` | The same set for the coordinator app, with the amber ADMIN tag (`make_icons.py <master> <out> admin`). |
| `icons/` | iOS (`ios/`, with Xcode `Contents.json`), Android legacy mipmaps and adaptive layers (`android/`), web and PWA incl. maskable and favicon (`web/`), store icons (`store/`). `manifest.json` lists every file. |
| `screenshots-provisional-design/` | The first set, built from the design showcase. Kept for reference only; do not upload. |
| `screenshots/` | `app-store/<en,ur>/<ios-6.9, ios-6.5, ipad-13>/` and `play/<en,ur>/play-phone/` plus `play/<en,ur>/feature-graphic-1024x500.png`. |
| `screenshots-input/` | The screens the mockups are made from. `raw-captures/en` and `raw-captures/ur` are captures of the running user app (web build, mock API, demo data, 1170×2370); `current/` is the same with a status bar added (`generator/add_status_bar.py`). `provisional-design-artboards/` are the old showcase artboards. |
| `listing/store-listing.md` | Title, subtitle, keywords, descriptions in English and Urdu (drafts). |
| `generator/` | `make_icons.py` (icons) and `mockups/` (screenshots and feature graphic). |
| `contact-sheet.png` | Overview of all of the above. |

## Status

- **Icons: ready**, with one caveat: the master is 668 px, so the 1024 icon is upscaled about 1.5×. A vector or 2048 px master would make it sharper; drop it into `source/` and re-run.
- **Screenshots: from the real app.** Captured from the redesigned user app on 2026-10-18 (main at 2e0e207) with the mock API's demo data. Demo labels such as "Sample" are stripped and the account name shows as "Ahmed Raza"; nothing else is altered. The Quran reader page is not included: its text comes from an online source this environment cannot reach, so screen 05 is the Quran tab instead. The map view needs the Maps key, so Nearby shows the list.
- **iPad 13":** those images put the phone screens on an iPad canvas. If Apple asks for real iPad captures, either capture the app at iPad size or turn off tablet support in `app.config.ts`.
- **Urdu text: needs native proofreading** (headlines in `generator/mockups/config.json`, listing in `listing/`).

## Regenerate

```sh
# icons (Python 3 + Pillow + numpy)
python3 generator/make_icons.py

# captures: run the mock API (pnpm --filter @qc/user-app mock) and the web app on :8081
# (EXPO_PUBLIC_API_URL=http://localhost:4010 npx expo start --web), then, from generator/capture:
#   PLAYWRIGHT_MODULE=<playwright path> CHROMIUM_PATH=/opt/pw-browsers/chromium node capture.cjs en-US <dir> 3
#   (and ur-PK); then python3 generator/add_status_bar.py screenshots-input/raw-captures screenshots-input/current
# screenshots (Node 22 + Playwright with Chromium)
CHROMIUM_PATH=/opt/pw-browsers/chromium node generator/mockups/build.mjs \
  --input screenshots-input/current --out screenshots \
  --playwright <repo>/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright
```

Sizes produced: App Store 6.9" 1320×2868 (required), 6.5" 1284×2778, iPad 13" 2064×2752 (required while the
app declares tablet support; real iPad captures are better there), Google Play phone 1080×1920 and
feature graphic 1024×500.
