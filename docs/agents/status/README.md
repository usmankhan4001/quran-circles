# Lane status files

Each lane keeps one file here, `<lane>.md`, which the lane's agent updates at the end of every session. The orchestrator reads them to see progress without opening each worktree. The orchestrator also keeps `orchestrator.md` with gate sign-offs and the list of open worktrees.

Template:

```md
# Status: <lane>

Updated: <yyyy-mm-dd>
Branch: <lane/...>

## Done

- <item and pull request>

## In progress

- <item>

## Blocked

- <item, and what unblocks it>

## Questions for the orchestrator

- <question>

## Contract change requests

- <link>
```

Create your file the first time you work. Keep it short: facts, not narrative.
