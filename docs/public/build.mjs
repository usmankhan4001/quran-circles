#!/usr/bin/env node
// Builds the public documentation site: static HTML, no dependencies, no network.
//
//   node docs/public/build.mjs [--out docs/public/dist] [--base /docs]
//
// Inputs:  docs/public/content/<lang>/*.md   hand-written pages (front matter: title, section, order)
//          packages/contracts/openapi.json    generates the API reference (public endpoints only)
//          packages/contracts/src/errors.ts   the error code table
//          docs/public/assets/                images and the two small client files
// Output:  <out>/<lang>/<slug>.html, <out>/index.html, <out>/assets/*
//
// The build fails on a missing image description, a broken internal link or a page that names
// itself in the nav but has no file, so these never reach the site.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(opt('out', join(here, 'dist')));
const BASE = opt('base', '').replace(/\/$/, '');
const LANGS = ['en', 'ur'];
const SITE = 'Quran Circles';
const PROD_API = 'https://qurancircles.doraquran.pk/api';

const errors = [];
const fail = (msg) => errors.push(msg);

/* ------------------------------------------------------------------ markdown */

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

function inline(text, ctx) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `${codes.length - 1}`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = href.replace(/&amp;/g, '&');
    if (/^https?:/.test(url)) return `<a href="${esc(url)}" rel="noopener">${label}</a>`;
    ctx.links.push(url);
    return `<a href="${esc(resolveHref(url, ctx))}">${label}</a>`;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/(\d+)/g, (_, i) => codes[Number(i)]);
}

/** `page.md#frag` or `page` inside a language folder; `/en/page` is absolute inside the site. */
function resolveHref(url, ctx) {
  if (url.startsWith('#')) return url;
  const [path, frag] = url.split('#');
  const clean = path.replace(/\.md$/, '');
  const target = clean.startsWith('/') ? clean : `/${ctx.lang}/${clean}`;
  return `${BASE}${target}.html${frag ? `#${frag}` : ''}`;
}

function markdown(src, ctx) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '), ctx)}</p>`);
      para.length = 0;
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      // Code is always left to right, even on an Urdu page.
      html.push(
        `<pre dir="ltr" tabindex="0"><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      const explicit = /\s*\{#([\w-]+)\}\s*$/.exec(h[2]);
      const text = explicit ? h[2].slice(0, explicit.index) : h[2];
      const id = explicit ? explicit[1] : slugify(text);
      if (level === 2 || level === 3) toc.push({ level, id, text: text.replace(/`/g, '') });
      html.push(`<h${level} id="${id}">${inline(text, ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      flush();
      const cells = (l) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split(/(?<!\\)\|/)
          .map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      html.push(
        `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(ctx.tableLabel ?? head[0])}"><table><thead><tr>${head
          .map((c) => `<th scope="col">${inline(c, ctx)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map(
            (r) =>
              `<tr>${r.map((c, n) => (n === 0 ? `<th scope="row">${inline(c, ctx)}</th>` : `<td>${inline(c, ctx)}</td>`)).join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) {
          items.push(m[3]);
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t, ctx)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^>/.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      const first = body[0] ?? '';
      const kind = /^\*\*(Warning|تنبیہ)/.test(first)
        ? 'warning'
        : /^\*\*(Internal|اندرونی)/.test(first)
          ? 'internal'
          : 'note';
      html.push(
        `<aside class="callout ${kind}" role="note">${markdown(body.join('\n'), { ...ctx, links: ctx.links }).html}</aside>`,
      );
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(line);
    if (img) {
      flush();
      if (!img[1].trim()) fail(`${ctx.file}: image ${img[2]} has no description`);
      ctx.images.push(img[2]);
      html.push(
        `<figure><img src="${BASE}/assets/${esc(img[2])}" alt="${esc(img[1])}" loading="lazy">${img[3] ? `<figcaption>${inline(img[3], ctx)}</figcaption>` : ''}</figure>`,
      );
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flush();
      html.push('<hr>');
      i++;
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return { html: html.join('\n'), toc };
}

function frontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src.replace(/\r\n/g, '\n'));
  if (!m) return [{}, src];
  const meta = {};
  for (const l of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(l);
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return [meta, src.replace(/\r\n/g, '\n').slice(m[0].length)];
}

/* --------------------------------------------------------------- API reference */

const PUBLIC_TAGS = [
  'System',
  'Sign-in',
  'Me',
  'Registrations',
  'Discover',
  'Places',
  'Updates',
  'Quran',
  'Circles',
];
const TAG_BLURB = {
  System: 'Health, app configuration and published help pages.',
  'Sign-in': 'Sign in with a WhatsApp code, refresh a sign-in and sign out.',
  Me: 'The signed-in person: profile, consents, followed places, devices and account deletion.',
  Registrations: 'Joining a session. A registration is a pledge to attend, not a reserved seat.',
  Discover: 'Browse published venues, sessions and their dated occurrences. No sign-in needed.',
  Places: 'Provinces, cities and areas.',
  Updates: 'The Updates feed for the signed-in person.',
  Quran: 'Bookmarks, reading position, days read, memorisation and the ayah of the day.',
  Circles: 'Asking for a circle near me.',
};

// Wording that replaces the contract text where the contract describes limits or internals that a
// public page should not spell out.
const SUMMARY_OVERRIDES = {
  'registrations.create': 'Join a session. This is a pledge to attend; no seat is reserved',
};
const DESCRIPTION_OVERRIDES = {
  'registrations.create':
    'Joining is a pledge to attend. No seat is reserved and the apps never show seat counts. Send `partySize` 1 (the apps do). Only upcoming dates can be joined (`occurrence_in_past` otherwise), and joining the same session twice answers `already_registered`. A session can carry an optional limit that is off by default; when it is on and reached, the registration comes back with status `waitlisted` and the app calls that "waiting for confirmation". Joining is limited per person (bucket `registration`).',
  'auth.requestCode':
    'Sends a six-digit code to a Pakistani mobile number (`+923` and nine digits) by WhatsApp, or by SMS when asked. Any other number is `validation_failed` with `{ "path": "phone", "code": "phone_not_pakistan_mobile" }`. Requests are limited per number and per client address, and the whole service has overall ceilings; when you are over a limit the answer is `rate_limited` with `retryAfterSeconds` and a `Retry-After` header. Wait that long before asking again.',
  'auth.verifyCode':
    'Checks the code for the `challengeId` you were given. A code lives five minutes and allows five tries. Wrong or expired codes answer `otp_invalid`, `otp_expired` or `otp_too_many_attempts`. Checks are rate limited like code requests.',
  'auth.refresh':
    'Exchanges the refresh token for a new pair. The refresh token is single use: every call returns a new one, and sending an old one again signs that device out (`refresh_token_invalid`). Limited per client address.',
  'ayahOfTheDay.get':
    'Returns surah and ayah numbers only, never text. When exactly one pick of a followed venue or circle applies that day, that pick is returned; otherwise the national pick; otherwise a built-in list. Send the venues and circles the person follows as repeated `venueId` and `circleId` parameters; a signed-out visitor sends none. `date` defaults to today in Pakistan. The reader shows the Arabic and translation from its own source.',
};

const scrub = (text) =>
  text
    .replace(/ ?\(`[A-Za-z_.]+`\)/g, '')
    .replace(/`(?:[a-z]+[A-Z]\w*|[A-Z_]{5,})`/g, (m) => m.replace(/`/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

function buildReference(openapi) {
  const schemas = openapi.components.schemas;
  const used = new Set();
  const ref = (s) => (s.$ref ? s.$ref.split('/').pop() : null);
  const resolve$ = (s) => (s.$ref ? schemas[ref(s)] : s);

  const typeOf = (s) => {
    const r = ref(s);
    if (r) {
      used.add(r);
      return `[${r}](#schema-${slugify(r)})`;
    }
    if (s.anyOf) {
      const parts = s.anyOf.map(typeOf).filter((t) => t !== 'null');
      return parts.join(' or ') + (s.anyOf.some((p) => p.type === 'null') ? ' or null' : '');
    }
    if (s.const !== undefined) return `\`${JSON.stringify(s.const)}\``;
    if (s.enum) return s.enum.map((e) => `\`${e}\``).join(' / ');
    if (Array.isArray(s.type)) return s.type.join(' or ');
    if (s.type === 'array') return `list of ${s.items ? typeOf(s.items) : 'values'}`;
    let t = s.type ?? 'any';
    if (s.format) t += ` (${s.format})`;
    return t;
  };
  const limits = (s) => {
    const o = [];
    if (s.minLength !== undefined) o.push(`min length ${s.minLength}`);
    if (s.maxLength !== undefined) o.push(`max length ${s.maxLength}`);
    if (s.minimum !== undefined) o.push(`min ${s.minimum}`);
    if (s.maximum !== undefined && s.maximum < 1e15) o.push(`max ${s.maximum}`);
    if (s.default !== undefined) o.push(`default \`${JSON.stringify(s.default)}\``);
    return o.join(', ');
  };

  /** Rows for an object schema: `name | type | required | notes`. Nested inline objects use dotted names. */
  function rows(schema, prefix = '', depth = 0) {
    const s = resolve$(schema);
    const out = [];
    for (const [name, prop] of Object.entries(s.properties ?? {})) {
      const required = (s.required ?? []).includes(name);
      const p =
        prop.anyOf && prop.anyOf.length === 2 && prop.anyOf.some((x) => x.type === 'null')
          ? prop.anyOf.find((x) => x.type !== 'null')
          : prop;
      const inlineObject = !ref(p) && p.type === 'object' && p.properties && depth < 2;
      out.push([
        `${prefix}${name}`,
        typeOf(prop),
        required ? 'yes' : 'no',
        [limits(p), p.description ?? ''].filter(Boolean).join('. '),
      ]);
      if (inlineObject) out.push(...rows(p, `${prefix}${name}.`, depth + 1));
      if (
        !ref(p) &&
        p.type === 'array' &&
        p.items &&
        !ref(p.items) &&
        p.items.type === 'object' &&
        p.items.properties &&
        depth < 2
      ) {
        out.push(...rows(p.items, `${prefix}${name}[].`, depth + 1));
      }
    }
    return out;
  }
  const table = (head, body) =>
    body.length
      ? `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${body.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')}\n`
      : '';

  const example = (s, depth = 0) => {
    s = resolve$(s);
    if (depth > 4) return null;
    if (s.examples?.length) return s.examples[0];
    if (s.const !== undefined) return s.const;
    if (s.enum) return s.enum[0];
    if (s.anyOf) return example(s.anyOf.find((x) => x.type !== 'null') ?? s.anyOf[0], depth + 1);
    const t = Array.isArray(s.type) ? s.type.find((x) => x !== 'null') : s.type;
    if (t === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(s.properties ?? {}))
        if ((s.required ?? []).includes(k)) o[k] = example(v, depth + 1);
      return o;
    }
    if (t === 'array') return s.items ? [example(s.items, depth + 1)] : [];
    if (t === 'integer' || t === 'number') return s.minimum ?? 1;
    if (t === 'boolean') return true;
    if (t === 'string') {
      if (s.format === 'uuid') return '00000000-0000-4000-8000-000000000001';
      if (s.format === 'date-time') return '2027-02-18T01:15:00Z';
      if (s.format === 'date') return '2027-02-18';
      return 'string';
    }
    return null;
  };

  const ops = [];
  for (const [path, methods] of Object.entries(openapi.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = (op.tags ?? [])[0];
      if (!PUBLIC_TAGS.includes(tag)) continue;
      ops.push({ path, method: method.toUpperCase(), op, tag });
    }
  }

  const authLabel = (a) =>
    a === 'public' ? 'None' : a === 'user' ? 'Signed-in person (Bearer token)' : a;
  const md = [];
  const counts = {};
  for (const tag of PUBLIC_TAGS) {
    const group = ops.filter((o) => o.tag === tag);
    if (!group.length) continue;
    counts[tag] = group.length;
    md.push(`## ${tag}`, '', TAG_BLURB[tag], '');
    for (const { path, method, op } of group) {
      const id = op.operationId;
      const summary = SUMMARY_OVERRIDES[id] ?? scrub(op.summary);
      md.push(`### ${method} ${path}`, '');
      md.push(`**${summary}**`, '');
      const desc = DESCRIPTION_OVERRIDES[id] ?? (op.description ? scrub(op.description) : '');
      if (desc) md.push(desc, '');
      const facts = [
        ['Operation id', `\`${id}\``],
        ['Sign-in', authLabel(op['x-auth'])],
        ['Rate limit bucket', `\`${op['x-rate-limit'] ?? 'default'}\``],
        [
          'Safe to repeat',
          op['x-idempotent']
            ? 'Yes'
            : 'No: a repeat can create a second record or fail with `conflict`',
        ],
      ];
      md.push(table(['Property', 'Value'], facts));
      const params = (op.parameters ?? []).map((p) => [
        p.name,
        p.in,
        typeOf(p.schema),
        p.required ? 'yes' : 'no',
        [limits(p.schema), p.description ?? ''].filter(Boolean).join('. '),
      ]);
      if (params.length)
        md.push('**Parameters**', '', table(['Name', 'In', 'Type', 'Required', 'Notes'], params));
      const body = op.requestBody?.content?.['application/json']?.schema;
      if (body) {
        md.push(
          '**Request body** (JSON)',
          '',
          table(['Field', 'Type', 'Required', 'Notes'], rows(body)),
        );
        md.push('```json', JSON.stringify(example(body), null, 2), '```', '');
      }
      const statuses = Object.entries(op.responses ?? {});
      const ok = statuses.find(([code]) => /^2/.test(code));
      if (ok) {
        const [code, r] = ok;
        const json = r.content?.['application/json']?.schema;
        const other = r.content ? Object.keys(r.content)[0] : null;
        md.push(`**Success: ${code}**${json ? '' : other ? ` (${other})` : ' (no body)'}`, '');
        if (json) {
          const rr = ref(json);
          if (rr) md.push(`Returns [${rr}](#schema-${slugify(rr)}).${(used.add(rr), '')}`, '');
          else {
            md.push(table(['Field', 'Type', 'Required', 'Notes'], rows(json)));
            const ex = JSON.stringify(example(json), null, 2);
            if (ex.split('\n').length <= 40) md.push('```json', ex, '```', '');
          }
        }
      }
      const failures = statuses
        .filter(([code]) => !/^2/.test(code))
        .map(([code, r]) => [code, (r.description ?? '').replace(/^Error codes?: /, '')]);
      if (failures.length) md.push('**Errors**', '', table(['Status', 'Codes'], failures));
    }
  }

  md.push(
    '## Schemas',
    '',
    'Shapes the endpoints above return or accept. Times are UTC ISO strings; show Pakistan time (UTC+5).',
    '',
  );
  const done = new Set();
  const queue = () => [...used].filter((n) => !done.has(n));
  while (queue().length) {
    for (const name of queue().sort()) {
      done.add(name);
      const s = schemas[name];
      if (!s) continue;
      md.push(`### ${name} {#schema-${slugify(name)}}`, '');
      if (s.description) md.push(scrub(s.description), '');
      const r = rows(s);
      if (r.length) md.push(table(['Field', 'Type', 'Required', 'Notes'], r));
      else md.push('See the contract for this shape.', '');
    }
  }
  return { md: md.join('\n'), counts, total: ops.length, version: openapi.info.version };
}

function errorTable() {
  const src = readFileSync(join(repo, 'packages/contracts/src/errors.ts'), 'utf8');
  const block = /ERROR_CODES = \{([\s\S]*?)\} as const/.exec(src)?.[1] ?? '';
  const group = {};
  let current = 'Generic';
  const rowsOut = [];
  for (const l of block.split('\n')) {
    const c = /^\s*\/\/\s*(.*)$/.exec(l);
    if (c) {
      current = c[1];
      continue;
    }
    const kv = /^\s*(\w+):\s*(\d+),/.exec(l);
    if (kv) rowsOut.push([`\`${kv[1]}\``, kv[2], current]);
  }
  void group;
  return rowsOut;
}

/* --------------------------------------------------------------------- site */

const NAV_SECTIONS = [
  ['start', { en: 'Start here', ur: 'یہاں سے شروع کریں' }],
  ['guides', { en: 'Guides', ur: 'رہنما' }],
  ['api', { en: 'API', ur: 'API' }],
  ['platform', { en: 'Platform', ur: 'پلیٹ فارم' }],
  ['integrations', { en: 'Integrations', ur: 'انضمام' }],
];
const UI = {
  en: {
    skip: 'Skip to content',
    menu: 'Documentation',
    onThisPage: 'On this page',
    textSize: 'Text size',
    sizes: ['Small', 'Default', 'Large', 'Largest'],
    language: 'Language',
    draft: '',
    footer: 'Quran Circles documentation. No personal data is collected by these pages.',
    englishOnly: '',
  },
  ur: {
    skip: 'مواد پر جائیں',
    menu: 'دستاویزات',
    onThisPage: 'اس صفحے پر',
    textSize: 'متن کا سائز',
    sizes: ['چھوٹا', 'عام', 'بڑا', 'سب سے بڑا'],
    language: 'زبان',
    draft: 'مسودہ: یہ اردو متن کسی مقامی اردو بولنے والے کی نظرِ ثانی کا منتظر ہے۔',
    footer: 'قرآن سرکلز کی دستاویزات۔ ان صفحات سے کوئی ذاتی معلومات جمع نہیں کی جاتیں۔',
    englishOnly: 'یہ صفحہ فی الحال صرف انگریزی میں ہے۔',
  },
};

function layout({ lang, page, pages, body, toc }) {
  const t = UI[lang];
  const dir = lang === 'ur' ? 'rtl' : 'ltr';
  const other = lang === 'en' ? 'ur' : 'en';
  const hasOther = pages.some((p) => p.lang === other && p.slug === page.slug);
  const otherHref = `${BASE}/${other}/${hasOther ? page.slug : 'index'}.html`;
  const nav = NAV_SECTIONS.map(([key, labels]) => {
    const items = pages
      .filter((p) => p.lang === lang && p.section === key)
      .sort((a, b) => a.order - b.order);
    if (!items.length) return '';
    return `<section aria-labelledby="nav-${key}"><h2 id="nav-${key}" class="nav-h">${esc(labels[lang])}</h2><ul>${items
      .map(
        (p) =>
          `<li><a href="${BASE}/${lang}/${p.slug}.html"${p.slug === page.slug ? ' aria-current="page"' : ''}>${esc(p.title)}</a></li>`,
      )
      .join('')}</ul></section>`;
  }).join('');
  const tocHtml =
    toc.length > 2
      ? `<nav class="toc" aria-label="${esc(t.onThisPage)}"><h2 class="nav-h">${esc(t.onThisPage)}</h2><ul>${toc
          .filter((x) => x.level === 2)
          .map((x) => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`)
          .join('')}</ul></nav>`
      : '';
  const notes = [];
  if (lang === 'ur' && page.reviewed !== 'true')
    notes.push(`<p class="banner" role="note">${esc(t.draft)}</p>`);
  if (lang === 'ur' && page.englishOnly)
    notes.push(`<p class="banner" role="note">${esc(t.englishOnly)}</p>`);
  const sizeButtons = t.sizes
    .map(
      (s, n) =>
        `<button type="button" class="size" data-size="${n}" aria-pressed="${n === 1}">${esc(s)}</button>`,
    )
    .join('');
  return `<!doctype html>
<html lang="${lang}" dir="${dir}" data-size="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} · ${SITE}</title>
<meta name="description" content="${esc(page.description ?? page.title)}">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="${BASE}/assets/docs.css">
<script src="${BASE}/assets/docs.js" defer></script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="top">
  <a class="brand" href="${BASE}/${lang}/index.html"><span class="mark" aria-hidden="true"></span><span>${SITE}</span></a>
  <div class="tools">
    <div role="group" aria-label="${esc(t.textSize)}" class="sizes">${sizeButtons}</div>
    <a class="lang" href="${otherHref}" hreflang="${other}" lang="${other}">${other === 'ur' ? 'اردو' : 'English'}</a>
  </div>
</header>
<div class="shell">
  <nav class="side" aria-label="${esc(t.menu)}"><details open><summary>${esc(t.menu)}</summary>${nav}</details></nav>
  <main id="main" tabindex="-1">
    ${notes.join('\n    ')}
    <article>
${body}
    </article>
  </main>
  ${tocHtml}
</div>
<footer class="foot"><p>${esc(t.footer)}</p></footer>
</body>
</html>
`;
}

const CSS = `/* Quran Circles docs. Tokens follow packages/ui (Iqraa redesign, D17). Logical properties only. */
:root {
  --emerald: #1e563b; --emerald-deep: #163f2c; --leaf: #e8f5ee; --charcoal: #111827;
  --amber-700: #b45309; --red-700: #b91c1c;
  --bg: #ffffff; --surface: #f8fafc; --text: #111827; --text-2: #334155; --muted: #475569;
  --border: #cbd5e1; --link: #1e563b; --code-bg: #f1f5f9; --focus: #1e563b;
  --font-latin: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-urdu: "Mehr Nastaliq", "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --step: 1;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0b1f16; --surface: #11291e; --text: #ecf5f0; --text-2: #c6d8ce; --muted: #a7bfb2;
    --border: #24473a; --link: #6ee7b7; --code-bg: #0e241a; --focus: #6ee7b7; --leaf: #163426; }
}
html { font-size: calc(16px * var(--step)); -webkit-text-size-adjust: 100%; }
html[data-size="0"] { --step: .9375; } html[data-size="2"] { --step: 1.2; } html[data-size="3"] { --step: 1.45; }
body { margin: 0; background: var(--bg); color: var(--text); font: 1rem/1.6 var(--font-latin); }
html[lang="ur"] body { font-family: var(--font-urdu); font-size: 1.1em; line-height: 2.1; }
html[lang="ur"] strong, html[lang="ur"] h1, html[lang="ur"] h2, html[lang="ur"] h3, html[lang="ur"] h4 { font-weight: 400; }
html[lang="ur"] code, html[lang="ur"] pre { font-family: var(--font-mono); line-height: 1.5; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
a { color: var(--link); text-underline-offset: .2em; }
.skip { position: absolute; inset-inline-start: 1rem; inset-block-start: -4rem; background: var(--charcoal); color: #fff; padding: .75rem 1rem; border-radius: 999px; z-index: 10; }
.skip:focus { inset-block-start: .5rem; }
.top { display: flex; flex-wrap: wrap; gap: .75rem 1rem; align-items: center; justify-content: space-between;
  padding: .75rem 1rem; background: var(--emerald); color: #fff; }
.top a { color: #fff; }
.brand { display: inline-flex; align-items: center; gap: .6rem; font-weight: 700; text-decoration: none; min-block-size: 48px; }
.mark { inline-size: 1.5rem; block-size: 1.5rem; border-radius: 50%; background: #f59e0b; display: inline-block; }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
.sizes { display: flex; gap: .25rem; }
.size, .lang { min-block-size: 48px; min-inline-size: 48px; padding: 0 .9rem; border-radius: 999px; border: 1.5px solid #fff; background: transparent; color: #fff;
  font: inherit; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; text-decoration: none; }
.size[aria-pressed="true"] { background: #fff; color: var(--emerald-deep); font-weight: 700; }
.shell { display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr) minmax(0, 13rem); gap: 2rem; max-inline-size: 90rem; margin-inline: auto; padding: 1.5rem 1rem 3rem; }
.side, .toc { align-self: start; position: sticky; inset-block-start: 1rem; max-block-size: calc(100vh - 2rem); overflow: auto; }
.nav-h { font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 1.25rem 0 .5rem; font-weight: 700; }
html[lang="ur"] .nav-h { text-transform: none; letter-spacing: 0; font-size: .9rem; }
.side summary { display: flex; align-items: center; min-block-size: 48px; padding-inline: .75rem; font-weight: 700; cursor: pointer; border: 1px solid var(--border); border-radius: 12px; }
html[lang="ur"] .side summary { font-weight: 400; }
.side summary:focus-visible { outline-offset: 0; }
.side ul, .toc ul { list-style: none; margin: 0; padding: 0; }
.side a, .toc a { display: block; padding: .6rem .75rem; min-block-size: 44px; box-sizing: border-box; border-radius: 12px; text-decoration: none; color: var(--text-2); }
.side a[aria-current="page"] { background: var(--leaf); color: var(--text); font-weight: 700; box-shadow: inset 3px 0 0 var(--emerald); }
html[lang="ur"] .side a[aria-current="page"] { font-weight: 400; }
main { min-inline-size: 0; max-inline-size: 52rem; }
main:focus { outline: none; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1rem; }
h2 { font-size: 1.5rem; line-height: 1.3; margin: 2.5rem 0 .75rem; padding-block-start: .5rem; border-block-start: 1px solid var(--border); }
h3 { font-size: 1.2rem; margin: 2rem 0 .5rem; overflow-wrap: anywhere; }
h4 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; }
html[lang="ur"] h1, html[lang="ur"] h2, html[lang="ur"] h3 { line-height: 2; }
p, li { max-inline-size: 70ch; }
code { font: .9em var(--font-mono); background: var(--code-bg); padding: .1em .35em; border-radius: 6px; overflow-wrap: anywhere; }
pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 14px; padding: 1rem; overflow: auto; direction: ltr; text-align: left; }
pre code { background: none; padding: 0; overflow-wrap: normal; white-space: pre; font-size: .85rem; }
.table-wrap { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--border); border-radius: 14px; }
table { border-collapse: collapse; inline-size: 100%; font-size: .92rem; }
th, td { text-align: start; vertical-align: top; padding: .6rem .75rem; border-block-end: 1px solid var(--border); }
thead th { background: var(--surface); font-weight: 700; }
tbody tr:last-child > * { border-block-end: 0; }
tbody th { font-weight: 600; min-inline-size: 8rem; }
tbody th code { white-space: nowrap; }
figure { margin: 1.5rem 0; } figure img { max-inline-size: 100%; block-size: auto; border: 1px solid var(--border); border-radius: 16px; }
figcaption { color: var(--muted); font-size: .9rem; margin-block-start: .5rem; }
.callout { border: 1px solid var(--border); border-inline-start: 6px solid var(--emerald); background: var(--surface); border-radius: 14px; padding: .25rem 1rem; margin: 1.25rem 0; }
.callout.warning { border-inline-start-color: var(--amber-700); } .callout.internal { border-inline-start-color: var(--red-700); }
.banner { background: var(--leaf); border-radius: 12px; padding: .75rem 1rem; margin: 0 0 1rem; }
.plain { padding: 2rem; }
.en-island { font-family: var(--font-latin); line-height: 1.6; font-size: .91em; }
.foot { border-block-start: 1px solid var(--border); padding: 1.5rem 1rem; color: var(--muted); text-align: center; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; margin: 1.5rem 0; list-style: none; padding: 0; }
.cards li { max-inline-size: none; } .cards a { display: block; padding: 1rem 1.25rem; min-block-size: 48px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); text-decoration: none; color: var(--text); }
.cards a strong { display: block; color: var(--link); } .cards a:hover { border-color: var(--emerald); }
@media (max-width: 62rem) { .shell { grid-template-columns: minmax(0, 1fr); } .side, .toc { position: static; max-block-size: none; } .toc { display: none; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
@media (prefers-contrast: more) { :root { --border: #475569; --muted: #1e293b; } }
@media (forced-colors: active) { .size[aria-pressed="true"] { outline: 2px solid CanvasText; } .callout { border-inline-start-color: CanvasText; } }
@media print { .top, .side, .toc, .skip { display: none; } .shell { display: block; } }
`;

const JS = `// Text size: four steps, remembered on this device only. Everything works without it.
(function () {
  var root = document.documentElement;
  // On a narrow screen the menu starts closed so the page text comes first; without this script it stays open.
  try {
    var menu = document.querySelector('.side details');
    if (menu && window.matchMedia('(max-width: 62rem)').matches) menu.removeAttribute('open');
  } catch (e) {}
  var apply = function (n) {
    root.setAttribute('data-size', String(n));
    document.querySelectorAll('.size').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === String(n)));
    });
  };
  try { var saved = localStorage.getItem('qc-docs-size'); if (saved !== null) apply(Number(saved)); } catch (e) {}
  document.querySelectorAll('.size').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = Number(b.getAttribute('data-size'));
      apply(n);
      try { localStorage.setItem('qc-docs-size', String(n)); } catch (e) {}
    });
  });
})();
`;

/* --------------------------------------------------------------------- main */

function loadPages() {
  const pages = [];
  for (const lang of LANGS) {
    const dir = join(here, 'content', lang);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const [meta, body] = frontMatter(readFileSync(join(dir, file), 'utf8'));
      if (!meta.title) fail(`content/${lang}/${file}: front matter needs a title`);
      pages.push({
        lang,
        slug: file.replace(/\.md$/, ''),
        title: meta.title ?? file,
        description: meta.description,
        section: meta.section ?? 'start',
        order: Number(meta.order ?? 50),
        reviewed: meta.reviewed ?? 'false',
        englishOnly: meta.englishOnly === 'true',
        body,
        file: `content/${lang}/${file}`,
      });
    }
  }
  return pages;
}

function main() {
  const pages = loadPages();
  const openapi = JSON.parse(readFileSync(join(repo, 'packages/contracts/openapi.json'), 'utf8'));
  const ref = buildReference(openapi);
  const errRows = errorTable();
  const subst = (text) =>
    text
      .replaceAll('{{CONTRACT_VERSION}}', ref.version)
      .replaceAll('{{API_BASE_SITE}}', PROD_API.replace(/\/api$/, ''))
      .replaceAll('{{API_BASE}}', PROD_API)
      .replaceAll('{{PUBLIC_OPERATIONS}}', String(ref.total))
      .replace(
        '{{ERROR_TABLE}}',
        `| Code | HTTP status | Group |\n| --- | --- | --- |\n${errRows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`,
      )
      .replace('{{API_REFERENCE}}', ref.md);

  // Pages that carry a generated block use a placeholder, so the hand-written text around it stays in review.
  const built = [];
  for (const page of pages) {
    const ctx = { lang: page.lang, file: page.file, links: [], images: [] };
    const { html, toc } = markdown(subst(page.body), ctx);
    built.push({ page, ctx, html, toc });
  }

  // Every English page has an Urdu twin or says it is English only (no silent gaps).
  const slugs = new Set(pages.map((p) => p.slug));
  for (const slug of slugs) {
    const en = pages.find((p) => p.lang === 'en' && p.slug === slug);
    const ur = pages.find((p) => p.lang === 'ur' && p.slug === slug);
    if (!en && ur) fail(`content/ur/${slug}.md has no English page`);
    if (en && !ur) {
      // Served in the Urdu nav as English-only so nobody lands on a missing page.
      pages.push({ ...en, lang: 'ur', englishOnly: true, reviewed: 'true', title: en.title });
      built.push({
        page: pages[pages.length - 1],
        ctx: { lang: 'en', file: en.file, links: [], images: [] },
        ...markdown(subst(en.body), { lang: 'en', file: en.file, links: [], images: [] }),
      });
    }
  }

  // Link and image checks.
  const known = new Set(pages.map((p) => `${p.lang}/${p.slug}`));
  for (const b of built) {
    for (const link of b.ctx.links) {
      if (link.startsWith('#')) continue;
      const path = link.split('#')[0].replace(/\.md$/, '').replace(/^\//, '');
      const target = link.startsWith('/') ? path : `${b.ctx.lang}/${path}`;
      if (!known.has(target)) fail(`${b.page.file}: link ${link} does not match a page`);
    }
    for (const img of b.ctx.images)
      if (!existsSync(join(here, 'assets', img)))
        fail(`${b.page.file}: image ${img} is missing from docs/public/assets`);
  }
  if (errors.length) {
    process.stderr.write(`${errors.map((e) => `  ✗ ${e}`).join('\n')}\n`);
    process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  for (const { page, html, toc } of built) {
    const out = join(OUT, page.lang, `${page.slug}.html`);
    mkdirSync(dirname(out), { recursive: true });
    const lang = page.lang;
    // An English page shown inside the Urdu site keeps its own language and direction.
    const content =
      lang === 'ur' && page.englishOnly
        ? `<div lang="en" dir="ltr" class="en-island">${html}</div>`
        : html;
    writeFileSync(out, layout({ lang, page, pages, body: content, toc }));
  }
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  writeFileSync(join(OUT, 'assets', 'docs.css'), CSS);
  writeFileSync(join(OUT, 'assets', 'docs.js'), JS);
  if (existsSync(join(here, 'assets')))
    cpSync(join(here, 'assets'), join(OUT, 'assets'), { recursive: true });
  writeFileSync(
    join(OUT, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${SITE} documentation</title><meta http-equiv="refresh" content="0; url=${BASE}/en/index.html"><link rel="stylesheet" href="${BASE}/assets/docs.css"></head><body><main class="plain"><h1>${SITE} documentation</h1><p><a href="${BASE}/en/index.html">English</a></p><p lang="ur" dir="rtl"><a href="${BASE}/ur/index.html">اردو</a></p></main></body></html>\n`,
  );
  process.stdout.write(
    `built ${built.length} pages, ${ref.total} public operations (contract ${ref.version}) -> ${OUT}\n`,
  );
}

main();
