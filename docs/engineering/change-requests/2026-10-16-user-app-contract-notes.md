# Change request: three contract points the user app relies on (for confirmation)

Requested by: user-app
Contract: none
What I need: confirmation that these choices are acceptable, or a contract change if not.

1. `registrations.create` accepts a `section` of `women`, `men` or `family`. The app offers only the session's own section when the session is women only or men only, and all three when the session is `family`. If a family session should only take `family`, say so and the app narrows the choice.
2. `devices.register` is `PUT /v1/me/devices` and returns the device with its id, which the app keeps to call `devices.remove` on sign out. If a sign out without a network cannot call it, the server should drop a device whose token fails delivery (the messaging lane's `push-delivery-ack` request).
3. `config.get` returns `hijriOffsetDays` and `seasonMode`; the app reads both. Nothing else in the config is used yet.

Why: so the app and the API agree without a meeting.

Affected lanes: contracts, api-core.

Workaround meanwhile: as described in each item.
