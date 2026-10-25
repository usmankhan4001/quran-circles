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

## Done

- `packages/ui` TabBar rebuilt as a floating pill (see above); `redesign-kit.test.tsx` updated for it.
- `apps/user-app` tabs fade on switch unless reduced motion is on.
- Splash and web colours (above).

## Open, for the orchestrator

- Screen-by-screen pass on the remaining rows above, with Urdu screenshots.
- Mushaf page and reading settings sheet: confirm whether they exist, build if not.
- Coordinator welcome and poster maker redesign.
- Approval for the `app.config.ts` splash change.
