# GitHub repository settings

Settings that live on github.com and cannot be committed. Someone with admin rights on `usmankhan4001/quran-circles` sets them once; this page records what they should be and why.

The reason they matter: **Dokploy production pulls `main` from GitHub with auto-deploy on, so every push to `main` goes live.** Branch protection is the only thing between a mistake and production.

## Checklist

**Settings > General**

- [ ] Description: `Quran Circles: find the nearest Quran session, register in a tap and never miss it. Dora and Circles, in English and Urdu.`
- [ ] Topics: `quran`, `pakistan`, `urdu`, `rtl`, `expo`, `react-native`, `typescript`, `hono`, `postgres`, `drizzle`, `pnpm-workspaces`, `dokploy`
- [ ] Default branch: `main`
- [ ] Pull requests: allow squash merging (the rule in [branches-and-review.md](branches-and-review.md)); turn off merge commits and rebase merging if you want a linear history
- [ ] Pull requests: **Automatically delete head branches** on
- [ ] Pull requests: **Always suggest updating pull request branches** on
- [ ] Features: Issues on; Wikis and Projects off unless used

**Settings > Branches > Branch protection rule for `main`**

- [ ] Require a pull request before merging
- [ ] Require approvals: 1 (the author never approves their own change)
- [ ] Require review from Code Owners (`.github/CODEOWNERS` lists the sensitive paths)
- [ ] Require status checks to pass: `check` (the job in `.github/workflows/ci.yml`). Add `e2e` later, once it has been green for a while
- [ ] Require branches to be up to date before merging
- [ ] Require conversation resolution before merging
- [ ] Block force pushes and deletion of `main`
- [ ] Do not allow bypassing the rules (or limit bypass to the owner for emergencies)

Until this rule is on, work lands on `main` in small commits (see [CONTRIBUTING.md](../../CONTRIBUTING.md)) and production deploys on each push. Lanes work on `lane/<lane>/<topic>` branches and the owner merges to `main` only when the work is meant to go live.

**Settings > Code security**

- [ ] Private vulnerability reporting on (the link in [SECURITY.md](../../SECURITY.md) depends on it)
- [ ] Dependabot alerts and security updates on (version updates come from `.github/dependabot.yml`)
- [ ] Secret scanning and push protection on

**Settings > Actions > General**

- [ ] Workflow permissions: read repository contents only (the workflow already asks for `contents: read`)
- [ ] Allow GitHub Actions and actions from verified creators; the workflow pins third-party actions to commit SHAs

**Settings > Webhooks / Integrations**

- [ ] Confirm the Dokploy webhook or GitHub App targets `main` only, so lane branches never deploy
