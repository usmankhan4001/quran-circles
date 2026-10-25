import {
  buildDeepLink,
  posterLanguagesOf,
  posterLocaleOf,
  stripUnsafeText,
  type PosterFormat,
  type RendererRenderedFile,
  type RendererRenderResponse,
} from '@qc/contracts';
import type { PageJob, PageResult } from './browser';
import { cacheKey, MemoryCache, sha256 } from './cache';
import { CONTENT_TYPES, FORMAT_SPECS } from './formats';
import { formatWhen } from './format';
import { RenderRequest, type RenderRequestInput } from './input';
import { Limiter } from './limiter';
import type { Logger } from './logger';
import { makeQr } from './qr';
import { t, type PosterLocale } from './strings';
import { templateOf, type PosterBlock, type PosterTemplate, type PosterView } from './templates';

/** Whatever draws one page: the browser pool, or a fake in tests. */
export interface PageRenderer {
  render(job: PageJob, deadline: number): Promise<PageResult>;
}

/** One rendered file: the contract's `RendererRenderedFile` with the bytes instead of base64. */
export type RenderedFile = Omit<RendererRenderedFile, 'base64'> & { bytes: Buffer };

/**
 * A render: the contract's `RendererRenderResponse` with the bytes instead of base64. `provisional`
 * is the template's own flag (true for the demo templates `cloud` and `night`).
 */
export type RenderResult = Omit<RendererRenderResponse, 'files'> & { files: RenderedFile[] };

export interface RendererOptions {
  pages: PageRenderer;
  limiter: Limiter;
  cache: MemoryCache;
  timeoutMs: number;
  logger: Logger;
  /** Public https origin for QR codes; without it they use the app scheme. */
  webBase?: string;
}

const pick = (
  value: { en: string; ur: string | null } | null,
  locale: PosterLocale,
): string | null => (value ? (locale === 'ur' ? (value.ur ?? value.en) : value.en) : null);

/**
 * Second guard (SEC-08): the contract already refuses control, bidi and invisible format characters
 * in the fields and the snapshot (`SafeText`); whatever reaches a block is stripped of them too, so
 * only the template's own isolates (decision 0012) can change the direction of printed text.
 */
const clean = (value: string | null): string | null =>
  value === null ? null : stripUnsafeText(value);

function blocksOf(request: RenderRequest): PosterBlock[] {
  const { session, fields } = request;
  return posterLanguagesOf(request.language).map((locale) => ({
    locale,
    title: stripUnsafeText(fields.title[locale] ?? ''),
    when: formatWhen(session, locale),
    // An Urdu poster of a venue with no Urdu name prints the English name, isolated (mixed text).
    venue: stripUnsafeText(pick(session.venue.name, locale) ?? session.venue.name.en),
    area: clean(pick(session.venue.area, locale)),
    details: clean(fields.details?.[locale] ?? null),
    address: clean(fields.flyer?.address?.[locale] ?? null),
  }));
}

/** Turns a checked request into what the template draws for one format. */
export function buildView(
  request: RenderRequest,
  format: PosterFormat,
  webBase?: string,
): PosterView {
  const spec = FORMAT_SPECS[format];
  const locales = posterLanguagesOf(request.language);
  const link = deepLinkOf(request, webBase);
  const scanKey =
    request.fields.qrTarget === 'register' ? 'poster.scanToRegister' : 'poster.scanToOpen';
  const flyer = request.fields.flyer;
  const codes = spec.qr
    ? (
        [
          ['poster.whatsappGroup', flyer?.whatsappUrl],
          ['poster.googleLocation', flyer?.locationUrl],
        ] as const
      )
        .filter((c): c is readonly [(typeof c)[0], string] => Boolean(c[1]))
        .map(([key, url]) => ({
          label: locales.map((locale) => ({ locale, text: t(locale, key) })),
          qr: makeQr(url),
        }))
    : [];
  return {
    spec,
    language: request.language,
    accent: request.fields.accent,
    blocks: blocksOf(request),
    qr: spec.qr ? makeQr(link) : null,
    phone: clean(flyer?.phone ?? null),
    codes,
    scan: locales.map((locale) => ({ locale, text: t(locale, scanKey) })),
    appName: locales.map((locale) => ({ locale, text: t(locale, 'app.name') })),
    host: webBase ? new URL(webBase).host : null,
  };
}

export function deepLinkOf(request: RenderRequest, webBase?: string): string {
  return buildDeepLink(
    { type: request.fields.qrTarget, sessionId: request.session.sessionId },
    webBase,
  );
}

function altTextOf(request: RenderRequest): RenderResult['altText'] {
  const out: RenderResult['altText'] = {};
  for (const block of blocksOf(request)) {
    out[block.locale] = t(block.locale, 'poster.alt', {
      title: block.title,
      venue: block.venue,
      when: block.when,
    });
  }
  return out;
}

/** `RenderRequest` has already refused unknown keys; this only narrows the type. */
function requireTemplate(key: string): PosterTemplate {
  const template = templateOf(key);
  if (!template) throw new RangeError('no template with this key');
  return template;
}

/**
 * Renders posters: checks the request, then for each format returns the cached file for the same
 * template, fields and session version, or draws it in the browser. One request holds one slot of
 * the limiter and has one deadline for all its formats.
 */
export class PosterRenderer {
  constructor(private readonly options: RendererOptions) {}

  async render(input: RenderRequestInput | RenderRequest): Promise<RenderResult> {
    const request = RenderRequest.parse(input);
    const template = requireTemplate(request.templateId);
    const deepLink = deepLinkOf(request, this.options.webBase);
    const keyed = request.formats.map((format) => ({
      format,
      key: cacheKey({
        templateId: template.id,
        templateVersion: template.version,
        format,
        language: request.language,
        fields: request.fields,
        session: request.session,
        deepLink,
      }),
    }));

    const files: RenderedFile[] = [];
    const hits = new Map<string, Buffer>();
    for (const { key } of keyed) {
      const hit = this.options.cache.get(key);
      if (hit) hits.set(key, hit.bytes);
    }
    const missing = keyed.filter(({ key }) => !hits.has(key));
    const fresh = new Map<string, Buffer>();
    if (missing.length > 0) {
      await this.options.limiter.run(async () => {
        const deadline = Date.now() + this.options.timeoutMs;
        for (const { format, key } of missing) {
          const spec = FORMAT_SPECS[format];
          const view = buildView(request, format, this.options.webBase);
          const started = Date.now();
          const { bytes, blocked } = await this.options.pages.render(
            {
              html: template.build(view),
              width: spec.width,
              height: spec.height,
              output:
                spec.output === 'png'
                  ? { kind: 'png' }
                  : { kind: 'pdf', format: spec.pdfFormat ?? 'A4' },
              fitUnit: spec.unit,
            },
            deadline,
          );
          if (blocked.length > 0) {
            // A locked template never asks for anything; this means a template bug. Counted, not fatal.
            this.options.logger.warn('render.blocked_requests', {
              template: template.id,
              format,
              count: blocked.length,
            });
          }
          this.options.logger.info('render.done', {
            template: template.id,
            format,
            ms: Date.now() - started,
            bytes: bytes.length,
          });
          fresh.set(key, bytes);
          this.options.cache.set(key, { bytes, contentType: CONTENT_TYPES[spec.output] });
        }
      });
    }

    for (const { format, key } of keyed) {
      const spec = FORMAT_SPECS[format];
      const bytes = fresh.get(key) ?? hits.get(key);
      if (!bytes) throw new Error('rendered file missing');
      files.push({
        format,
        contentType: CONTENT_TYPES[spec.output],
        filename: `poster-${request.session.sessionId.slice(0, 8)}-${template.id}-${format}-${request.language}.${spec.output}`,
        cacheKey: key,
        sha256: sha256(bytes),
        byteLength: bytes.length,
        cached: !fresh.has(key),
        bytes,
      });
    }

    return {
      templateId: template.id,
      templateVersion: template.version,
      provisional: template.provisional,
      language: request.language,
      locale: posterLocaleOf(request.language),
      deepLink,
      sourceSnapshot: request.session,
      altText: altTextOf(request),
      files,
    };
  }
}
