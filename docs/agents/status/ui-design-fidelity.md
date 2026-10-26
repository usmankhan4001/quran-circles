# Lane ui, design fidelity (branch `lane/ui/design-fidelity`)

Source of truth: the 25 Oct 2026 boards. Design system `UEFqRavqK4aJmgkkWJJJLp`, member app `PuCDBi5Z9h7zagkmfmRPov`, coordinator app `Ga647gtt1xCiqqR758LevV`, console `JQBKsY1Ke42KQLNZ5Cvaae`, states `DDni9Bv9UzNL8ewm7Vt7Nm`. All five opened. The design system itself specifies Plus Jakarta Sans, so the kit already on `main` (flat white, green `#0A6938`, hairline cards) matches it; the older 22 artifacts (green hero fade, Figtree) are not the target.

## Gap list (checked against the running member app in English; other rows from code review)

| Area                          | State                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Member Home, Nearby (list)    | Match: large plain title, hairline cards, big time, star on the portion line. Checked in the running app.                                    |
| Member tab bar                | **Differed** (flat bar, all labels). **Fixed:** floating pill, sliding capsule, label on the chosen tab, fade between tabs, reduced motion.  |
| Coordinator app tab bar       | Same kit bar, so it has the floating pill too. Its header is already flat (`FlatHeader`), no green band.                                     |
| Console                       | White sidebar shell already. Not re-checked screen by screen.                                                                                |
| App icon                      | Already Muhammad's logo on white (`public/icons/icon-1024.png`).                                                                             |
| Splash                        | **Was missing.** Added a white splash with the big logo in `app.config.ts`. Needs human approval (store build configuration).                |
| Web manifest and theme colour | **Were off-brand** (`#fdfcf6`, `#064e3b`). Now `#ffffff` and `#0A6938`.                                                                      |
| Urdu face                     | Kit font stack already lists Noori Nastaleeq first with Noto Nastaliq as fallback. Noori file not supplied yet.                              |
| Not yet compared              | Mushaf page and reading settings screens, coordinator welcome ("by invitation"), poster maker, states boards, Urdu screens, console screens. |

## Owner decisions

- **Floating pill tab bar stays.** Muhammad: "i need the floating bar". This deviates from the boards, which show a flat labelled bar (design system TabBar, TabBar README). The pill is the default in `packages/ui` `TabBar`, used by the member and coordinator apps. Earlier messages asking for the flat bar, or for a flag, are superseded. The bar lives only in the tab layout, so Mushaf, reader, full map, sign-in, sign-up, Welcome and Features do not show it.
- **Sign-in, sign-up and code screens**: identity fields and auth logic belong to lane `lane/auth/email-otp` (email code via Resend plus a required WhatsApp number). This branch does not touch them, so the two merge cleanly.
- Plus Jakarta Sans stays (the design system specifies it). The splash change stays on the branch for Muhammad to review.

## Done

- `packages/ui` TabBar rebuilt as a floating pill (see above); `redesign-kit.test.tsx` updated for it.
- `apps/user-app` tabs fade on switch unless reduced motion is on.
- Splash and web colours (above).
- Member app **Welcome**: it showed in night mode because the default colour mode followed the phone; light is now the default and night only when chosen (design system rule). The logo is now Muhammad's logo (160px, rounded) instead of a green square with a star, and the language switch reads English / Ø§Ø±Ø¯Ùˆ.
- Coordinator welcome ("by invitation"), its features screen, the Mushaf page and the reading settings sheet already exist in code; not yet compared line by line with the boards.

## Open, for the orchestrator

- Screen-by-screen pass on the remaining rows above, with Urdu screenshots.
- Mushaf page and reading settings sheet: confirm whether they exist, build if not.
- Coordinator welcome and poster maker redesign.
- Approval for the `app.config.ts` splash change.

## Decisions waiting for a human

- **Quran translations.** The reading settings board offers Sahih International and Pickthall; the app offers Maududi. Quran text and translation sources are a human decision, so this branch leaves them as they are.
- **Jameel Noori Nastaleeq.** Muhammad's installed copy (`Jameel Noori Nastaleeq.ttf`, version 2; 2009, vendor Urdu Lover, licence text "free of charge for Urdu Lovers") cannot be subset below about 6.8 MB woff2 (13.4 MB ttf), because the size is the Nastaliq ligature glyphs. Nothing is registered or committed yet. Options: serve the woff2 from our own server (recommended), Noto Nastaliq only on web with Noori in native builds, or commit the woff2. Redistribution in store builds still needs his confirmation.
- **Mushaf and reading settings** were checked against the spec: card, meta row, banner, justified text, markers, pager and every settings row match; text is now 27px on a 2.35 line and the labels read Layout and Script.

## Not yet done

Poster maker, console screens, Urdu RTL screenshots, and the empty/offline/error and map states.

## Final state of this branch

### Done

- Floating pill tab bar (owner decision, deviates from the boards): sliding capsule, label fade, tab fade, reduced motion, right-to-left placement fixed.
- Light is the default appearance in the member app, coordinator app and console. "Same as phone" follows the phone only when picked; High contrast stays after the three options.
- Member Welcome: Muhammad's logo, native language labels. Profile language reads اردو.
- White splash with the big logo, web manifest colours (`apps/user-app/app.config.ts`, needs human approval as store build configuration).
- Mushaf text 27px on a 2.35 line; settings labels Layout and Script.
- Jameel Noori Nastaleeq is the primary Urdu font: full TTF in the native builds, 6.8 MB subset WOFF2 on the web (hashed `/assets/` file, one-year immutable cache already in `infra/caddy`, `font-display: swap`, preload only on Urdu pages), Mehr Nastaliq Web is the face that shows first and while it downloads. Credits entry and licence notes in `packages/ui/assets/fonts/LICENSES.md`. Muhammad supplied it, confirmed its use and accepts the licence ("free of charge for Urdu Lovers"). Redistribution in store builds is his decision.
- Tests were run in this branch up to the font commit (ui 1118, i18n 40, user-app 1186, admin-app 894, console 516 all passing). After the final merge only typecheck was run, by request.

### Follow-up (not done)

- Compare and fix: Session, Join pledge, coordinator Today, console Sessions and Sign in, the rest of the Urdu (right-to-left) screens, the empty/offline/error and map states, the poster maker redesign.
- Poster renderer still embeds Mehr Nastaliq Web only: adding Jameel would put a 6.8 MB data URL into every rendered page and needs its own checksum and browser-test changes. Decide whether posters should use Jameel.
- Home with no city chosen: restyle the "Choose city" prompt as a quiet hairline card (decided, not done).
- Email logo: the template on `lane/messaging/email-templates` points at `/brand/email-logo.png`, which production does not serve yet (it returns an HTML page). Deploy that branch's file, or set `QC_EMAIL_LOGO_URL` and re-publish the Resend template.
- Email templates use no font file, so nothing to change there.
- Sign-in, sign-up and code screens belong to the email-code lane; no `lane/auth/email-otp` branch was on the remote when checked.
- Maududi vs Pickthall translations and the board's Sahih International choice: human decision.
