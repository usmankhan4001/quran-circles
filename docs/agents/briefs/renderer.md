# Brief: renderer

Lane: renderer
Work packages: WP16
Wave: 4
Priority: P1
Approval: reviewer agent, UI review, human for container and template changes

## Goal

Session posters and share cards. A background job renders locked HTML and CSS templates to a story image, a print PDF and a link preview image, in Urdu and English with a QR code. The same pipeline produces the link preview that appears when someone shares a session.

## You own

`apps/poster-renderer/` (create it in Wave 4).

## You must not touch

`apps/api/` (the api-core lane exposes the endpoints; agree the contract through a change request), `packages/*`.

## Read first

`docs/product/features.md` (session posters), `docs/design/` (poster direction from the ui lane), the frozen contracts for posters and poster templates, `docs/engineering/decisions/0001-target-stack.md`.

## Deliverables

1. **Urdu rendering test first, as a go or no-go.** Render sample Urdu Nastaliq and mixed English and Urdu text with the chosen fonts in a headless browser. Compare the output with a reference by eye and record the result in a decision record. If it fails, propose another approach (simpler templates or a different renderer) and wait for the orchestrator.
2. **Container.** A renderer service in its own container with a headless browser, a concurrency limit, a timeout and a memory limit. It receives a template id and field values and returns files.
3. **Templates.** Two or three curated templates with locked layout and editable fields only (text, colours, language). Formats: story or status size (9:16), print-ready PDF (A4 and A3), and link preview (1200 by 630). Visual direction comes from the ui lane.
4. **QR code** that opens the session or its registration in the app, with a deep link in the contract's format.
5. **Job and caching.** Run as a queue job with results cached per session version. Regenerate when the session changes.
6. **Out-of-date detection.** Store the session details the poster was made from, so the API can flag the poster when time or venue changes.
7. **Fonts.** Bundle only fonts with licences that allow it, and keep the licence files with them.

## Definition of done

- The Urdu rendering decision is recorded and accepted by the orchestrator.
- Each template renders correctly in English, Urdu and mixed text, at every format.
- A poster made before a session change is flagged out of date.
- The renderer cannot be made to fetch arbitrary URLs or read local files (tested).
- A human has approved the container and the templates.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/poster-renderer test
```

## Decisions to respect

Admins and coordinators in scope can make posters; templates are locked. Not in V2: speaker photos, weekly multi-session posters, a drag-and-drop editor, a square image. Bilingual with a QR code. Everything runs on our own server.

## Stand-ins

The ui lane's poster direction is not ready: build a plain template and mark it provisional. The api-core endpoints are not ready: drive the renderer from a script with sample data.
