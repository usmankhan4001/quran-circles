# Urdu and right-to-left guide

For every lane that builds a screen. The kit already follows these rules; this page says why and what to do when you step outside the kit. Urdu wording in the product is a draft until a native speaker reviews it.

## 1. How direction works in the code

- `ThemeProvider` takes a `locale` (`en` or `ur`) and sets the direction from it (Urdu is right to left). It renders a wrapper with `dir` (web) and `direction` (native) so everything below mirrors. Put it once at the root of each app, and pass `style={{ flex: 1 }}`.
- `useTheme()` gives `direction`, `locale`, `mode`, `textSize`, `scale`, `colors`, `type()` and `t()`.
- Inside the kit, layout is written with `flexDirection: 'row'` and the logical properties `marginStart`, `marginEnd`, `paddingStart`, `paddingEnd`, `borderStartWidth`, `start`, `end`. These flip by themselves. A test (`conventions.test.ts`) fails if a component uses `left`, `right`, `marginLeft`, `paddingRight`, `borderLeftWidth`, `textAlign: 'left'` or `row-reverse`.
- The only physical decisions go through `direction.ts`: `textAlignStart(direction)`, `startSide`, `endSide`, and `iconFlipTransform(name, direction)`.
- Do not mirror by swapping the order of children in code. Write the children in reading order and let the direction place them.

## 2. Mirroring rules

| Thing                                                  | Rule                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Screen layout, rows, tab order, lists, form labels     | Mirrors. First item is at the right.                                                         |
| Back button and the forward chevron in a list row      | Mirror. Back points right, forward points left.                                              |
| Progress bars and sliders                              | Fill from the start side (right in Urdu).                                                    |
| Switch thumb                                           | Off at the start, on at the end. In Urdu the thumb moves leftwards when turned on.           |
| Text alignment                                         | Start of the line: right for Urdu, left for English. Use the `Text` component.               |
| Numbers, phone numbers, times, codes                   | Stay left to right inside the line (see section 5).                                          |
| Bottom tab bar                                         | Mirrors: Home is at the right in Urdu.                                                       |
| Carousels and horizontal lists                         | Start at the right and scroll leftwards.                                                     |
| Maps, clocks, the Quran page layout, media play/pause  | Never mirror. A map is a map; the play triangle points right in both.                      |
| Quran text                                             | Always right to left, whatever the screen language.                                          |
| Photos and illustrations                               | Do not mirror, unless they show direction or reading order.                                  |
| Swipe gestures                                         | Swipe-to-go-back starts from the start edge (the right in Urdu). Platform handles it.        |

## 3. Which icons flip

Flip the icons that point somewhere or show reading order. Do not flip icons of objects or fixed ideas.

- **Flip** (listed in `flippingIcons` in `direction.ts`): chevron-forward, chevron-back, arrow-forward, arrow-back, back, forward, next, previous, send, reply, undo, redo, list-bullets, sign-in, sign-out, external-link.
- **Do not flip:** check, close, plus, minus, clock, search, phone, bell, heart, star, home, person, calendar, map pin, play and pause, download and upload, refresh, camera, info, warning, error, success, chevron-down, chevron-up.
- The kit's `Icon` flips by name. If you add an icon that points, add its name to `flippingIcons` and add a test.
- If an icon contains a letter or a word, redraw it for Urdu; do not mirror it.

## 4. Fonts, size and line height

| Script | Font      | Size                          | Line height   | Weight                  |
| ------ | --------- | ----------------------------- | ------------- | ----------------------- |
| Latin  | DM Sans   | Role size (body 16 dp)        | 1.4 x size    | 400, 500, 700           |
| Urdu   | Gulzar    | Role size x 1.1 (body 17.6)   | 1.95 x size   | 400 only                |
| Quran  | AlMushaf  | Role `quran`, 28 dp           | 2.2 x size    | 400 only                |

- Gulzar is a Nastaliq face with very tall ascenders and deep descenders that sit on a sloping baseline. At a normal line height they collide with the lines above and below. The kit uses 1.95 times the size. Do not tighten it.
- Gulzar looks smaller than DM Sans at the same size, so Urdu is set 10% larger. Both numbers (1.1 and 1.95) are a proposal; a human checks them on a real phone against real Urdu paragraphs and adjusts the two constants in `tokens.ts`.
- Urdu fonts have one weight. Do not use bold for Urdu: the phone fakes it and it looks broken. The kit's `strong` prop ignores Urdu. Show emphasis with size, colour or position.
- Use the font by name through tokens (`fonts.urdu`), never a literal. Font files are not in the repository; the apps load them.
- **AlMushaf is only for Quran text.** Never use it for headings, translation, verse numbers in prose, or decoration. The Urdu translation under a verse is Gulzar.
- A boxed line (button, tab, badge) must grow with a taller line height. Use `minHeight`, never a fixed `height`, for anything that holds text.
- Truncate with `numberOfLines`, not by character count; Urdu letters join and change shape.

## 5. Numerals

**Recommendation: use Western digits (0 1 2 3 4 5 6 7 8 9) in Urdu screens.**

Why: phone numbers, prices, times, SMS and WhatsApp in Pakistan use Western digits; mixing the two systems on one screen (a phone number next to a date) is confusing; Western digits are in every font including Gulzar. Eastern Arabic (extended, Urdu form: ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹) is common in print, and in the Quran page numbering. 

Rules:

- Every number the kit shows goes through `formatNumber(value, locale)` in `numerals.ts`. The default is Western for both languages. If the native reviewer or the owner prefers Eastern digits, change `defaultNumerals.ur` in one place and the tests show what moves.
- Dates and times: format with the platform's `Intl` for the locale `ur-PK` using the Latin numbering system (`-u-nu-latn`). Show a 12-hour clock with am/pm words from the translation file.
- Phone numbers, one-time codes and times keep left-to-right order inside a right-to-left line. Use `TextField contentDirection="ltr"`, or wrap with `ltrRun()`.
- Quran verse numbers inside the reader follow the reader's own style (AlMushaf glyphs); that is the content lane's choice.
- This is a proposal. Mark it for the native reviewer.

## 6. Mixed-direction strings

An Urdu sentence often holds an English or numeric piece: a venue name, a code, a time.

- Put every changing piece in a placeholder, never join strings: `"Join us at {venue}"`. The translator can place it.
- Wrap a piece whose direction is not known (a person's name, a venue name, a user's note) in `isolate(text)` from `direction.ts`. It adds first-strong isolate marks so the piece cannot reorder the words around it.
- For a whole run that is English inside an Urdu screen (a long English note), use `<Text lang="en">`: it picks DM Sans, sets left-to-right and aligns to the left.
- For text whose language is unknown (user-written updates), use `<Text direction="auto">`: the first strong character decides.
- Punctuation at the end of a right-to-left sentence that ends in Latin text can jump to the wrong side. Add `rtlMark()` (U+200F) after the Latin piece if it does.
- Parentheses and quotes mirror automatically with direction; do not swap them by hand.
- Test every string that holds a placeholder in Urdu with a long English name, a name with digits, and a very short name.

## 7. Forms

- Labels sit above the field, aligned to the start. The error message sits under the field, aligned to the start.
- Phone, code and email inputs are left to right and aligned to the start of the line (`contentDirection="ltr"`). Name and notes follow the screen.
- Keyboards: use `keyboardType` (`phone-pad`, `number-pad`) for codes and numbers. Do not rely on the person switching language.

## 8. Testing a screen for right-to-left

1. Render it with `locale="ur"` in the catalog or in a test and check it side by side with English.
2. Check each of the four text sizes. Urdu at 1.5x is large: lines must wrap, not clip.
3. Check an English venue name inside an Urdu sentence, and a sentence that ends with a number.
4. Check the icons: back and forward flip, check and close do not.
5. Search your screen's code for `left`, `right`, `marginLeft`, `paddingRight`. There should be none.
6. On a device: switch the phone to Urdu and check the system parts too (keyboard, date picker, share sheet).
