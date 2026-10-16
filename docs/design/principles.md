# Design principles

Written by the ui lane. A human reviews this page, the tokens and the catalog (the design review in `docs/agents/briefs/ui.md`). Product context is in `docs/product/experience.md`.

## 1. Warm, calm and respectful

The app serves a place of worship and learning. It should feel like a quiet, well-kept room.

- Emerald and parchment carry the brand. Large areas are parchment (light) or deep slate (dark); emerald marks the one thing to do next.
- Gold is a decoration colour: rules, ornaments, illustration. It is never text and never the only sign of state, because it fails contrast on parchment (`tokens.test.ts` proves it).
- No urgency tricks. No red badges for things that are not urgent, no countdown pressure on registration, no streaks or guilt. The unread badge is the only attention colour on the home screen.
- Motion is small and slow. When the person asks the phone for reduced motion, there is none.
- Never name a person in an error. "We could not load this" is right; "You entered it wrong" is not.

## 2. Plain wording

- Write for someone reading a second language, or reading with effort. Short sentences. Common words. One idea per sentence.
- Say what happened and what to do next: "That code is not right. Check it and try again."
- Button labels are verbs the person would say: Register, Send code, Save. Not "Submit", "Proceed", "Confirm action".
- No jargon on a person's screen: not "session occurrence", "scope", "role", "OTP", "token". Coordinator screens may say "circle" and "venue" because those are the coordinators' own words.
- One word for one thing, in both languages. English: venue, session, circle, coordinator. Urdu drafts: مقام, نشست, سرکل, کوآرڈینیٹر. A native speaker confirms these before release (`docs/design/microcopy.md`).
- Never build a sentence by joining strings. One key per sentence, with placeholders (`docs/engineering/i18n-keys.md`).

## 3. Elders are a design target

Many people who use the app are older, reading in good light and bad, with one hand.

- The default body text is 16 dp, not 14. Four text sizes (1x, 1.15x, 1.3x, 1.5x) apply to the whole app, not only the Quran reader. Nothing is clipped or overlaps at 1.5x; boxes grow, they are never fixed-height.
- Touch targets are at least 48 dp tall and wide. The key action of a screen (Register, Send code) is a large button, 56 dp, full width, at the bottom of the thumb's reach.
- One main action per screen, one clear primary button. Secondary actions are quieter, never competing.
- State is never colour alone: a selected chip has a check, a selected tab has a bar and bold text, a switch says On or Off, an error has an icon and words.
- Confirm only what cannot be undone (cancel registration, delete account, send to many people). Never confirm the ordinary.
- Text contrast is at least 4.5:1 everywhere, 7:1 in high contrast, checked by tests on every pair the kit uses.
- Forms ask for the least they can. A person can browse everything without an account. Required fields at registration are exactly: name, WhatsApp number (verified), area, section and party size.

## 4. Right-to-left is designed first, not mirrored last

- Urdu is a first language of the product, not a translation. Every screen is designed in both directions together and the catalog shows both side by side.
- Layout uses start and end, never left and right. The kit has a source scan test that fails on `marginLeft`, `left:`, `textAlign: 'left'` and similar.
- Urdu text has its own font (Gulzar), a larger size and a much taller line height. Do not shrink it to fit; make the space.
- Icons that point somewhere mirror; icons of things do not. The list is in `docs/design/rtl-urdu-guide.md`.
- The Quran uses its own font (AlMushaf), only for Quran text, always right to left, whatever language the screen is in.

## 5. Calm under bad conditions

The first Dora season will run on weak connections and old phones.

- Every list has four states designed up front: loading (skeleton), empty (says what to do next), error (plain words and Try again) and offline (what we still know, and when it was saved).
- Loading placeholders are static, so they cost nothing on a slow phone.
- Do not block on the network when we already have an answer. Show the saved copy and mark it as saved.
- Images are optional. No screen depends on a photo.

## 6. Consistency through the kit

- Screens use only `@qc/ui` components and tokens. If a screen needs something the kit lacks, ask the ui lane; do not style it locally.
- No raw colours, font sizes, spacing numbers or hard-coded strings in screens. A raw `#fff` in a screen is a review finding.
- The console shares tokens, not components (decision in `docs/product/decisions.md`). Console pages follow the same colours, type scale, spacing, wording and accessibility rules in a desktop layout.

## 7. What a design review looks at

For every front-end pull request the ui lane checks:

1. Components and tokens from `@qc/ui` are used; nothing is styled locally.
2. The four states (loading, empty, error, offline) are present where data loads.
3. Light, dark and high contrast all work; nothing is lost in high contrast.
4. Left-to-right and right-to-left both work; no left/right; icons mirror correctly.
5. All four text sizes work; nothing clips; targets stay at 48 dp or more.
6. Roles, names and states are right for a screen reader; focus order follows reading order.
7. Strings come from `@qc/i18n`; wording is plain; Urdu is marked as draft.

## What a human must review

The tokens (`packages/ui/src/tokens.ts`, `semantic-colors.ts`), the catalog (`pnpm --filter @qc/ui catalog`), the Urdu type scale (size factor 1.1, line height 1.95) and the choice of Western digits for Urdu. Agents cannot judge how Gulzar or AlMushaf looks on a real phone.
