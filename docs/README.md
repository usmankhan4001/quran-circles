# Documentation index

| Folder         | Contents                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `product/`     | The source pack: decisions, data model, messaging rules, features, experience. Read-only for agents.      |
| `engineering/` | Conventions, ownership map, gates, branching and review rules, contract change process, decision records. |
| `agents/`      | The operating guide, the brief template, one brief per lane, and lane status files.                       |
| `design/`      | Design principles and screen specs, written and kept by the UI lane.                                      |

## Where the plans live

The planning documents are shared docs, not files in this repository:

- Quran Circles V2 Plan: what is being built and why. `docs/product/` is the agent-facing copy of its decisions.
- Quran Circles V2 Development Plan: waves, work packages, gates and the agent operating model. `docs/agents/` and `docs/engineering/gates.md` mirror it.

If this repository and a plan disagree, stop and ask the orchestrator. Do not pick one.

## Terms

- **Wave**: a stage of the build, 0 to 7. A gate sits between waves.
- **Lane**: the set of directories and work packages one agent owns.
- **Work package (WP)**: a numbered unit of work in the development plan.
- **Contract**: the database schema, API contract, scope matrix, message formats, design tokens and translation keys that several lanes depend on.
- **Orchestrator**: the human, with a main Claude session, who owns the plan, the contracts and the gates.
