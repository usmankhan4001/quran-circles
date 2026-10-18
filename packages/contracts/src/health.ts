import { z } from 'zod';
import { lazy } from './lazy';

export const HealthResponse = lazy(() =>
  z.object({
    ok: z.literal(true),
    service: z.string().min(1),
  }),
);
export type HealthResponse = z.infer<typeof HealthResponse>;
