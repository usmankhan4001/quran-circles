import { RendererRenderRequest, type RendererRenderRequestInput } from '@qc/contracts';
import { TEMPLATE_IDS, templateOf } from './templates';

/**
 * What `POST /render` and `PosterRenderer.render` accept: the contract's `RendererRenderRequest`
 * (1.0.0-rc.5), plus one renderer rule. The contract's template key is open, so a well-formed key
 * this renderer has no template for is refused here with the same issue shape as any other
 * field (`templateId`, `invalid_value`); the worker maps the 400 to `invalid_request`.
 */
export const RenderRequest = RendererRenderRequest.superRefine((value, ctx) => {
  if (!templateOf(value.templateId)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: [...TEMPLATE_IDS],
      input: value.templateId,
      path: ['templateId'],
      message: 'no template with this key',
    });
  }
});
export type RenderRequest = RendererRenderRequest;
export type RenderRequestInput = RendererRenderRequestInput;
