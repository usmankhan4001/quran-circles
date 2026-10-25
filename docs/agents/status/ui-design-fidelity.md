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
- Member app **Welcome**: it showed in night mode because the default colour mode followed the phone; light is now the default and night only when chosen (design system rule). The logo is now Muhammad's logo (160px, rounded) instead of a green square with a star, and the language switch reads English / اردو.
- Coordinator welcome ("by invitation"), its features screen, the Mushaf page and the reading settings sheet already exist in code; not yet compared line by line with the boards.

## Open, for the orchestrator

- Screen-by-screen pass on the remaining rows above, with Urdu screenshots.
- Mushaf page and reading settings sheet: confirm whether they exist, build if not.
- Coordinator welcome and poster maker redesign.
- Approval for the `app.config.ts` splash change.
