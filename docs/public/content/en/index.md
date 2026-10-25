---
title: Quran Circles documentation
description: Guides for members, coordinators and admins, the public API reference, the platform overview and the ERPNext integration guide.
section: start
order: 1
---

# Quran Circles documentation

Quran Circles helps people in Pakistan find the nearest Quran session, join it in a tap and never miss it. Coordinators run a venue or a circle from a phone. Admins oversee a city or the whole country from a web console.

Pick what you need.

- [Member guide](member-guide.md): find a session, join, get reminders, read the Quran, manage your account.
- [Coordinator guide](coordinator-guide.md): run today's session, mark attendance, post updates, change a time, make a poster.
- [Console guide](console-guide.md): sessions, venues, coordinators, exports, bulk import and the audit log.
- [API overview](api-overview.md): how to call the public API.
- [Architecture](architecture.md) and [deployment](deployment.md): how the platform fits together.
- [ERPNext integration](erpnext.md): connecting an ERPNext site, and what has to be built first.

## What is published here, and what is not

| Part                                        | Published                                                       | Why                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Member, coordinator and console guides      | Yes                                                             | They teach people to use the product.                                                                        |
| Public API reference                        | Yes, generated from the contract (version {{CONTRACT_VERSION}}) | It describes only what a signed-in person or a visitor can already do in the app.                            |
| Staff API (admin and coordinator endpoints) | No, see [the staff API](api-staff.md)                           | These endpoints reach other people's phone numbers, send messages that cost money and change who has access. |
| Architecture and deployment                 | Yes, public-safe                                                | Hostnames, secrets, limits and internals that help an attacker are left out.                                 |
| WhatsApp webhook                            | Described only                                                  | Meta is the only caller; see [webhooks](api-webhooks.md).                                                    |

## Languages and accessibility

Guides are written in English and Urdu. The Urdu text is a draft until a native speaker reviews it, and each Urdu page says so. The API reference, architecture and integration pages are English only.

These pages follow the same rules as the apps: text that works at four sizes, a right-to-left layout for Urdu, light and dark themes, controls of at least 48 pixels, visible focus, a skip link, and no motion when the system asks for less. Details are in [accessibility and languages](accessibility.md).
