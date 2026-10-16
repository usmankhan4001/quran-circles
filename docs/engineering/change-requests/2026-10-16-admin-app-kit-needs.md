# Change request: stepper, date and time pickers and phone icons for the admin app

Requested by: admin-app
Contract: `@qc/ui` (new components, `Icon`)
What I need:

1. A `Stepper` (number with minus and plus buttons, `value`, `onChange`, `min`, `max`, `label`, optional `large`, `testID`), used for the headcount, a drop-in's party size and the session length.
2. A date input and a time input (`DateField`, `TimeField`) that use the native pickers on phones and the browser's inputs on the web, return `YYYY-MM-DD` and `HH:MM`, and show a visible label and an error.
3. Icons `phone`, `chat` (for WhatsApp, no brand mark) and `search`.

Why: the design for "Change a session time" asks for native pickers, and the attendance screen needs a fast one-thumb headcount. Without them, dates and times are typed as text and checked by the app, which works but is slower and easier to get wrong at the venue. `Checkbox` has shipped and is already in use.

Proposed change: add the three components and three icon names, with the usual right-to-left and four-size behaviour. Props as above so the admin app can swap its local `Stepper` (`apps/admin-app/src/components/Stepper.tsx`, marked TODO) and its two text fields for them in a small change.

Affected lanes: ui (owns the kit), admin-app, user-app (the registration form can use the same date input).

Workaround meanwhile: a local `Stepper` built from kit `Button`s and `Text`, and text fields with `HH:MM` and `YYYY-MM-DD` checks. Call and WhatsApp use labelled `Button`s. Nothing is blocked.
