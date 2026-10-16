import { z } from 'zod';

export * from './enums';

export const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
