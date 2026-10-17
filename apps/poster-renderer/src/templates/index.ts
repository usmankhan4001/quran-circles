import type { TemplateId } from '../input';
import { cloudTemplate } from './cloud';
import { nightTemplate } from './night';
import type { PosterTemplate } from './view';

/** The locked templates. Adding one is a human-approved change (brief). */
export const TEMPLATES: Record<TemplateId, PosterTemplate> = {
  cloud: cloudTemplate,
  night: nightTemplate,
};

export type { PosterBlock, PosterTemplate, PosterView, TextPair } from './view';
