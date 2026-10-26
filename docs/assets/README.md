# Images for the GitHub page

Used by [`README.md`](../../README.md) and the repository settings. Every screen shows synthetic demo data (fictional venues such as Masjid Bilal in Johar Town); none shows a real phone number or person.

| File                        | Use                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `banner.svg`                | Top of the README. 1280x320, text outlined to paths so it needs no fonts.                            |
| `logo.png`                  | 256 px copy of `tools/store-assets/source/quran-circles-logo-master.png`.                            |
| `social-preview.png`        | 1280x640. Upload by hand in GitHub > Settings > General > Social preview; the API cannot set it.     |
| `screenshots/{en,ur}-*.png` | Home, Nearby, Session and Quran screens of the user app, English and Urdu (right to left), 780x1688. |

## How the screenshots were made

Headless Chrome through Playwright, viewport 390x844 at device scale 2, light appearance, against the contract's mock API and the user app's web build (see [`tools/store-assets/README.md`](../../tools/store-assets/README.md) for the servers). `tools/store-assets/capture/capture.cjs` has not kept up with the current screens, so a fresh capture needs its selectors updated first. Keep each PNG under 350 KB and take new captures only from the mock API.
