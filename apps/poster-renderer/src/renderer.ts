import { buildDeepLink, type PosterFormat } from '@qc/contracts';
import type { PageJob, PageResult } from './browser';
import { cacheKey, MemoryCache, sha256 } from './cache';
import { CONTENT_TYPES, FORMAT_SPECS } from './formats';
import { formatWhen } from './format';
import { languagesOf, RenderRequest, type RenderRequestInput } from './input';
import { Limiter } from './limiter';
import type { Logger } from './logger';
import { makeQr } from './qr';
import type { SourceSnapshot } from './snapshot';
import { t, type PosterLocale } from './strings';
import { TEMPLATES, type PosterBlock, type PosterView } from './templates';

/** Whatever draws one page: the browser pool, or a fake in tests. */
export interface PageRenderer {
  render(job: PageJob, deadline: number): Promise<PageResult>;
}

export interface RenderedFile {
  format: PosterFormat;
  contentType: string;
  filename: string;
  cacheKey: string;
  sha256: string;
  byteLength: number;
  /** True when the file came from the cache rather than a fresh render. */
  cached: boolean;
  bytes: Buffer;
}

export interface RenderResult {
  templateId: string;
  templateVersion: number;
  provisional: boolean;
  language: RenderRequest['language'];
  /** The leading language, for `posters.locale`. */
  locale: PosterLocale;
  /** What the QR code opens. */
  deepLink: string;
  /** Store with the poster (`posters.source_snapshot`) to detect a later change. */
  sourceSnapshot: SourceSnapshot;
  /** A plain sentence per language shown, for the share sheet and the preview tag. */
  altText: Partial<Record<PosterLocale, string>>;
  files: RenderedFile[];
}

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

function blocksOf(request: RenderRequest): PosterBlock[] {
  const { session, fields } = request;
  return languagesOf(request.language).map((locale) => ({
    locale,
    title: fields.title[locale] ?? '',
    when: formatWhen(session, locale),
    // An Urdu poster of a venue with no Urdu name prints the English name, isolated (mixed text).
    venue: pick(session.venue.name, locale) ?? session.venue.name.en,
    area: pick(session.venue.area, locale),
    details: fields.details?.[locale] ?? null,
  }));
}

/** Turns a checked request into what the template draws for one format. */
export function buildView(
  request: RenderRequest,
  format: PosterFormat,
  webBase?: string,
): PosterView {
  const spec = FORMAT_SPECS[format];
  const locales = languagesOf(request.language);
  const link = deepLinkOf(request, webBase);
  const scanKey =
    request.fields.qrTarget === 'register' ? 'poster.scanToRegister' : 'poster.scanToOpen';
  return {
    spec,
    language: request.language,
    accent: request.fields.accent,
    blocks: blocksOf(request),
    qr: spec.qr ? makeQr(link) : null,
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

function altTextOf(request: RenderRequest): Partial<Record<PosterLocale, string>> {
  const out: Partial<Record<PosterLocale, string>> = {};
  for (const block of blocksOf(request)) {
    out[block.locale] = t(block.locale, 'poster.alt', {
      title: block.title,
      venue: block.venue,
      when: block.when,
    });
  }
  return out;
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
    const template = TEMPLATES[request.templateId];
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
      locale: languagesOf(request.language)[0] ?? 'en',
      deepLink,
      sourceSnapshot: request.session,
      altText: altTextOf(request),
      files,
    };
  }
}
