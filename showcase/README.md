# UI kit showcase

A browsable page of every `@qc/ui` component, rendered from the real kit code in light, dark and high contrast, English left to right and Urdu right to left, with theme and language filters.

It wraps the catalog the ui lane already generates; it adds no components and changes nothing in `packages/ui`.

```sh
# from v2/
pnpm --filter @qc/ui catalog   # writes packages/ui/build/catalog/index.html
node showcase/build.mjs        # writes showcase/build/index.html
```

The output is a page body (no `html`/`head`/`body` tags) meant to be published as a claude.ai Artifact.
