import { cloudTemplate } from './cloud';
import { nightTemplate } from './night';
import { quranicTemplate } from './quranic';
import type { PosterTemplate } from './view';

/**
 * The locked templates this renderer can draw. Adding one is a human-approved change (brief).
 *
 * Template keys are open in the contract (`PosterTemplateKey`, 1.0.0-rc.5) because the owner's final
 * designs come later as new keys; a key that is not here is refused with `validation_failed` on
 * `templateId`. `cloud` and `night` are the demo templates and stay provisional; `quranic_circles`
 * is the owner's first final design (from Canva). All three are the contract's `DEMO_POSTER_TEMPLATES`.
 */
export const TEMPLATES = {
  cloud: cloudTemplate,
  night: nightTemplate,
  quranic_circles: quranicTemplate,
} as const satisfies Record<string, PosterTemplate>;

export type TemplateId = keyof typeof TEMPLATES;
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/** The template for a key, or undefined. Own keys only, so `constructor` and the like are refused. */
export function templateOf(key: string): PosterTemplate | undefined {
  return Object.hasOwn(TEMPLATES, key) ? TEMPLATES[key as TemplateId] : undefined;
}

export type { PosterBlock, PosterTemplate, PosterView, TextPair } from './view';
