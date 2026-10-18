# Store assets generator

Scripts that make the app icons and the App Store and Google Play screenshots from the logo and the running user app. They are run by hand, not by `pnpm check`, and are not a workspace package. The finished images (every icon size, all screenshots, a contact sheet) were delivered in the project's shared folder (`store-assets/`); the icons the apps use are already committed in `apps/user-app/public/icons` and `apps/admin-app/assets/icon`.

The store listing text is in [`docs/release/store-listing.md`](../../docs/release/store-listing.md).

| Path                                   | What it is                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `source/quran-circles-logo-master.png` | The logo as supplied by the owner (668×648, white background). Every icon is generated from it.  |
| `make_icons.py`                        | iOS, Android (legacy and adaptive), web, PWA and store icons; `admin` variant adds the amber tag |
| `capture/`                             | Playwright captures of the user app's web build against the mock API                             |
| `add_status_bar.py`                    | Adds an iPhone-style status bar to the captures                                                  |
| `mockups/`                             | Frames the captures with headlines (`config.json`) for each store size, plus the feature graphic |

## Regenerate

```sh
# icons (Python 3, Pillow, numpy); writes build/icons and build/icons-admin
python3 tools/store-assets/make_icons.py
python3 tools/store-assets/make_icons.py tools/store-assets/source/quran-circles-logo-master.png tools/store-assets/build/icons-admin admin

# captures: start the mock API and the user app's web build first
pnpm --filter @qc/user-app mock
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web   # serves on :8081
cd tools/store-assets/capture
PLAYWRIGHT_MODULE=<path to playwright> CHROMIUM_PATH=<chromium> node capture.cjs en-US ../build/raw/en 3
PLAYWRIGHT_MODULE=<path to playwright> CHROMIUM_PATH=<chromium> node capture.cjs ur-PK ../build/raw/ur 3
cd ../../..
python3 tools/store-assets/add_status_bar.py tools/store-assets/build/raw tools/store-assets/build/current

# framed screenshots and feature graphic (Node 22, Playwright with Chromium)
CHROMIUM_PATH=<chromium> node tools/store-assets/mockups/build.mjs \
  --input tools/store-assets/build/current --out tools/store-assets/build/screenshots \
  --playwright <path to playwright>
```

Sizes: App Store 6.9" 1320×2868 (required), 6.5" 1284×2778, iPad 13" 2064×2752 (required while the app declares tablet support), Google Play phone 1080×1920 and feature graphic 1024×500.

## Known limits

- The master is 668 px, so the 1024 icon is upscaled about 1.5×. A vector or 2048 px master would make it sharper: replace the file in `source/` and re-run.
- The Quran reader and the map need the Quran text source and a Google Maps key, so the screenshots show the Quran tab and the Nearby list instead.
- The iPad images put the phone screens on an iPad canvas. Real iPad captures are better, or turn off tablet support in `apps/user-app/app.config.ts`.
- Urdu headlines (`mockups/config.json`) and the listing need a native proofreader.
