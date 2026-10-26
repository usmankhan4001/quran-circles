---
title: Accessibility and languages
description: The accessibility and Urdu right-to-left rules the apps and these pages follow.
section: platform
order: 30
---

# Accessibility and languages

Many members are older, use low-end phones and read Urdu. The design rules start from them, not from the average screen.

## What the apps promise

| Area                       | Rule                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard                   | WCAG 2.2 level AA, with stricter project rules below                                                                                                                                                            |
| Text size                  | Four steps, across the whole app and the console, not only the reader. Nothing clips or overlaps at the largest step.                                                                                           |
| Colour and contrast        | Body text at least 4.5:1; a high-contrast mode raises it to 7:1. Selected, error and on/off states always have a second cue (an icon, a tick or words), never colour alone. Amber is decoration, not body text. |
| Themes                     | Light, dark and high contrast. The app respects forced colours.                                                                                                                                                 |
| Touch targets              | At least 48 by 48 dp, with space between neighbours. Smaller drawn pills get invisible hit area.                                                                                                                |
| Keyboard and switch access | Everything works without a mouse or touch. Focus is always visible (a 3 dp ring) and follows reading order in both directions.                                                                                  |
| Screen readers             | Controls have names, roles and states; errors are announced; dialogs are named and return focus.                                                                                                                |
| Motion                     | Small. With reduced motion on, there is none.                                                                                                                                                                   |
| Time                       | Nothing times out while someone reads. Joining a session has no countdown.                                                                                                                                      |
| Words                      | Plain, short, one word per thing. Every field has a visible label; a placeholder is never the label. Errors say what is wrong and what to do.                                                                   |

## Urdu and right-to-left

- English and Urdu ship together. Every screen works left to right and right to left.
- Layout is written with logical properties only (start and end, never left and right), and a test fails if a physical direction slips in.
- Back and forward arrows mirror; check, close, clock, search and play do not. Maps, clocks and Quran page layout never mirror.
- Quran text is always right to left, whatever the screen language.
- Urdu uses a true Nastaliq face with generous line height. It has one weight, so emphasis uses size or colour, never bold.
- Numbers use Western digits (0 to 9) in Urdu screens, because phone numbers, times and WhatsApp in Pakistan use them. Phone numbers and codes stay left to right inside a right-to-left line.
- Changing pieces (a venue name, a time) go into placeholders, and unknown-direction text is isolated so it cannot reorder the sentence around it.
- Urdu wording is drafted by the team and reviewed by a native speaker before release. Pages marked "draft" have not had that review yet.

## How it is checked

- Automated: contrast of every colour pair, component roles and sizes in every combination of theme, language and text size, an accessibility rule engine on the whole component kit, and a source scan that rejects left and right layout and raw colours.
- By people: a checklist on every screen pull request, and device checks with TalkBack and VoiceOver, text at 1.5 times in Urdu on a small phone, dark and high contrast, one-handed use with an older person, reduced motion, and keyboard use on the web app.
- Not covered by machines: layout overlap at large text in Urdu, real font rendering, focus return after closing a sheet, voice control. These need a device and are tracked as known gaps.

## These documentation pages

This site follows the same rules: a skip link, a language switch, four text sizes (the buttons at the top, remembered on your device only), light and dark themes, a mirrored right-to-left layout for Urdu, code and numbers kept left to right, controls of at least 48 pixels, a visible focus ring, tables you can scroll by keyboard, images with descriptions, and no animation when the system asks for less. If something on a page is hard to use, tell the owner; accessibility reports are treated as bugs.
