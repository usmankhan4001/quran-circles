# Change request: halaqa flyer fields and the poster template catalog

Status: **implemented on 2026-10-25 at the owner's request, for the contracts and db lanes to review.** Additive and optional: nothing that exists changes meaning.

Requested by: console (poster maker), at the owner's direction ("poster maker isn't done"; the owner's Canva flyer carries an address, a phone and two QR codes).

## 1. `PosterFields.flyer` (contract)

The Quranic Circles flyer prints more than the session's time and venue. `PosterFields` gains one optional, strict object:

```
flyer?: {
  address?: { en?: string; ur?: string };   // up to 120 characters each, SafeText
  phone?: string;                           // up to 32 characters, SafeText
  whatsappUrl?: string;                     // https link, up to 300 characters, no spaces or control characters
  locationUrl?: string;                     // https link, same rule
}
```

New constants: `POSTER_ADDRESS_MAX`, `POSTER_PHONE_MAX`, `POSTER_LINK_MAX`; new schema `PosterFlyer`. `posters.fields` is jsonb, so there is no column change. Templates that do not use the lines ignore them. A link must be `https` so a poster never prints a QR code for `javascript:`, `http:` or a `data:` URL; the renderer also refuses them because it parses with the contract's schema. `openapi.json` is regenerated.

With a link set, the Quranic Circles template draws that link as a QR code under its caption ("WhatsApp group", "Google location") in place of the registration code; with none, it draws the registration code as before. New renderer wording (`poster.whatsappGroup`, `poster.googleLocation`, English and Urdu draft) is in `packages/i18n`.

## 2. Migration 0014: the template rows (db)

A fresh install had an empty `poster_templates` table: only the development seed wrote it, and the seed refuses to run in production. On production the console's poster maker therefore listed no template. Migration `0014_poster_template_catalog` writes the renderer's three templates (`cloud`, `night`, `quranic_circles`) with the fixture ids the seed uses, `ON CONFLICT (key) DO NOTHING`. `packages/db/src/poster-templates.test.ts` fails when `DEMO_POSTER_TEMPLATES` and the table disagree, so a new template needs a new migration (same rule as `message_templates`, migration 0013). The seed now finds the rows already there; its test says so.

## Not changed

No endpoint, scope, enum or column changed. Posters made before this keep their fields as they were.
