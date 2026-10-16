/**
 * Public configuration only. Nothing here is a secret: the API address is public, and every
 * request is authorised by the person's own sign-in. Set `EXPO_PUBLIC_API_URL` at build time;
 * the default is the contract's mock server (`pnpm --filter @qc/contracts mock`).
 */
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010',
} as const;
