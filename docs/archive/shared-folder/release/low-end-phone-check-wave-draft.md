# Low-end phone check (staging)

**Wait for my "staging is ready" message before you start.** Staging is being updated to the redesigned app.

- Open **https://staging.doraquran.pk** in Chrome on your Android phone.
- Turn **Wi-Fi off** and use mobile data. If you have an older or cheaper phone (2–3 GB RAM), use that one.
- Start a **screen recording** before check 1 and keep it running through check 3. The recording gives the timings, so you don't need a stopwatch.
- Staging is test data only. Sign in with a **made-up number**, for example 0300 1110001, never your own.
- The sign-in code is the fixed staging code: `AUTH_FIXED_CODE` in the staging app's environment in Dokploy. No message is sent.

## The checks

| # | Do this | Good looks like |
|---|---|---|
| 1 | **First open.** Chrome ⋮ → Settings → Site settings → All sites → staging.doraquran.pk → Clear & reset. Then open the link. | Something on screen within 3 s. Home shows sessions within 6 s. |
| 2 | **Nearby.** Tap Nearby. Fling the list down fast and back up, three times. Tap Map, then go back. | The list appears within about 1.5 s. Scrolling is smooth, with no blank rows or jumps. |
| 3 | **Sign in.** My Journey → Sign in → made-up number → Send code → staging code → Skip for now. | You are back in the app, signed in, within a few seconds. |
| 4 | **A session.** From Nearby, open any session. Look at its dates. Go back. | The page opens within about 2 s, and the dates show. |
| 5 | **Quran.** Quran & Prayer → Surahs → Al-Baqarah. Scroll to the end, go back, open it again. Then turn on airplane mode and open it once more. | The first verse within 3 s. Reopening is near instant. It also opens in airplane mode. |
| 6 | **Installed app.** Turn airplane mode off. Chrome ⋮ → Add to Home screen (or Install app). Open it from the icon, close it, wait a minute, open it again. Then try once in airplane mode. | Home within 3 s. In airplane mode you see the app with an offline message, not a white screen. |
| 7 | **Urdu, biggest text.** Profile → language Urdu, text size largest. Repeat checks 1 and 5. | Right-to-left layout. No cut-off or overlapping text, and no English left on the screen. |
| 8 | **Dark mode.** Profile → Appearance → Dark. Look at Home, Nearby and the Quran page. | Everything is readable. Nothing is white-on-white or black-on-black. |

## What counts as slow or broken

- A white or empty screen for more than 6 s, or a spinner that never ends.
- A tap that does nothing for more than a second.
- Scrolling that stutters, jumps or shows blank rows.
- An error message, or the app reloading by itself.
- Cut-off, overlapping or mirrored text.

## What to send back here

1. **Your phone:** model, Android version and RAM (Settings → About phone), and whether you were on 4G or 3G.
2. **The screen recording** of checks 1 to 3.
3. **One line per check:** OK, slow or broken.
4. **A screenshot** of anything that looked wrong, with a few words on what you did just before.

The coordinator app is not part of this round: it is a store app with no web version on staging.
