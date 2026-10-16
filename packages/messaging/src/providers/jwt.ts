import { createPrivateKey, createSign } from 'node:crypto';

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

/** Signs a compact JWT with RS256 (Google service accounts). */
export function signJwtRs256(
  privateKeyPem: string,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...header }));
  const body = b64url(JSON.stringify(claims));
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${body}`);
  const signature = signer.sign(createPrivateKey(privateKeyPem));
  return `${head}.${body}.${b64url(signature)}`;
}

/** Signs a compact JWT with ES256 (APNs). The signature is the raw r||s form JWT requires. */
export function signJwtEs256(
  privateKeyPem: string,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
): string {
  const head = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', ...header }));
  const body = b64url(JSON.stringify(claims));
  const signer = createSign('SHA256');
  signer.update(`${head}.${body}`);
  const signature = signer.sign({ key: createPrivateKey(privateKeyPem), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(signature)}`;
}
