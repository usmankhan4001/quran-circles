# Public documentation

The source of the public documentation site: guides in English and Urdu, the API reference, a platform overview and the ERPNext integration guide. It is built into plain static HTML with no dependencies, so the landing page can host it under `/docs` without a new package.

## Build

```sh
node docs/public/build.mjs --base /docs --out <folder>
```

- `--base` is the path the site is served from (`/docs` on the landing site, empty for a standalone check). Every link and asset is prefixed with it.
- `--out` defaults to `docs/public/dist` (ignored by git). Copy or serve the result.
- The build fails, and writes nothing, on an image without a description, a link that matches no page, a missing image file or a page without a title.

Preview locally: build with an empty base into a folder and serve it with any static server, then open `/en/index.html` and `/ur/index.html`.

## Layout

| Path                       | What                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build.mjs`                | The generator: Markdown to HTML, the API reference from `packages/contracts/openapi.json`, the error table from `packages/contracts/src/errors.ts`, the CSS and JS |
| `content/en/*.md`          | English pages. Front matter: `title`, `description`, `section`, `order`                                                                                            |
| `content/ur/*.md`          | Urdu pages. A page with no Urdu twin is shown in the Urdu site as English, with a notice                                                                           |
| `assets/screens/`          | Screenshots used by the guides. Every image needs a description in the Markdown                                                                                    |
| `{{CONTRACT_VERSION}}` etc | Placeholders the build fills: `CONTRACT_VERSION`, `API_BASE`, `API_BASE_SITE`, `PUBLIC_OPERATIONS`, `ERROR_TABLE`, `API_REFERENCE`                                 |

## What is generated, what is written

- **Generated, never edit:** the API reference (all public operations, their parameters, bodies, responses and errors, plus the schemas) and the error code table. Change the contract and rebuild.
- **Written:** everything in `content/`. The wording of a few operations is overridden in `build.mjs` (`SUMMARY_OVERRIDES`, `DESCRIPTION_OVERRIDES`) so that limits and internals are not spelled out on a public page.
- **Left out on purpose:** every `/v1/admin` operation (the staff API). The page `api-staff.md` says why. To publish more, change `PUBLIC_TAGS` in `build.mjs` after a decision by the owner and a review.

## Rules for the pages

- Follow `docs/design/accessibility.md` and `docs/design/rtl-urdu-guide.md`. The template uses only logical CSS properties, four text sizes, light and dark, forced colours, 48 px controls, a skip link and no external requests, so a strict content security policy works (no inline scripts or styles).
- No secrets, internal hostnames, keys, personal data or abuse-enabling numbers (sign-in ceilings, invite caps, backup locations). Say that a limit exists, not its exact internal value, unless it is a plain default a client needs.
- Urdu is a draft until a native speaker reviews it. A page is marked reviewed by setting `reviewed: true` in its front matter; until then it carries the draft notice.
- Screenshots come from the current build and say so in the caption. Replace them when the redesign lands.
