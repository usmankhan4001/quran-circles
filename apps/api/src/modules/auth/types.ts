import type { z } from 'zod';
import type {
  RefreshBody,
  RequestCodeBody,
  RequestCodeResponse,
  SignInResponse,
  VerifyCodeBody,
} from '@qc/contracts';

/** The contract's request and response shapes, after validation (defaults filled in). */
export type RequestCodeInput = z.output<typeof RequestCodeBody>;
export type RequestCodeResult = z.output<typeof RequestCodeResponse>;
export type VerifyCodeInput = z.output<typeof VerifyCodeBody>;
export type SignInResult = z.output<typeof SignInResponse>;
export type RefreshInput = z.output<typeof RefreshBody>;
