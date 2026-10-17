# Change request: reminder lead time per program in Settings

Requested by: messaging
Contract: `@qc/contracts` (Settings), `settings` table keys
What I need: a documented settings key for how long before a session its reminder is sent, per program.
Why: the program requirements treat Dora and circles differently, and the owner should change the lead time without a deploy.
Proposed change: add `reminderLeadMinutes: { dora: number, circles: number }` (whole minutes, 5 to 1440, default 60 each) to the Settings contract, stored under the key `reminder_lead_minutes`. Also confirm `whatsapp_daily_cap_per_person` (0 to 5) for Wave 4.
Affected lanes: contracts, api-core (settings endpoints), console (a settings form).
Workaround meanwhile: the worker reads `reminder_lead_minutes` (or `reminderLeadMinutes`) from the `settings` table directly, validates it, and falls back to 60 for each program.

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.

Applied in api and worker 2026-10-17: `adminSettings` serves `reminderLeadMinutes` under the key `reminder_lead_minutes` (a partial update merges); the worker reads the same key.
