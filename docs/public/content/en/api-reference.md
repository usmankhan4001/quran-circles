---
title: API reference
description: Every public endpoint, generated from the Quran Circles API contract.
section: api
order: 40
---

# API reference

Generated from the API contract, version **{{CONTRACT_VERSION}}**, and rebuilt with the site, so it cannot drift from the code. It lists the **{{PUBLIC_OPERATIONS}} public operations** that a visitor or a signed-in member can call. Staff operations are not published ([why](api-staff.md)).

Read [the overview](api-overview.md), [sign-in](api-auth.md) and [errors, limits and pagination](api-conventions.md) first. Every operation can also answer `429 rate_limited`, `500 internal_error` and `503 service_unavailable`.

All paths are relative to `{{API_BASE}}`.

{{API_REFERENCE}}
