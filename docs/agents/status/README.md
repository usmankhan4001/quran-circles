# Lane status files

Each lane keeps one file here, `<lane>.md`, which the lane's agent updates at the end of every session. A status file is the only memory that survives between sessions, so the next agent must be able to read the top of it and know what to do. The orchestrator reads the files to see progress without opening each worktree. The orchestrator also keeps `orchestrator.md` with gate sign-offs. Its "Open worktrees" section is out of date; the live list is `git worktree list --porcelain` ([worktrees](../worktrees.md)).

**Older files predate this template.** As of 2026-10-26 none of the lane files has a `Next step:` line, only `ui-member-journey.md` has `Worktree:`, none has an `## Archive` section, several run past 100 lines, and some name the pre-lane branch `claude/peaceful-archimedes-ain95k` in their header. Until a file is migrated, its entry point is the `## In progress` section (if it has one) plus the newest dated section. If you still cannot tell what to do, ask the orchestrator. Nobody rewrites old files in bulk: the agent that next works in a lane migrates that lane's file to the template at the end of its session, and moves what is no longer needed under `## Archive`.

Template:

```md
# Status: <lane>

Updated: <yyyy-mm-dd>
Branch: <lane/...>
Worktree: <path of the sibling folder, or "none">
Next step: <the one thing the next session should do first>

## Done

- <item and commit or pull request>

## In progress

- <item>

## Blocked

- <item, and what unblocks it>

## Questions for the orchestrator

- <question>

## Contract change requests

- <link>

## Archive

Older sessions, newest first. Nothing below here needs reading to continue the work.
```

## Rules

- Create your file the first time you work. A lane with no brief still gets a status file.
- Keep the part above `## Archive` to about 25 lines: facts, not narrative. When a session's notes are no longer needed to continue, move them under `## Archive`.
- Update the file last, in the same commit as the work. Put the date and the lane branch at the top, and keep `Next step` current. Every file you touch gets the template header, `Next step` and `Worktree` included.
- `Worktree` is the folder you work in. Set it to `none` when you remove the worktree, so the orchestrator can keep `orchestrator.md` right ([worktrees](../worktrees.md)).
- Write no secrets, phone numbers or other personal data here. This repository is public.
