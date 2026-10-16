# Change request: a web-safe entry point for the design tokens

Requested by: console
Contract: `packages/ui` package exports
What I need: a subpath export `@qc/ui/tokens` that re-exports only the pure modules (`tokens`, `semantic-colors`, `direction`, `contrast`) with no React Native import.
Why: the console is a web app. `@qc/ui`'s main entry pulls in `react-native`, which the console must not bundle. The console wants the same colours, spacing, radii, text scale and direction helper as the apps.
Proposed change: add `"./tokens": "./src/tokens-entry.ts"` to `packages/ui/package.json` `exports`, and an entry file that re-exports those modules.
Affected lanes: ui, console.
Workaround meanwhile: `apps/console/src/lib/ui-tokens.ts` imports the same files by relative path (`../../../../packages/ui/src/...`). Only that one file knows the path, so the switch is one edit.
