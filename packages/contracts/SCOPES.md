# Role and scope matrix

Generated from `src/scopes.ts` by `pnpm --filter @qc/contracts gen`. Do not edit by hand.

Staff are also attendees. A revoked assignment never counts. `own data` means the signed-in person on their own records only.

| Action | What it does | Checked against | public | attendee | venue_coordinator | city_coordinator | national_admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.request_code` | Ask for a sign-in code | public | yes | yes | yes | yes | yes |
| `auth.verify_code` | Verify a sign-in code | public | yes | yes | yes | yes | yes |
| `auth.refresh` | Exchange a refresh token for new tokens | public | yes | yes | yes | yes | yes |
| `config.read` | Read app configuration, season mode and feature flags | public | yes | yes | yes | yes | yes |
| `places.read` | Browse provinces, cities and areas | public | yes | yes | yes | yes | yes |
| `venues.read` | Browse and read published venues | public | yes | yes | yes | yes | yes |
| `sessions.read` | Browse and read published sessions and occurrences | public | yes | yes | yes | yes | yes |
| `content.read` | Read published About, FAQ and help pages | public | yes | yes | yes | yes | yes |
| `auth.sign_out` | Sign out | self | — | own data | own data | own data | own data |
| `me.read` | Read own account and profile | self | — | own data | own data | own data | own data |
| `me.update` | Edit own profile | self | — | own data | own data | own data | own data |
| `me.delete` | Delete own account and personal data | self | — | own data | own data | own data | own data |
| `registration.create` | Register for a session | self | — | own data | own data | own data | own data |
| `registration.read_own` | List own registrations | self | — | own data | own data | own data | own data |
| `registration.cancel_own` | Cancel own registration | self | — | own data | own data | own data | own data |
| `consent.manage` | Read and change own consents | self | — | own data | own data | own data | own data |
| `follow.manage` | Follow venues and circles, and set alerts | self | — | own data | own data | own data | own data |
| `device.manage` | Register and remove own push devices | self | — | own data | own data | own data | own data |
| `bookmark.manage` | Manage own bookmarks and reading position | self | — | own data | own data | own data | own data |
| `circle_request.manage` | Request a circle near me, and cancel the request | self | — | own data | own data | own data | own data |
| `updates.read_feed` | Read the Updates feed and mark items read | self | — | own data | own data | own data | own data |
| `registration.list` | See registrants of a session, with their numbers | venue | — | — | own venue | venues in own city | everywhere |
| `registration.export` | Export the registrants of a session | venue | — | — | own venue | venues in own city | everywhere |
| `attendance.read` | Read attendance of an occurrence | venue | — | — | own venue | venues in own city | everywhere |
| `attendance.mark` | Mark attendance of an occurrence | venue | — | — | own venue | venues in own city | everywhere |
| `venue.list_admin` | List venues in scope, including drafts | any | — | — | own venue | own city | everywhere |
| `venue.create` | Create a venue in a city | city | — | — | — | own city | everywhere |
| `venue.update` | Edit a venue, its contact number and facilities | venue | — | — | own venue | venues in own city | everywhere |
| `venue.archive` | Archive a venue | city | — | — | — | own city | everywhere |
| `circle.list_admin` | List circles in scope, including pending ones | any | — | — | own venue | own city | everywhere |
| `circle.create` | Create a circle (venue coordinators create it pending) | venue | — | — | own venue | venues in own city | everywhere |
| `circle.update` | Edit a circle | venue | — | — | own venue | venues in own city | everywhere |
| `circle.approve` | Approve or reject a pending circle | city | — | — | — | own city | everywhere |
| `session.list_admin` | List sessions in scope, including drafts | any | — | — | own venue | own city | everywhere |
| `session.create` | Create a session at a venue | venue | — | — | own venue | venues in own city | everywhere |
| `session.update` | Edit session details | venue | — | — | own venue | venues in own city | everywhere |
| `session.change_schedule` | Change a session time or day | venue | — | — | own venue | venues in own city | everywhere |
| `occurrence.update` | Set portion, recap, cancel or move one occurrence | venue | — | — | own venue | venues in own city | everywhere |
| `update.post_national` | Post an update to everyone | national | — | — | — | — | everywhere |
| `update.post_city` | Post an update to a city | city | — | — | — | own city | everywhere |
| `update.post_venue` | Post an update to a venue | venue | — | — | own venue | venues in own city | everywhere |
| `update.list_admin` | List updates posted in scope | any | — | — | own venue | own city | everywhere |
| `template.read` | Read approved message templates | any | — | — | own venue | own city | everywhere |
| `role.list` | List role assignments and invites in scope | any | — | — | — | own city | everywhere |
| `role.assign_national_admin` | Invite or assign a national admin | national | — | — | — | — | everywhere |
| `role.assign_city_coordinator` | Invite or assign a city coordinator | city | — | — | — | — | everywhere |
| `role.assign_venue_coordinator` | Invite, assign or hand over a venue coordinator | venue | — | — | — | venues in own city | everywhere |
| `audit.read` | Read the audit log in scope | any | — | — | — | own city | everywhere |
| `settings.read` | Read platform settings | national | — | — | — | — | everywhere |
| `settings.update` | Change platform settings such as the Hijri offset | national | — | — | — | — | everywhere |
